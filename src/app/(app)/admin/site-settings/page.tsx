import { AdminSettingsForm } from "@/components/club/AdminSettingsForm";
import { getAppSettings } from "@/lib/appSettings";

export default async function AdminSiteSettingsPage() {
  const { primaryColor, logoUrl, defaultDriveBannerUrl } = await getAppSettings();

  return (
    <AdminSettingsForm
      initialPrimaryColor={primaryColor}
      initialLogoUrl={logoUrl}
      initialDefaultBannerUrl={defaultDriveBannerUrl}
    />
  );
}
