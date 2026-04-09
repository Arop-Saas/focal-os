"use client";

import { MapboxMap } from "@/components/shared/mapbox-map";

interface JobPropertyMapProps {
  lat?: number | null;
  lng?: number | null;
  address?: string;
}

/**
 * Renders a Mapbox map preview of the property location on the job detail page.
 * Only renders when lat/lng are available (populated from Google Places on booking).
 */
export function JobPropertyMap({ lat, lng, address }: JobPropertyMapProps) {
  if (!lat || !lng) return null;

  return (
    <div className="mt-4">
      <MapboxMap
        center={{ lat, lng }}
        markers={[
          {
            lat,
            lng,
            color: "#3B82F6",
            popupHtml: address
              ? `<div style="font-size:13px;font-weight:500;">${address}</div>`
              : undefined,
          },
        ]}
        height={200}
        zoom={15}
        showControls={true}
        interactive={true}
      />
    </div>
  );
}
