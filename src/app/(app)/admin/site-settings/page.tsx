import { AdminSettingsForm } from "@/components/club/AdminSettingsForm";
import { TripReportModerationToggle } from "@/components/club/TripReportModerationToggle";
import { getAppSettings } from "@/lib/appSettings";

export default async function AdminSiteSettingsPage() {
  const { primaryColor, logoUrl, defaultDriveBannerUrl, requireTripReportApproval } =
    await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      <TripReportModerationToggle initialEnabled={requireTripReportApproval} />
      <AdminSettingsForm
        initialPrimaryColor={primaryColor}
        initialLogoUrl={logoUrl}
        initialDefaultBannerUrl={defaultDriveBannerUrl}
      />
    </div>
  );
}
