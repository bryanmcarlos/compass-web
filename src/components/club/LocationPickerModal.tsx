"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  GoogleMap,
  Marker,
  Autocomplete,
  useJsApiLoader,
} from "@react-google-maps/api";
import { MapPin, Search, X, LoaderCircle, CircleAlert, Check } from "lucide-react";
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LIBRARIES,
  buildGoogleMapsUrl,
  formatCoordinates,
} from "@/lib/googleMaps";

export type PickedLocation = {
  /** Place name if the pin came from a Places search result, otherwise the
   * reverse-geocoded street address for a manually dropped/dragged pin. */
  name: string;
  lat: number;
  lng: number;
  mapUrl: string;
};

// The club's drives all run in the UAE desert belt (Sweihan, Badayer, etc.)
// — centering here means a marshal usually doesn't have to pan/zoom before
// searching.
const DEFAULT_CENTER = { lat: 24.4539, lng: 54.3773 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "100%" };

/** google.maps.GeocoderStatus values that mean "your query was fine, the
 * service just couldn't match it" vs. everything else, which means the
 * Google Cloud project/key isn't set up to serve this request at all
 * (Geocoding API not enabled, key's API restrictions exclude it, billing
 * not enabled, quota exhausted, etc.) — surfacing which one it is turns "no
 * results for anything I type" from a dead end into an actionable message. */
function describeGeocoderError(status: google.maps.GeocoderStatus): string {
  switch (status) {
    case "ZERO_RESULTS":
      return "No results found for that search — try a different spelling, or drop a pin on the map instead.";
    case "REQUEST_DENIED":
      return "Google denied this request — the Geocoding API is likely not enabled for this project, or the API key's restrictions exclude it.";
    case "OVER_QUERY_LIMIT":
      return "Google Maps quota/billing limit reached for this API key.";
    case "INVALID_REQUEST":
      return "Invalid search request.";
    default:
      return `Search failed (${status}). Check the browser console for details.`;
  }
}

export function LocationPickerModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Pick a Location",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  title?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  // The query text a Places dropdown selection last resolved — lets Enter
  // skip re-geocoding when the box already reflects a confirmed pick (e.g.
  // Google's own widget already selected an arrow-key-highlighted
  // suggestion), while still firing for a typed query that was never
  // clicked/highlighted.
  const lastConfirmedQueryRef = useRef<string>("");

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  // Reset to a blank slate on every close (cancel, confirm, Escape, or
  // backdrop click all funnel through here) so the next open — for a
  // different field, Meeting Point vs. Exit Location say — never carries
  // over the previous pin.
  function handleClose() {
    setPosition(null);
    setPlaceName("");
    setSearchValue("");
    setSearchError(null);
    lastConfirmedQueryRef.current = "";
    onClose();
  }

  // Google's reverse geocoder, given nothing but coordinates, defaults to
  // its most *precise* match — which in the desert terrain these drives run
  // in usually has no real street address to report, so it falls back to a
  // Plus Code stapled onto a long address string (e.g. "7XQ8+VJ Sweihan -
  // Abu Dhabi, United Arab Emirates"). That's correct but unreadable as a
  // "Meeting point name". Prefer, in order: a Plus Code result's own
  // `compound_code` (its human-readable part with the code trimmed off — a
  // Plus Code result always has one), then the shortest non-Plus-Code result
  // available (locality/sublocality reads as "Sweihan, Abu Dhabi" instead of
  // a full street address).
  function shortNameFromGeocodeResults(results: google.maps.GeocoderResult[]): string {
    const plusCode = results.find((r) => r.types.includes("plus_code"));
    if (plusCode?.plus_code?.compound_code) {
      // "7XQ8+VJ Sweihan, Abu Dhabi, United Arab Emirates" -> drop the code.
      return plusCode.plus_code.compound_code.replace(/^\S+\+\S+\s*/, "");
    }
    const nonPlusCode = results.filter((r) => !r.types.includes("plus_code"));
    if (nonPlusCode.length === 0) return results[0].formatted_address;
    return nonPlusCode.reduce((shortest, r) =>
      r.formatted_address.length < shortest.formatted_address.length ? r : shortest,
    ).formatted_address;
  }

  function getPlacesService(): google.maps.places.PlacesService | null {
    if (!mapRef.current) return null;
    if (!placesServiceRef.current) {
      placesServiceRef.current = new google.maps.places.PlacesService(mapRef.current);
    }
    return placesServiceRef.current;
  }

  function geocodeFallback(lat: number, lng: number) {
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      setGeocoding(false);
      if (status === "OK" && results && results.length > 0) {
        setPlaceName(shortNameFromGeocodeResults(results));
      }
    });
  }

  // Dropping/dragging a pin has no Places result to read a name from the
  // way a search-box selection does (handlePlaceChanged, below) — so first
  // check whether the pin landed on an actual named place (a petrol
  // station, a shop) within a tight radius and use its real name, e.g.
  // "ADNOC Sweihan", before falling back to a geocoded address string.
  function resolvePinLocation(lat: number, lng: number) {
    setGeocoding(true);
    const placesService = getPlacesService();
    if (!placesService) {
      geocodeFallback(lat, lng);
      return;
    }
    placesService.nearbySearch({ location: { lat, lng }, radius: 60 }, (results, status) => {
      const nearest = results?.[0];
      if (status === google.maps.places.PlacesServiceStatus.OK && nearest?.name) {
        setPlaceName(nearest.name);
        setGeocoding(false);
        return;
      }
      geocodeFallback(lat, lng);
    });
  }

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  function handleMapClick(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPosition({ lat, lng });
    resolvePinLocation(lat, lng);
  }

  function handleMarkerDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPosition({ lat, lng });
    resolvePinLocation(lat, lng);
  }

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const resolvedName = place.name || place.formatted_address || formatCoordinates(lat, lng);
    setPosition({ lat, lng });
    setPlaceName(resolvedName);
    setSearchValue(place.name || place.formatted_address || "");
    setSearchError(null);
    lastConfirmedQueryRef.current = place.name || place.formatted_address || "";
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(16);
  }

  /** Resolves free-typed text to a location without requiring a dropdown
   * click — the Enter-key fallback below, and effectively "select the top
   * prediction" since the Geocoding API returns its best match first. */
  function geocodeQuery(query: string) {
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    setGeocoding(true);
    geocoderRef.current.geocode({ address: query }, (results, status) => {
      setGeocoding(false);
      if (status === "OK" && results?.[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        setPosition({ lat, lng });
        setPlaceName(results[0].formatted_address);
        setSearchError(null);
        lastConfirmedQueryRef.current = query;
        mapRef.current?.panTo({ lat, lng });
        mapRef.current?.setZoom(16);
      } else {
        console.error("Geocoder search failed:", status, "for query:", query);
        setSearchError(describeGeocoderError(status));
      }
    });
  }

  // Enter always intercepts default form submission first — this input sits
  // inside the outer "Post a Drive" <form>, so without this an Enter press
  // here would implicitly submit that form. Google's own Autocomplete widget
  // still gets a chance to handle Enter for an arrow-key-highlighted
  // suggestion (it listens on the same input independently of this handler),
  // which is why the fallback below only geocodes when the box's text isn't
  // already a confirmed selection — avoids a redundant/racy second lookup.
  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const query = e.currentTarget.value.trim();
    if (!query || query === lastConfirmedQueryRef.current) return;
    geocodeQuery(query);
  }

  function handleConfirm() {
    if (!position) return;
    onConfirm({
      name: placeName || formatCoordinates(position.lat, position.lng),
      lat: position.lat,
      lng: position.lng,
      mapUrl: buildGoogleMapsUrl({ lat: position.lat, lng: position.lng }),
    });
    handleClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      className="m-auto w-full max-w-2xl rounded-2xl border border-sand bg-off-white p-0 shadow-sm backdrop:bg-charcoal/50"
    >
      <div className="flex h-[80vh] max-h-[640px] flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <MapPin className="h-4 w-4 text-forest" />
            {title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-light/60 hover:bg-sand-light"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!GOOGLE_MAPS_API_KEY ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-sand p-6 text-center">
            <CircleAlert className="h-6 w-6 text-error" />
            <p className="text-sm font-medium text-charcoal">Google Maps isn&apos;t configured</p>
            <p className="max-w-sm text-xs text-charcoal-light/70">
              Add <code className="rounded bg-sand-light px-1 py-0.5">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
              to the environment to enable the map picker.
            </p>
          </div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-error/40 p-6 text-center">
            <CircleAlert className="h-6 w-6 text-error" />
            <p className="text-sm font-medium text-charcoal">Couldn&apos;t load Google Maps</p>
            <p className="max-w-sm text-xs text-charcoal-light/70">
              Check the API key and that the Maps JavaScript &amp; Places APIs are enabled.
            </p>
          </div>
        ) : !isLoaded ? (
          <div className="flex flex-1 items-center justify-center">
            <LoaderCircle className="h-6 w-6 animate-spin text-forest" />
          </div>
        ) : (
          <>
            <Autocomplete
              onLoad={(ac) => (autocompleteRef.current = ac)}
              onPlaceChanged={handlePlaceChanged}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/50" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setSearchError(null);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search for a place…"
                  className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-sm text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
                />
              </div>
            </Autocomplete>
            {searchError && (
              <p className="flex items-start gap-1.5 text-xs text-error">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {searchError}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-sand">
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={position ?? DEFAULT_CENTER}
                zoom={position ? 16 : 9}
                onLoad={handleMapLoad}
                onClick={handleMapClick}
                options={{
                  streetViewControl: false,
                  fullscreenControl: false,
                  // "auto" (the default) falls back to cooperative gesture
                  // handling inside a normal scrolling page — single-finger
                  // drag/scroll-wheel do nothing until Ctrl is held, so it
                  // doesn't fight the page's own scroll. This map only ever
                  // lives inside a dedicated modal, not a longer page, so it
                  // should behave like maps.google.com directly instead.
                  gestureHandling: "greedy",
                  zoomControl: true,
                  mapTypeControl: true,
                  mapTypeControlOptions: {
                    style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                    mapTypeIds: ["roadmap", "satellite", "hybrid", "terrain"],
                  },
                }}
              >
                {position && (
                  <Marker position={position} draggable onDragEnd={handleMarkerDragEnd} />
                )}
              </GoogleMap>
            </div>

            <div className="flex items-center gap-2 text-xs text-charcoal-light/70">
              {position ? (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0 text-forest" />
                  <span className="truncate">
                    {geocoding ? "Looking up address…" : placeName}
                    {" — "}
                    {formatCoordinates(position.lat, position.lng)}
                  </span>
                </>
              ) : geocoding ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-forest" />
                  <span>Searching…</span>
                </>
              ) : (
                <span>Search above, or click/tap the map to drop a pin — drag it to fine-tune.</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!position}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MapPin className="h-4 w-4" />
              Confirm Location
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
