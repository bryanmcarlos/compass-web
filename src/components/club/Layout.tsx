import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function Layout({
  children,
  isAdmin = false,
  canReviewEquipment = false,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  canReviewEquipment?: boolean;
}) {
  return (
    <div className="min-h-screen bg-off-white text-charcoal">
      <Sidebar isAdmin={isAdmin} canReviewEquipment={canReviewEquipment} />

      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
