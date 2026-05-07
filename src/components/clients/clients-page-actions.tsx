"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { ClientImportModal } from "./client-import-modal";

export function ClientsPageActions() {
  const [showImport, setShowImport] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          Import CSV
        </button>
        <Link
          href="/clients/new"
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Client
        </Link>
      </div>

      {showImport && (
        <ClientImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => setShowImport(false)}
        />
      )}
    </>
  );
}
