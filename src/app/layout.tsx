import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getAppSettings } from "@/lib/appSettings";
import { ThemeSettingsProvider } from "@/components/club/ThemeSettingsProvider";
import { CLUB_CONFIG } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: CLUB_CONFIG.metadata.name,
  description: CLUB_CONFIG.metadata.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { primaryColor, logoUrl } = await getAppSettings();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full max-w-full overflow-x-hidden antialiased`}
      style={{ "--color-primary": primaryColor } as React.CSSProperties}
    >
      {/* This is a backstop, not the fix — it clips whatever still manages
          to overflow rather than addressing why. The actual cause on trip
          report pages was missing overflow-wrap handling on markdown-
          rendered free text (see TripReportCard), fixed separately. Keeping
          this here too as defense against the next long-unbroken-string
          surprise, since new user-generated text fields will keep showing
          up in this app. */}
      <body className="flex min-h-full max-w-full flex-col overflow-x-hidden">
        <ThemeSettingsProvider logoUrl={logoUrl}>
          {children}
        </ThemeSettingsProvider>
      </body>
    </html>
  );
}
