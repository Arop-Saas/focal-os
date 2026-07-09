import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Routes that don't require auth
const publicRoutes = [
  "/",             // Landing page — always public
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/confirm-email",
  "/verify",
  "/api/webhooks",
  "/gallery",      // Public gallery share links (legacy)
  "/g",            // Public gallery share links (short URLs used in emails)
  "/book",         // Public client booking form
  "/privacy",      // Legal pages — must be public (linked from signup)
  "/terms",
  "/feedback",     // Public feedback board
  "/portal",       // Client portal (self-auth via magic link)
  "/api/portal",   // Portal API routes (login, verify, logout)
  "/mobile/login", // Photographer mobile app login
  "/invite",       // Staff invite acceptance pages
  "/api/staff/accept-invite", // Accept invite API
  "/api/trpc",     // tRPC API (auth handled by tRPC context, not middleware)
  "/pay",          // Direct invoice payment page (public link from email)
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes through
  // "/" is an exact match; everything else uses startsWith
  const isPublic = publicRoutes.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    // Mobile routes redirect to the mobile login page
    if (pathname.startsWith("/mobile")) {
      return NextResponse.redirect(new URL("/mobile/login", request.url));
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth/landing pages into the dashboard
  if (user && (pathname === "/" || pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/overview", request.url));
  }

  // Forward the current pathname so server layouts can read it
  response.headers.set("x-pathname", pathname);

  // Add workspace slug from subdomain or path header for multi-tenancy
  const host = request.headers.get("host") ?? "";
  const subdomain = host.split(".")[0];
  if (subdomain && subdomain !== "www" && subdomain !== "app") {
    response.headers.set("x-workspace-slug", subdomain);
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude static assets AND /api/trpc routes (tRPC handles its own auth
    // via Bearer tokens — middleware rewrites strip the Authorization header)
    "/((?!_next/static|_next/image|favicon.ico|api/trpc|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
