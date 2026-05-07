import { NextRequest, NextResponse } from "next/server";

/**
 * Address autocomplete via Google Places API (New) — v2.
 * Uses POST to places.googleapis.com/v1/places:autocomplete
 * with session tokens for billing optimization.
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

  // Session token passed from client (groups suggest + detail into one billable session)
  const sessionToken = req.nextUrl.searchParams.get("session") || undefined;

  const body: Record<string, unknown> = {
    input: query,
    includedPrimaryTypes: ["street_address", "subpremise", "route", "premise"],
    includedRegionCodes: ["us", "ca"],
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
    console.warn("[places/autocomplete] Google v2 error:", res.status);
    return NextResponse.json({ predictions: [] });
  }

  const data = await res.json();

  const predictions = (data.suggestions ?? [])
    .filter((s: { placePrediction?: unknown }) => s.placePrediction)
    .map((s: {
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
        description: p.text.text,
        mainText: p.structuredFormat.mainText.text,
        secondaryText: p.structuredFormat.secondaryText.text,
      };
    });

  return NextResponse.json({ predictions });
}
