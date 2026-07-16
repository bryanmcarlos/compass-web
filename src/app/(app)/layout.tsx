import type { ReactNode } from "react";
import { Layout } from "@/components/club/Layout";

export default function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
