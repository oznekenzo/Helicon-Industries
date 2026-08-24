import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasValidBasicAuthorization } from "./lib/basic-auth";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export function proxy(request: NextRequest): NextResponse {
  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return new NextResponse("Authentication is not configured.", {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }

  if (
    !hasValidBasicAuthorization(request.headers.get("authorization"), {
      username,
      password,
    })
  ) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        ...NO_STORE_HEADERS,
        "WWW-Authenticate": 'Basic realm="Helicon Industries", charset="UTF-8"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)"],
};
