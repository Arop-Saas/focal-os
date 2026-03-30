"use client";

import { useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { AvailabilityEditor } from "./availability-editor";
import { TerritoriesManager } from "@/components/territories/territories-manager";

interface DayHours {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface Territory {
  id: string;
  name: string;
  color: string;
  description: string | null;
  cities: string | null;
}

interface Props {
  initialHours: DayHours[];
  initialTerritories: Territory[];
}

const TABS = [
  { key: "hours", label: "Business Hours", icon: Clock },
  { key: "territories", label: "Territories", icon: MapPin },
];

export function AvailabilityTabs({ initialHours, initialTerritories }: Props) {
  const [activeTab, setActiveTab] = useState<"hours" | "territories">("hours");

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white border rounded-xl p-1 w-fit">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as "hours" | "territories")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "hours" ? (
        <AvailabilityEditor initialHours={initialHours} />
      ) : (
        <TerritoriesManager initialTerritories={initialTerritories} />
      )}
    </div>
  );
}
