"use client";

export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";

function SuccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceSlug = params?.workspaceSlug as string;

  const jobNumber = searchParams?.get("job") ?? "";
  const clientName = searchParams?.get("name") ?? "";
  const dateStr = searchParams?.get("date") ?? "";

  let formattedDate = dateStr;
  try {
    if (dateStr) {
      formattedDate = format(new Date(dateStr), "EEEE, MMMM d, yyyy 'at' h:mm aa");
    }
  } catch {
    // keep raw string if parse fails
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 sm:p-12 max-w-md w-full text-center">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked!</h1>
        <p className="text-gray-500 text-sm mb-6">
          {clientName ? `Thanks, ${clientName.split(" ")[0]}!` : "Thanks!"} Your appointment has been confirmed. Check your inbox for a confirmation email.
        </p>

        {/* Details card */}
        <div className="bg-gray-50 rounded-xl p-4 text-left space-y-3 mb-6">
          {jobNumber && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Booking #</span>
              <span className="font-semibold text-gray-900">{jobNumber}</span>
            </div>
          )}
          {formattedDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Appointment</span>
              <span className="font-semibold text-gray-900 text-right max-w-[60%]">{formattedDate}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Status</span>
            <span className="text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full text-xs">Pending confirmation</span>
          </div>
        </div>

        {/* What's next */}
        <div className="text-left space-y-2 mb-8">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">What happens next</p>
          <div className="space-y-2">
            {[
              "We'll review your booking and confirm it shortly.",
              "You'll receive a reminder email 24 hours before the shoot.",
              "Our photographer will arrive at the property at your scheduled time.",
              "Edited photos are typically delivered within 24–48 hours.",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="w-5 h-5 shrink-0 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <a
          href={`/book/${workspaceSlug}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Book another shoot →
        </a>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">Powered by FocalOS</p>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
