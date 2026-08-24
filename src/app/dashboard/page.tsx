import type { Metadata } from "next";
import { unstable_cache } from "next/cache";

import { ControlTowerScreen } from "@/features/control-tower/components/control-tower-screen";
import { getControlTowerPageData } from "@/features/control-tower/data";
import { createDatabase } from "@db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Tower | Helicon Industries",
};

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured.");
  return value;
}

const getCachedControlTowerData = unstable_cache(
  async () => {
    const { client, db } = createDatabase(connectionString());
    try {
      return await getControlTowerPageData(db, "la_01");
    } finally {
      await client.end();
    }
  },
  ["control-tower", "la_01"],
  { revalidate: 60, tags: ["control-tower"] },
);

export default async function DashboardPage() {
  const data = await getCachedControlTowerData();
  return <ControlTowerScreen initialData={data} />;
}
