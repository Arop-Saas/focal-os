import { Header } from "@/components/layout/header";
import { OrderFormSettings } from "@/components/order-form/order-form-settings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Order Form" };

export default async function OrderFormPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { workspace: { select: { slug: true } } },
  });

  const workspaceSlug = member?.workspace?.slug ?? "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Order Form"
        description="Customize the fields shown on your client-facing booking page"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <OrderFormSettings workspaceSlug={workspaceSlug} />
      </div>
    </div>
  );
}
