import { NextRequest, NextResponse } from "next/server";

/**
 * Address autocomplete via Mapbox Search Box API (suggest endpoint).
 * Designed for real-time autocomplete — returns suggestions as user types.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 1) {
    return NextResponse.json({ predictions: [] });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 });
  }

  // Use a stable session token per search session (reduces billing cost)
  const sessionToken = req.nextUrl.searchParams.get("session") || crypto.randomUUID();

  const url = new URL("https://api.mapbox.com/search/searchbox/v1/suggest");
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", token);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("language", "en");
  url.searchParams.set("country", "US,CA");
  url.searchParams.set("types", "address,street,place");
  url.searchParams.set("limit", "5");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn("[places/autocomplete] Mapbox suggest error:", res.status);
    return NextResponse.json({ predictions: [] });
  }

  const data = await res.json();

  const predictions = (data.suggestions ?? []).map(
    (s: {
      mapbox_id: string;
      name: string;
      full_address?: string;
      address?: string;
      place_formatted?: string;
      context?: {
        place?: { name: string };
        region?: { name: string; region_code?: string };
        postcode?: { name: string };
        country?: { name: string; country_code?: string };
      };
    }) => {
      const mainText = s.full_address?.split(",")[0] || s.name;
      const secondaryText = s.place_formatted || s.full_address?.replace(`${mainText}, `, "") || "";

      return {
        placeId: s.mapbox_id,
        description: s.full_address || `${s.name}, ${s.place_formatted || ""}`,
        mainText,
        secondaryText,
      };
    }
  );

  return NextResponse.json({ predictions, sessionToken });
}
