import { v2 as cloudinary } from "cloudinary";

// Configured once at module scope from server-only env vars — never sent to
// the client. Every caller of this module is itself server-only ("use
// server" actions), so there's no escape hatch for these to leak through.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export type CloudinaryUploadResult =
  | { ok: true; url: string }
  | { ok: false; timedOut: boolean };

/** Shared upload-stream call behind every image upload path in the app
 * (trip report photos, equipment proofs, ...) — only the destination
 * `folder` varies per caller. */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> {
  // Guards against exactly the "hangs indefinitely" symptom, independent of
  // whatever the underlying cause turns out to be on a given request (slow
  // mobile upload link, a stalled socket to Cloudinary, a serverless
  // platform silently dropping the connection rather than erroring it) —
  // this makes sure the caller always gets a settled result within a
  // bounded time instead of leaving the browser waiting forever.
  const UPLOAD_TIMEOUT_MS = 25_000;

  try {
    const result = await Promise.race([
      new Promise<{ secure_url: string }>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder },
          (error, uploadResult) => {
            if (error || !uploadResult) {
              reject(error ?? new Error("Cloudinary returned no result."));
              return;
            }
            resolve(uploadResult);
          },
        );
        // Belt-and-suspenders alongside the upload_stream callback above —
        // if the underlying socket errors out at the stream level rather
        // than Cloudinary's API cleanly responding with an error, this is
        // what actually catches it instead of the promise never settling.
        uploadStream.on("error", reject);
        uploadStream.end(buffer);
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("UPLOAD_TIMEOUT")), UPLOAD_TIMEOUT_MS);
      }),
    ]);

    return { ok: true, url: result.secure_url };
  } catch (err) {
    console.error("uploadBufferToCloudinary error:", err);
    const timedOut = err instanceof Error && err.message === "UPLOAD_TIMEOUT";
    return { ok: false, timedOut };
  }
}
