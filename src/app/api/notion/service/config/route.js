import "server-only";

import logger from "@utils/shared/logger";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getNotionConfigByUuid, updateNotionConfigByUuid } from "@models/user";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { getLiveUserByUuid } from "@utils/server/authz";
import { enforceTrustedOrigin } from "@utils/server/csrf";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  const uuid = session?.user?.uuid;

  if (!uuid) {
    return new Response(
      JSON.stringify({
        type: "unauthorized",
        message: "Unauthorized",
      }),
      { status: 401 },
    );
  }

  const liveUser = await getLiveUserByUuid(uuid);
  if (!liveUser) {
    return new Response(
      JSON.stringify({
        type: "unauthorized",
        message: "Unauthorized",
      }),
      { status: 401 },
    );
  }

  try {
    const config = await getNotionConfigByUuid(uuid);

    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Failed to load config" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const csrfResponse = enforceTrustedOrigin(req);
  if (csrfResponse) return csrfResponse;

  const session = await getServerSession(authOptions);
  const uuid = session?.user?.uuid;

  if (!uuid) {
    return new Response(
      JSON.stringify({
        type: "unauthorized",
        message: "Unauthorized",
      }),
      { status: 401 },
    );
  }

  const liveUser = await getLiveUserByUuid(uuid);
  if (!liveUser) {
    return new Response(
      JSON.stringify({
        type: "unauthorized",
        message: "Unauthorized",
      }),
      { status: 401 },
    );
  }

  let incomingConfig;
  try {
    incomingConfig = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        type: "error",
        message: "Invalid JSON payload",
      }),
      { status: 400 },
    );
  }

  if (!incomingConfig || typeof incomingConfig !== "object") {
    return new Response(
      JSON.stringify({
        type: "error",
        message: "Invalid config format",
      }),
      { status: 400 },
    );
  }

  // Basic validation of required fields
  if (!incomingConfig.database_id) {
    return new Response(
      JSON.stringify({
        type: "error",
        message: "Missing required config fields: database id",
      }),
      { status: 400 },
    );
  }

  let mergedConfig = { ...incomingConfig };

  try {
    await updateNotionConfigByUuid(uuid, mergedConfig);
    return new Response(
      JSON.stringify({
        type: "success",
        message: "updated successfully",
        uuid,
      }),
      { status: 200 },
    );
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      return new Response(
        JSON.stringify({
          type: "unauthorized",
          message: "Unauthorized",
        }),
        { status: 401 },
      );
    }
    logger.error("Failed to update config", err);
    return new Response(
      JSON.stringify({
        type: "error",
        message: "Failed to update config",
      }),
      { status: 500 },
    );
  }
}
