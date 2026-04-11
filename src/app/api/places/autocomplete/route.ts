import { NextRequest, NextResponse } from "next/server";

/**
 * Address autocomplete via Mapbox Geocoding API (replaces Google Places).
 * Server-side proxy to keep the access token off the client.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 });
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("types", "address");
  url.searchParams.set("country", "us,ca");
  url.searchParams.set("limit", "5");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  const data = await res.json();

  const predictions = (data.features ?? []).map(
    (f: {
      id: string;
      place_name: string;
      text: string;
      context?: Array<{ id: string; text: string; short_code?: string }>;
      center: [number, number]; // [lng, lat]
    }) => {
      // mainText = street address portion, secondaryText = city/state
      const mainText = f.text;
      const contextParts = (f.context ?? [])
        .filter((c) => c.id.startsWith("place") || c.id.startsWith("region"))
        .map((c) => c.text);
      const secondaryText = contextParts.join(", ") || f.place_name.replace(`${f.text}, `, "");

      return {
        placeId: f.id,
        description: f.place_name,
        mainText: f.place_name.split(",")[0] || mainText,
        secondaryText,
        center: f.center, // pass through for detail fetch
      };
    }
  );

  return NextResponse.json({ predictions });
}
