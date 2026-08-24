import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  AUTH_SESSION_COOKIE,
  getBasicAuthCredentials,
  hasValidAuthSession,
  hasValidBasicAuthorization,
} from "./lib/basic-auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

function redirectWithoutCaching(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const credentials = getBasicAuthCredentials();

  if (!credentials) {
    return new NextResponse("Authentication is not configured.", {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }

  const authenticated =
    hasValidAuthSession(
      request.cookies.get(AUTH_SESSION_COOKIE)?.value,
      credentials,
    ) ||
    hasValidBasicAuthorization(
      request.headers.get("authorization"),
      credentials,
    );

  const isLandingPage = request.nextUrl.pathname === "/";

  if (authenticated) {
    if (
      isLandingPage &&
      request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html")
    ) {
      return redirectWithoutCaching(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (isLandingPage) {
    return NextResponse.next();
  }

  if (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("text/html")
  ) {
    return redirectWithoutCaching(new URL("/", request.url));
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      ...NO_STORE_HEADERS,
      "WWW-Authenticate": 'Basic realm="Helicon Industries", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)"],
};
