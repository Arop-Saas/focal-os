"use client";

import { formatCurrency } from "@/lib/utils";

interface TopClientsProps {
  data: Array<{
    name: string;
    email: string;
    revenue: number;
    jobCount: number;
  }>;
}

export function TopClients({ data }: TopClientsProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No paid invoices yet
      </div>
    );
  }

  const maxRevenue = data[0]?.revenue ?? 1;

  return (
    <div className="space-y-3">
      {data.map((client, i) => (
        <div key={client.email} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500">
                {i + 1}
              </span>
              <span className="font-medium text-gray-800 truncate">{client.name}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {client.jobCount} job{client.jobCount !== 1 ? "s" : ""}
              </span>
            </div>
            <span className="font-semibold text-gray-900 tabular-nums shrink-0 ml-2">
              {formatCurrency(client.revenue)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${(client.revenue / maxRevenue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
