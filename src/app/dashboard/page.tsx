import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import { ControlTowerScreen } from "@/features/control-tower/components/control-tower-screen";
import { getControlTowerPageData } from "@/features/control-tower/data";
import { runDatabaseRead } from "@/lib/runtime-database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Tower | Helicon Industries",
};

const getCachedControlTowerData = unstable_cache(
  () => runDatabaseRead((db) => getControlTowerPageData(db, "la_01")),
  ["control-tower", "la_01"],
  { revalidate: 300, tags: ["control-tower"] },
);

export default async function DashboardPage() {
  const data = await getCachedControlTowerData();
  return <ControlTowerScreen initialData={data} />;
}
