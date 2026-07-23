import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { CatalogList, type CatalogRow } from "@/components/catalog/catalog-list";

export const metadata = { title: "Services & Pricing" };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const items = await prisma.catalogItem.findMany({
    where: { workspaceId },
    include: {
      currentVersion: true,
      _count: { select: { offerings: true, rules: true, packageComponents: true } },
    },
    orderBy: [{ state: "asc" }, { updatedAt: "desc" }],
  });

  const rows: CatalogRow[] = items.map((i) => ({
    id: i.id,
    role: i.role,
    state: i.state,
    category: i.category,
    name: i.currentVersion?.name ?? "(unnamed)",
    imageUrl: i.currentVersion?.imageUrl ?? null,
    basePrice: i.currentVersion?.basePrice ?? 0,
    pricingMode: i.currentVersion?.pricingMode ?? "FIXED",
    baseDurationMins: i.currentVersion?.baseDurationMins ?? 0,
    visitMode: i.currentVersion?.visitMode ?? "SAME_VISIT",
    fulfillmentMode: i.currentVersion?.fulfillmentMode ?? "ON_SITE",
    offeringCount: i._count.offerings,
    ruleCount: i._count.rules,
    componentCount: i._count.packageComponents,
  }));

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Services & Pricing"
        description={`${rows.filter((r) => r.state === "PUBLISHED").length} published · ${rows.length} total`}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <CatalogList rows={rows} />
      </div>
    </div>
  );
}
