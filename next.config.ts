import type { NextConfig } from "next";

// Derived from the env var (rather than hardcoded) so this stays correct if
// the project ever points at a different Supabase project across environments.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Server Actions default to a 1MB request body limit — nowhere near
  // enough for a photo upload. validateImageFile() already caps a single
  // image at 5MB; 6mb leaves headroom for multipart boundary/header
  // overhead on top of that (per Next's own sizing guidance), and each
  // dropped photo uploads via its own Server Action call, so this only
  // ever needs to cover one image at a time, not a whole batch.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
