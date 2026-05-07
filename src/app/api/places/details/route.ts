import { NextRequest, NextResponse } from "next/server";

/**
 * Place details via Google Places API (New) — v2.
 * Uses GET to places.googleapis.com/v1/places/{placeId}
 * with X-Goog-FieldMask for efficient billing.
 */
export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Maps API not configured" }, { status: 500 });
  }

  const sessionToken = req.nextUrl.searchParams.get("session") || undefined;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": key,
    "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location",
  };

  // Append session token as query param to close the billing session
  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    console.warn("[places/details] Google v2 error:", res.status);
    return NextResponse.json({
      streetAddress: "",
      city: "",
      state: "",
      zip: "",
      country: "",
      lat: null,
      lng: null,
    });
  }

  const data = await res.json();

  const components: Array<{
    longText: string;
    shortText: string;
    types: string[];
  }> = data.addressComponents ?? [];

  function get(type: string, useShort = false): string {
    const c = components.find((c) => c.types.includes(type));
    return c ? (useShort ? c.shortText : c.longText) : "";
  }

  const streetNumber = get("street_number");
  const route = get("route");
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

  return NextResponse.json({
    streetAddress,
    city: get("locality") || get("sublocality") || get("neighborhood"),
    state: get("administrative_area_level_1", true), // "TX", "AB", etc.
    zip: get("postal_code"),
    country: get("country", true),
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  });
}
