import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { getGoogleOAuthClient } from "@utils/server/google-oauth-client";
import { getGoogleTokensByUuid } from "@models/google-token";
import { getLiveUserByUuid } from "@utils/server/authz";
import logger from "@utils/shared/logger";

export async function GET(req) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.uuid) {
    return NextResponse.json(
      { error: "User not authenticated" },
      { status: 401 },
    );
  }

  if (!(await getLiveUserByUuid(session.user.uuid))) {
    return NextResponse.json(
      { error: "User not authenticated" },
      { status: 401 },
    );
  }

  const googleTokens = await getGoogleTokensByUuid(session.user.uuid);

  if (!googleTokens) {
    return NextResponse.json(
      { error: "User not connected to Google" },
      { status: 401 },
    );
  }

  const googleTokensPayload = {
    token: googleTokens.accessToken,
    refresh_token: googleTokens.refreshToken,
    expiry_date: googleTokens.expiryDate,
  };

  // 2) build OAuth client and set credentials
  const googleOAuthClient = getGoogleOAuthClient(); // should return an OAuth2Client
  googleOAuthClient.setCredentials(googleTokensPayload);

  try {
    // 3) create Calendar client
    // If getGoogleOAuthClient already returns a calendar client, adapt accordingly
    const { google } = await import("googleapis");
    const calendar = google.calendar({
      version: "v3",
      auth: googleOAuthClient,
    });

    // 4) list calendars with at least writer access
    const calendarListResponse = await calendar.calendarList.list({
      minAccessRole: "writer",
      showDeleted: false,
      maxResults: 250,
    });

    const calendars = (calendarListResponse.data.items || []).map((c) => ({
      id: c.id,
      name: c.summary,
      accessRole: c.accessRole,
    }));
    logger.debug("Fetched writable Google calendars", {
      count: calendars.length,
    });

    return NextResponse.json({ calendars });
  } catch (error) {
    logger.error("Error fetching Google Calendars:", error);
    return NextResponse.json(
      { error: "Failed to fetch Google Calendars" },
      { status: 500 },
    );
  }
}
