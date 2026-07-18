// Raised from 5MB to 10MB for trip report photos taken straight from a
// phone — shared by every other upload path in the app too (avatars, drive
// banners, branding), which is a strictly more generous cap for those, not
// a regression, so there's no reason to fork a second constant just for
// trip reports.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type ImageValidation =
  | { ok: true; file: File }
  | { ok: false; message: string };

/** Shared client/server-safe validation for any user-uploaded image field —
 * a `FormData.get(...)` result that should be an image under the size cap. */
export function validateImageFile(value: FormDataEntryValue | null): ImageValidation {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, message: "Choose an image to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(value.type)) {
    return { ok: false, message: "Please upload a JPEG, PNG, WEBP, or GIF image." };
  }
  if (value.size > MAX_IMAGE_BYTES) {
    return { ok: false, message: "Image must be 10MB or smaller." };
  }
  return { ok: true, file: value };
}
