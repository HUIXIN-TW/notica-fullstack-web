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

const MIGRATION_FUNCTION_URL =
  "https://oa7jv7b6e2asxbu4omu333st6i0oqckz.lambda-url.ap-southeast-2.on.aws/";

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

async function invokeMigrationLambda(functionUrl) {
  const url = new URL(functionUrl);
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

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: signed.headers,
    cache: "no-store",
  });

  return response;
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

    const upstream = await invokeMigrationLambda(MIGRATION_FUNCTION_URL);
    if (!upstream.ok) {
      const detail = await upstream.text();
      return NextResponse.json(
        {
          error: "Migration lambda request failed",
          statusCode: upstream.status,
          detail,
        },
        { status: 502 },
      );
    }

    const payload = await upstream.json();
    return NextResponse.json(payload, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
