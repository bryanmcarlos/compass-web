#!/usr/bin/env node
/**
 * One-off verification script — confirms the Cloudinary integration works
 * end-to-end against the real account. Not imported by the app itself.
 *
 * Credentials are read from the environment (.env.local — gitignored),
 * never hardcoded here. This file gets committed to the repo; a literal
 * API secret in a committed file is a permanent leak the moment it's
 * pushed, not a hypothetical one, so this loads the exact same
 * CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET vars
 * that the real uploadImageToCloudinary Server Action already reads.
 *
 * Usage: node scripts/test-cloudinary.js
 * (loads ../.env.local itself — no separate env-loading step needed)
 */

/* eslint-disable @typescript-eslint/no-require-imports -- this project has
   no "type": "module", so a plain .js file run via `node script.js` is CJS
   by default; require() is the correct choice here, not a lint violation to
   work around by switching module systems for a one-off script. */
const fs = require("node:fs");
const path = require("node:path");
const cloudinary = require("cloudinary").v2;

// Minimal .env.local loader — avoids adding a dependency (e.g. dotenv) just
// for a one-off script when this is the only place in the project that
// would need it outside the Next.js dev/build process (which loads
// .env.local on its own already).
function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error(
    "Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in .env.local.",
  );
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

const SAMPLE_IMAGE_URL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

async function main() {
  console.log(`Uploading sample image from ${SAMPLE_IMAGE_URL} ...`);

  const uploadResult = await cloudinary.uploader.upload(SAMPLE_IMAGE_URL, {
    folder: "compass_trip_reports",
  });

  console.log("\n✅ Upload succeeded.");
  console.log("secure_url:", uploadResult.secure_url);
  console.log("public_id: ", uploadResult.public_id);

  console.log("\nMetadata:");
  console.log("  width: ", uploadResult.width);
  console.log("  height:", uploadResult.height);
  console.log("  format:", uploadResult.format);
  console.log("  bytes: ", uploadResult.bytes);

  const optimizedUrl = cloudinary.url(uploadResult.public_id, {
    fetch_format: "auto",
    quality: "auto",
  });
  console.log("\nOptimized URL (f_auto, q_auto):");
  console.log(" ", optimizedUrl);
}

main().catch((err) => {
  console.error("\n❌ Cloudinary verification failed:", err.message || err);
  process.exit(1);
});
