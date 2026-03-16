"use client";

import { format } from "date-fns";

interface Props {
  workspaceSlug: string;
  workspaceName: string;
  logoUrl: string | null;
  brandColor: string;
  studioEmail: string | null;
  jobNumber: string;
  clientName: string;
  dateStr: string;
  packageName: string;
}

export function BookingSuccessContent({
  workspaceSlug,
  workspaceName,
  logoUrl,
  brandColor,
  studioEmail,
  jobNumber,
  clientName,
  dateStr,
  packageName,
}: Props) {
  let formattedDate = dateStr;
  try {
    if (dateStr) formattedDate = format(new Date(dateStr), "EEEE, MMMM d, yyyy 'at' h:mm aa");
  } catch { /* keep raw */ }

  const firstName = clientName ? clientName.split(" ")[0] : null;
  const initial = workspaceName[0]?.toUpperCase() ?? "S";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Brand accent bar */}
      <div className="h-1 w-full" style={{ backgroundColor: brandColor }} />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-10 max-w-md w-full">

          {/* Studio logo / name */}
          <div className="flex justify-center mb-6">
            {logoUrl ? (
              <img src={logoUrl} alt={workspaceName} className="h-12 object-contain" />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: brandColor }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Success checkmark */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: brandColor + "20" }}
          >
            <svg
              className="w-8 h-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              style={{ color: brandColor }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
            You&apos;re booked!
          </h1>
          <p className="text-gray-500 text-sm text-center mb-6">
            {firstName ? `Thanks, ${firstName}! ` : "Thanks! "}
            {workspaceName} will be in touch to confirm your appointment.
          </p>

          {/* Details card */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-6">
            {jobNumber && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Booking #</span>
                <span className="font-semibold text-gray-900">{jobNumber}</span>
              </div>
            )}
            {packageName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Package</span>
                <span className="font-semibold text-gray-900 text-right max-w-[60%]">{packageName}</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex justify-between text-sm gap-4">
                <span className="text-gray-500 shrink-0">Appointment</span>
                <span className="font-semibold text-gray-900 text-right">{formattedDate}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status</span>
              <span
                className="font-semibold text-xs px-2.5 py-1 rounded-full"
                style={{ backgroundColor: brandColor + "18", color: brandColor }}
              >
                Pending confirmation
              </span>
            </div>
          </div>

          {/* What's next */}
          <div className="space-y-2 mb-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              What happens next
            </p>
            {[
              `${workspaceName} will review and confirm your booking shortly.`,
              "You'll receive a confirmation email with all the details.",
              "Our photographer will arrive at the scheduled time.",
              "Edited photos are typically delivered within 24–48 hours.",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-sm text-gray-600">
                <span
                  className="w-5 h-5 shrink-0 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {i + 1}
                </span>
                {item}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={`/book/${workspaceSlug}`}
              className="text-center text-sm font-medium py-2.5 px-4 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              Book another shoot
            </a>
            {studioEmail && (
              <a
                href={`mailto:${studioEmail}`}
                className="text-center text-sm text-gray-500 hover:text-gray-700 py-1"
              >
                Questions? Contact {workspaceName}
              </a>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6 text-center">{workspaceName}</p>
      </div>
    </div>
  );
}
