import "server-only";

import logger, { isProdRuntime as isProd } from "@utils/shared/logger";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { validateConfig } from "@utils/server/validate-config";
import { sendSyncJobMessage } from "@utils/server/sqs-client";
import { enforceDDBThrottle, extractClientIp } from "@utils/server/throttle";
import { syncRules } from "@utils/server/throttle-rule";

// Use centralized prod detection (AWS_BRANCH or APP_ENV) to avoid env typos

export async function POST(req) {
  // AuthN
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // must be logged in
  if (!token) {
    return NextResponse.json(
      { type: "auth error", message: "Unauthorized", needRefresh: false },
      { status: 401 },
    );
  }

  // only allow sub google oauth (not allow email login)
  const isGoogleOAuth = token?.provider === "google" && !!token?.providerSub;
  logger.info("Sync request by", {
    uuid: token.uuid,
    provider: token.provider,
    isGoogleOAuth: isGoogleOAuth,
  });
  if (!isGoogleOAuth) {
    return NextResponse.json(
      {
        type: "auth error",
        message: "Only Google OAuth login is allowed to sync",
        needRefresh: false,
      },
      { status: 401 },
    );
  }

  let payload = {};
  try {
    const text = await req.text();
    payload = text ? JSON.parse(text) : {};
  } catch (e) {
    logger.error("Body parse error", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { type: "parse error", message: "Invalid JSON body", needRefresh: false },
      { status: 400 },
    );
  }

  const uuid = payload?.uuid;
  if (typeof uuid !== "string" || uuid.length < 8) {
    return NextResponse.json(
      { type: "validation error", message: "Invalid uuid", needRefresh: false },
      { status: 400 },
    );
  }

  // AuthZ：uuid must be the same as token
  if (uuid !== token.uuid) {
    logger.warn(`UUID mismatch received=${uuid} expected=${token.uuid}`);
    return NextResponse.json(
      { type: "auth error", message: "UUID mismatch", needRefresh: false },
      { status: 403 },
    );
  }
  // Check if notion config exists
  const { valid, response } = await validateConfig(uuid);
  if (!valid) return response;

  // Throttle by IP and by user UUID
  const ip = extractClientIp(req) || null;
  if (!ip) {
    return NextResponse.json(
      { success: false, error: "Unable to determine client IP" },
      { status: 400 },
    );
  }

  // Only enforce throttle in production environment

  const throttleResult = await enforceDDBThrottle(
    syncRules(ip, uuid, token.role),
  );
  if (throttleResult) {
    return NextResponse.json(
      {
        type: "throttle error",
        message: throttleResult.body.error,
        needRefresh: false,
      },
      { status: throttleResult.status },
    );
  }

  const timestamp = new Date().toISOString();
  try {
    // todo actionType enum -t, -n, -g
    // the sync should follow by timestamp, notion (overwrite gcal events), gcal (overwrite notion tasks)
    const action = "user.sync";
    const source = "NOTICA";

    const res = await sendSyncJobMessage({ action, uuid, timestamp, source });
    const messageId = res?.MessageId || res?.MessageID || res?.messageId;

    if (!messageId) {
      throw new Error("SQS enqueue returned no MessageId");
    }

    logger.info(`Sync enqueued`, {
      uuid,
      messageId,
      action,
      source,
      type: "timestamp",
    });

    return NextResponse.json(
      {
        type: "accepted",
        message: "Sync task enqueued",
        needRefresh: false,
        messageId,
      },
      { status: 202 },
    );
  } catch (err) {
    logger.error("Enqueue failed", err);
    return NextResponse.json(
      {
        type: "queue error",
        message: "Internal Server Error",
        needRefresh: false,
      },
      { status: 500 },
    );
  }
}
