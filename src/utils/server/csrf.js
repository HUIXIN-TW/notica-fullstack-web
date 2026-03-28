import "server-only";

import { NextResponse } from "next/server";

function getAllowedOrigins(req) {
  const origins = new Set();

  try {
    origins.add(new URL(req.url).origin);
  } catch {}

  if (process.env.NEXTAUTH_URL) {
    try {
      origins.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {}
  }

  return origins;
}

export function enforceTrustedOrigin(req) {
  // Notion embed pages render inside a Notion-hosted iframe, but the page
  // running inside that iframe still has this app's origin. Requests from the
  // embedded page to this app's own `/api/*` endpoints therefore remain
  // same-origin from the browser's perspective and should pass this check.
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return NextResponse.json(
      { type: "csrf error", message: "Cross-site request rejected" },
      { status: 403 },
    );
  }

  const origin = req.headers.get("origin");
  if (!origin) return null;

  if (!getAllowedOrigins(req).has(origin)) {
    return NextResponse.json(
      { type: "csrf error", message: "Untrusted origin" },
      { status: 403 },
    );
  }

  return null;
}
