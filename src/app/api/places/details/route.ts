import { NextRequest, NextResponse } from "next/server";

/**
 * Address detail / reverse-geocode via Mapbox Geocoding API (replaces Google Place Details).
 * Accepts either a Mapbox feature ID or lat,lng coordinates.
 */
export async function GET(req: NextRequest) {
  // Support both old placeId param and new Mapbox params
  const placeId = req.nextUrl.searchParams.get("placeId");
  const placeName = req.nextUrl.searchParams.get("placeName");
  const lng = req.nextUrl.searchParams.get("lng");
  const lat = req.nextUrl.searchParams.get("lat");

  if (!placeId && !placeName && !(lng && lat)) {
    return NextResponse.json({ error: "placeId, placeName, or lng+lat required" }, { status: 400 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 });
  }

  // If placeName is provided (full address string from autocomplete), geocode it
  // If lng/lat provided, reverse geocode
  // If placeId, we use placeName as fallback (Mapbox doesn't have a "place details by ID" endpoint)
  let query = placeName || "";
  if (lng && lat) {
    query = `${lng},${lat}`;
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("types", "address");
  url.searchParams.set("limit", "1");
  url.searchParams.set("language", "en");

  const res = await fetch(url.toString());
  const data = await res.json();

  const feature = data.features?.[0];
  if (!feature) {
    return NextResponse.json({
      streetAddress: placeName?.split(",")[0] ?? "",
      city: "",
      state: "",
      zip: "",
      country: "",
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
    });
  }

  // Parse address from Mapbox context array
  const context = feature.context ?? [];
  function getCtx(prefix: string): string {
    const entry = context.find((c: { id: string; text: string; short_code?: string }) => c.id.startsWith(prefix));
    return entry?.text ?? "";
  }
  function getCtxShort(prefix: string): string {
    const entry = context.find((c: { id: string; text: string; short_code?: string }) => c.id.startsWith(prefix));
    // Mapbox short_code for region comes as "US-TX", extract "TX"
    const sc = entry?.short_code ?? "";
    return sc.includes("-") ? sc.split("-")[1] : sc;
  }

  // Build street address from feature properties
  const streetNumber = feature.address ?? "";
  const streetName = feature.text ?? "";
  const streetAddress = [streetNumber, streetName].filter(Boolean).join(" ");

  return NextResponse.json({
    streetAddress,
    city: getCtx("place") || getCtx("locality"),
    state: getCtxShort("region") || getCtx("region"),
    zip: getCtx("postcode"),
    country: getCtxShort("country") || getCtx("country"),
    lat: feature.center?.[1] ?? null,
    lng: feature.center?.[0] ?? null,
  });
}
