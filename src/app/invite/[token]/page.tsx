import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import InviteAcceptForm from "./InviteAcceptForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const invite = await prisma.staffInvite.findUnique({
    where: { token },
    include: { workspace: { select: { name: true, logoUrl: true, brandColor: true } } },
  });

  if (!invite) return notFound();

  // Show expired/used state server-side so no JS needed
  const isExpired = invite.expiresAt < new Date();
  const isUsed = !!invite.usedAt;

  const workspace = invite.workspace;

  const brandColor = workspace.brandColor ?? "#1B4F9E";

  if (isExpired || isUsed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          {workspace.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={workspace.logoUrl} alt={workspace.name} className="h-10 object-contain mx-auto mb-6" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6"
              style={{ background: brandColor }}
            >
              <span className="text-white text-xl">📷</span>
            </div>
          )}
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {isUsed ? "Invite already used" : "Invite link expired"}
          </h1>
          <p className="text-gray-500 text-sm">
            {isUsed
              ? "This invite has already been accepted. You can log in with your existing credentials."
              : "This link has expired. Ask your manager at " + workspace.name + " to send a new invite."}
          </p>
          {isUsed && (
            <a
              href="/mobile/login"
              className="mt-6 inline-block px-6 py-3 rounded-xl text-white text-sm font-semibold"
              style={{ background: brandColor }}
            >
              Go to Login
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-8 py-7" style={{ background: brandColor }}>
            {workspace.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={workspace.logoUrl} alt={workspace.name} className="h-9 object-contain mb-3" />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                <span className="text-white text-xl">📷</span>
              </div>
            )}
            <p className="text-white/70 text-sm">{workspace.name}</p>
          </div>

          {/* Body */}
          <div className="px-8 py-7">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome, {invite.fullName.split(" ")[0]}!
            </h1>
            <p className="text-gray-500 text-sm mb-6">
              Set a password to activate your account and access your jobs.
            </p>

            <InviteAcceptForm
              token={token}
              email={invite.email}
              brandColor={brandColor}
            />
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-4">
          Powered by <span className="font-medium text-gray-500">FocalOS</span>
        </p>
      </div>
    </div>
  );
}
