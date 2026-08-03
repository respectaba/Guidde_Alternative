import { NextResponse, type NextRequest } from "next/server";

/**
 * Expose the request pathname to server components (via a request header) so the
 * root layout can render chromeless for /embed (no nav/container in iframes).
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip static assets and API routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
