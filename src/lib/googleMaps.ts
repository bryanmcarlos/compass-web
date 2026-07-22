import type { Libraries } from "@react-google-maps/api";

// useJsApiLoader/LoadScript require this array to be a stable reference
// across renders — a fresh literal on every render makes the library think
// the requested libraries changed and reloads the script.
export const GOOGLE_MAPS_LIBRARIES: Libraries = ["places"];

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** Prefers a place_id link (Google's canonical, most stable "place" URL —
 * shows the business name/photos/hours) and falls back to a plain
 * lat/lng search link when a spot was only pinned on the map without an
 * associated Places result (e.g. a dragged marker with no nearby POI). */
export function buildGoogleMapsUrl(params: {
  placeId?: string | null;
  lat: number;
  lng: number;
}): string {
  if (params.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${params.placeId}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${params.lat},${params.lng}`;
}

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(7)}, ${lng.toFixed(7)}`;
}
