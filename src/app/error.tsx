"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-7xl font-black text-gray-200 select-none">500</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        An unexpected error occurred. Our team has been notified. Please try again.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Go home
        </a>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-gray-300">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
