import type { NextConfig } from "next";

// Derived from the env var (rather than hardcoded) so this stays correct if
// the project ever points at a different Supabase project across environments.
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Server Actions default to a 1MB request body limit — nowhere near
  // enough for a photo upload. validateImageFile() caps a single image at
  // 10MB (raised from 5MB for full-res phone camera photos); 11mb leaves
  // headroom for multipart boundary/header overhead on top of that (per
  // Next's own sizing guidance), and each dropped photo uploads via its own
  // Server Action call, so this only ever needs to cover one image at a
  // time, not a whole batch.
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb",
    },
    // Every page here is dynamically rendered (Supabase reads, not fetch()
    // calls Next's data cache can see) — the Router Cache's default
    // dynamic stale time is 0, so navigating away and back re-fetches from
    // scratch every time even within the same session. This gives the
    // client-side Router Cache a real stale-while-revalidate window: a
    // page visited in the last 30s renders instantly from cache while
    // Next quietly refetches behind it, matching how a static route
    // already behaves by default (staleTimes.static, unchanged here).
    staleTimes: {
      dynamic: 30,
      static: 180,
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
