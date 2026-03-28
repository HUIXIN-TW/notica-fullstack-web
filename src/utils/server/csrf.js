import "server-only";

import { NextResponse } from "next/server";

const TRUSTED_ORIGINS = [
  "http://localhost:3000",
  "https://notica.studio",
  "https://www.notica.studio",
];

function addOrigin(origins, urlLike) {
  try {
    origins.add(new URL(urlLike).origin);
  } catch {}
}

function getAllowedOrigins(req) {
  const origins = new Set();

  // Use an explicit first-party allowlist because Amplify/CloudFront can cause
  // `req.url` to differ from the browser `Origin`, even for legitimate
  // same-site traffic.
  for (const origin of TRUSTED_ORIGINS) {
    addOrigin(origins, origin);
  }
  addOrigin(origins, req.url);

  if (process.env.NEXTAUTH_URL) {
    addOrigin(origins, process.env.NEXTAUTH_URL);
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
