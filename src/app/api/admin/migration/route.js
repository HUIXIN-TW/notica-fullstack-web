import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { Sha256 } from "@aws-crypto/sha256-js";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { isLiveAdmin } from "@utils/server/authz";

export const dynamic = "force-dynamic";

const MIGRATION_FUNCTION_URL = process.env.WEB_DETECTIVE_MIGRATION_FUNCTION_URL;

function parseLambdaUrlRegion(url) {
  const match = url.hostname.match(/\.lambda-url\.([a-z0-9-]+)\.on\.aws$/);
  return match?.[1] || null;
}

function normalizeQuery(searchParams) {
  const query = {};
  for (const [key, value] of searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const current = query[key];
      query[key] = Array.isArray(current)
        ? [...current, value]
        : [current, value];
      continue;
    }
    query[key] = value;
  }
  return query;
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeMonthValues(payload) {
  const normalized = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    normalized[key] = toNumber(value);
  });
  return normalized;
}

function normalizeMigrationPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid migration payload: expected object");
  }

  if (!payload.months || typeof payload.months !== "object") {
    throw new Error("Invalid migration payload: missing months");
  }

  if (!Array.isArray(payload.pdfLinks)) {
    throw new Error("Invalid migration payload: missing pdfLinks");
  }

  return {
    months: normalizeMonthValues(payload.months),
    pdfLinks: payload.pdfLinks,
    pdfCount:
      typeof payload.pdfCount === "number" && Number.isFinite(payload.pdfCount)
        ? payload.pdfCount
        : payload.pdfLinks.length,
    pdfSourceUrl:
      typeof payload.pdfSourceUrl === "string" && payload.pdfSourceUrl
        ? payload.pdfSourceUrl
        : null,
  };
}

async function invokeMigrationLambda(functionUrl, mode = null) {
  const url = new URL(functionUrl);
  if (mode) {
    url.searchParams.set("mode", mode);
  }

  const region = parseLambdaUrlRegion(url) || process.env.AWS_REGION;
  if (!region) {
    throw new Error(
      "Cannot resolve AWS region for WEB_DETECTIVE_MIGRATION_FUNCTION_URL.",
    );
  }

  const signer = new SignatureV4({
    credentials: defaultProvider(),
    region,
    service: "lambda",
    sha256: Sha256,
  });

  const signed = await signer.sign(
    new HttpRequest({
      method: "GET",
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname || "/",
      query: normalizeQuery(url.searchParams),
      headers: {
        host: url.hostname,
      },
    }),
  );

  return fetch(url.toString(), {
    method: "GET",
    headers: signed.headers,
    cache: "no-store",
  });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isLiveAdmin(session.user?.uuid)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!MIGRATION_FUNCTION_URL) {
      return NextResponse.json(
        { error: "Missing WEB_DETECTIVE_MIGRATION_FUNCTION_URL" },
        { status: 500 },
      );
    }

    const upstream = await invokeMigrationLambda(MIGRATION_FUNCTION_URL, "all");
    if (!upstream.ok) {
      const detail = await upstream.text();
      const responseStatus =
        upstream.status === 401 || upstream.status === 403
          ? upstream.status
          : 502;
      return NextResponse.json(
        {
          error: "Migration lambda request failed",
          mode: "all",
          upstreamStatus: upstream.status,
          detail,
        },
        { status: responseStatus },
      );
    }

    const payload = await upstream.json();
    const normalized = normalizeMigrationPayload(payload);

    return NextResponse.json(
      {
        months: normalized.months,
        pdfLinks: normalized.pdfLinks,
        pdfCount: normalized.pdfCount,
        pdfSourceUrl: normalized.pdfSourceUrl,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
