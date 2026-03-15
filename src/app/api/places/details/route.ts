import { NextRequest, NextResponse } from "next/server";

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Maps API not configured" }, { status: 500 });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "address_components,formatted_address");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  const data = await res.json();

  const components: AddressComponent[] = data.result?.address_components ?? [];

  function get(type: string, useShort = false) {
    const c = components.find((c) => c.types.includes(type));
    return c ? (useShort ? c.short_name : c.long_name) : "";
  }

  // Build street address from street number + route
  const streetNumber = get("street_number");
  const route = get("route");
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ");

  return NextResponse.json({
    streetAddress,
    city: get("locality") || get("sublocality") || get("neighborhood"),
    state: get("administrative_area_level_1", true), // short = "TX"
    zip: get("postal_code"),
    country: get("country", true),
  });
}
