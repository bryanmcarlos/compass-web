"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

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
    onClose();
  }

  function reverseGeocode(lat: number, lng: number) {
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    setGeocoding(true);
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      setGeocoding(false);
      if (status === "OK" && results?.[0]) {
        setPlaceName(results[0].formatted_address);
      }
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
    reverseGeocode(lat, lng);
  }

  function handleMarkerDragEnd(e: google.maps.MapMouseEvent) {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setPosition({ lat, lng });
    reverseGeocode(lat, lng);
  }

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    setPosition({ lat, lng });
    setPlaceName(place.name || place.formatted_address || formatCoordinates(lat, lng));
    setSearchValue(place.name || place.formatted_address || "");
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(16);
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
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Search for a place…"
                  className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-sm text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
                />
              </div>
            </Autocomplete>

            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-sand">
              <GoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={position ?? DEFAULT_CENTER}
                zoom={position ? 16 : 9}
                onLoad={handleMapLoad}
                onClick={handleMapClick}
                options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
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
