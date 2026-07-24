import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/resolve-workspace";
import { Header } from "@/components/layout/header";
import { CatalogList, type CatalogRow } from "@/components/catalog/catalog-list";
import { PricingPanel } from "@/components/catalog/pricing-panel";
import { cn } from "@/lib/utils";

export const metadata = { title: "Services & Pricing" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { section?: string };
}) {
  const supabase = await createClient();
  const { data: { user: supabaseUser } } = await supabase.auth.getUser();
  const workspaceId = await resolveWorkspaceId(supabaseUser!.id);

  const section = searchParams.section === "pricing" ? "pricing" : "services";

  const [items, workspace] = await Promise.all([
    prisma.catalogItem.findMany({
      where: { workspaceId },
      include: {
        currentVersion: true,
        _count: { select: { offerings: true, rules: true, packageComponents: true } },
      },
      orderBy: [{ state: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        pricingRulesEnabled: true,
        defaultTaxRate: true,
        outsideBookingEnabled: true,
        outsideFeeType: true,
        outsideTerritoryFee: true,
        outsidePerKmRate: true,
      },
    }),
  ]);

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
        {/* Section switcher */}
        <div className="mb-4 flex items-center gap-1 border-b">
          {[
            { key: "services", label: "Services", href: "/catalog" },
            { key: "pricing", label: "Pricing", href: "/catalog?section=pricing" },
          ].map((s) => (
            <Link
              key={s.key}
              href={s.href}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                section === s.key
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {section === "pricing" ? (
          <PricingPanel
            initial={{
              pricingRulesEnabled: workspace?.pricingRulesEnabled ?? false,
              defaultTaxRate: workspace?.defaultTaxRate ?? 0,
              outsideBookingEnabled: workspace?.outsideBookingEnabled ?? true,
              outsideFeeType: workspace?.outsideFeeType ?? "flat",
              outsideTerritoryFee: workspace?.outsideTerritoryFee ?? null,
              outsidePerKmRate: workspace?.outsidePerKmRate ?? null,
            }}
          />
        ) : (
          <CatalogList rows={rows} rulesEnabled={workspace?.pricingRulesEnabled ?? false} />
        )}
      </div>
    </div>
  );
}
