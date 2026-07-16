"use client";

import { createContext, useContext, type ReactNode } from "react";

type ThemeSettings = {
  /** Admin-uploaded logo URL, or null to use the bundled default marks. */
  logoUrl: string | null;
};

const ThemeSettingsContext = createContext<ThemeSettings>({ logoUrl: null });

/** Wraps the app once at the root so any Client Component — regardless of
 * how deep it's nested, or whether its own parent is a Server Component —
 * can read the DB-driven branding fetched once per request in the root
 * layout, instead of every consumer re-querying `app_settings` itself. */
export function ThemeSettingsProvider({
  logoUrl,
  children,
}: {
  logoUrl: string | null;
  children: ReactNode;
}) {
  return (
    <ThemeSettingsContext.Provider value={{ logoUrl }}>
      {children}
    </ThemeSettingsContext.Provider>
  );
}

export function useThemeSettings() {
  return useContext(ThemeSettingsContext);
}
