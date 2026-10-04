import type { Metadata } from "next";

import { ChildcareDashboard } from "@/components/childcare/ChildcareDashboard";
import { resolveChildcareCategory } from "@/lib/data/childcare";
import { loadChildcare } from "@/lib/data/load";
import { pageOpenGraph } from "@/lib/site/metadata";

export const metadata: Metadata = {
  title: "子育て支援比較",
  ...pageOpenGraph({
    title: "子育て支援比較 | ひろしまダッシュボード",
    description:
      "広島県23市町の子育て支援制度を、条件・基準日・公式出典付きで比較します。",
    path: "/childcare",
  }),
};

export default async function ChildcarePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [data, resolvedSearchParams] = await Promise.all([
    loadChildcare(),
    searchParams,
  ]);
  return (
    <ChildcareDashboard
      data={data}
      selectedCategory={resolveChildcareCategory(resolvedSearchParams.category)}
    />
  );
}
