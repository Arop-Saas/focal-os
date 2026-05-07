import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { BookingSuccessContent } from "./success-content";

export const dynamic = "force-dynamic";

interface Props {
  params: { workspaceSlug: string };
  searchParams: { job?: string; name?: string; date?: string; pkg?: string; confirmed?: string };
}

export default async function BookingSuccessPage({ params, searchParams }: Props) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    select: { name: true, logoUrl: true, brandColor: true, email: true },
  });

  return (
    <Suspense>
      <BookingSuccessContent
        workspaceSlug={params.workspaceSlug}
        workspaceName={workspace?.name ?? "Your Studio"}
        logoUrl={workspace?.logoUrl ?? null}
        brandColor={workspace?.brandColor ?? "#3B82F6"}
        studioEmail={workspace?.email ?? null}
        jobNumber={searchParams.job ?? ""}
        clientName={searchParams.name ?? ""}
        dateStr={searchParams.date ?? ""}
        packageName={searchParams.pkg ?? ""}
        confirmed={searchParams.confirmed === "true"}
      />
    </Suspense>
  );
}
