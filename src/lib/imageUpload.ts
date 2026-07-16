export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
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
    return { ok: false, message: "Image must be 5MB or smaller." };
  }
  return { ok: true, file: value };
}
