import { NextRequest, NextResponse } from "next/server";

/**
 * City/region autocomplete via Google Places API v2.
 * Filters for localities (cities, towns) and administrative areas.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 1) {
    return NextResponse.json({ predictions: [] });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Maps API not configured" }, { status: 500 });
  }

  const sessionToken = req.nextUrl.searchParams.get("session") || undefined;

  // Optional ISO 3166-1 alpha-2 country restriction (e.g. "us", "ca")
  const countryParam = req.nextUrl.searchParams.get("country")?.toLowerCase();
  const includedRegionCodes =
    countryParam && /^[a-z]{2}$/.test(countryParam) ? [countryParam] : ["us", "ca"];

  const body: Record<string, unknown> = {
    input: query,
    includedPrimaryTypes: [
      "locality",
      "sublocality",
      "administrative_area_level_3",
      "neighborhood",
    ],
    includedRegionCodes,
    languageCode: "en",
  };
  if (sessionToken) {
    body.sessionToken = sessionToken;
  }

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.warn("[places/cities] Google v2 error:", res.status);
    return NextResponse.json({ predictions: [] });
  }

  const data = await res.json();

  const predictions = (data.suggestions ?? [])
    .filter((s: { placePrediction?: unknown }) => s.placePrediction)
    .map(
      (s: {
        placePrediction: {
          placeId: string;
          text: { text: string };
          structuredFormat: {
            mainText: { text: string };
            secondaryText: { text: string };
          };
        };
      }) => {
        const p = s.placePrediction;
        return {
          placeId: p.placeId,
          name: p.structuredFormat.mainText.text,
          description: p.structuredFormat.secondaryText.text,
          fullText: p.text.text,
        };
      }
    );

  return NextResponse.json({ predictions });
}
