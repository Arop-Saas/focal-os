import { NextRequest, NextResponse } from "next/server";

/**
 * Address details via Mapbox Search Box API (retrieve endpoint).
 * Fetches full address components + coordinates for a selected suggestion.
 */
export async function GET(req: NextRequest) {
  const mapboxId = req.nextUrl.searchParams.get("placeId") || req.nextUrl.searchParams.get("mapboxId");
  const sessionToken = req.nextUrl.searchParams.get("session") || crypto.randomUUID();

  if (!mapboxId) {
    return NextResponse.json({ error: "placeId/mapboxId required" }, { status: 400 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 });
  }

  const url = new URL(`https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("session_token", sessionToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.warn("[places/details] Mapbox retrieve error:", res.status);
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
  const feature = data.features?.[0];

  if (!feature) {
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

  const props = feature.properties || {};
  const ctx = props.context || {};

  // Build street address from Mapbox properties
  const streetAddress = props.address
    ? `${props.address} ${props.name || ""}`.trim()
    : props.full_address?.split(",")[0] || props.name || "";

  return NextResponse.json({
    streetAddress,
    city: ctx.place?.name || ctx.locality?.name || "",
    state: ctx.region?.region_code || ctx.region?.name || "",
    zip: ctx.postcode?.name || "",
    country: ctx.country?.country_code?.toUpperCase() || ctx.country?.name || "",
    lat: feature.geometry?.coordinates?.[1] ?? null,
    lng: feature.geometry?.coordinates?.[0] ?? null,
  });
}
