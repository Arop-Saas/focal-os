"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { MapPin, Loader2, Pencil } from "lucide-react";

/**
 * Client address, editable via the Google Places autocomplete (same flow as
 * onboarding). Selecting a suggestion fills street/city/state/zip and saves.
 */
export function ClientAddressCard({
  clientId,
  initial,
}: {
  clientId: string;
  initial: { addressLine1: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");

  const update = trpc.clients.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      setQuery("");
      router.refresh();
    },
  });

  const display = [initial.addressLine1, initial.city, initial.state, initial.postalCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="md:col-span-2">
      <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        <MapPin className="h-3 w-3" /> Address
        {update.isPending && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
      </p>
      {editing ? (
        <div className="space-y-1.5">
          <AddressAutocomplete
            value={query}
            onChange={setQuery}
            onSelect={(r) =>
              update.mutate({
                id: clientId,
                addressLine1: r.streetAddress,
                city: r.city || undefined,
                state: r.state || undefined,
                postalCode: r.zip || undefined,
              })
            }
            placeholder="Search for the address…"
          />
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
            {update.error && <p className="text-xs text-red-600">{update.error.message}</p>}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-center gap-2 text-left text-sm text-gray-900"
        >
          {display || <span className="text-gray-400">Add an address</span>}
          <Pencil className="h-3 w-3 text-gray-300 transition-colors group-hover:text-blue-500" />
        </button>
      )}
    </div>
  );
}
