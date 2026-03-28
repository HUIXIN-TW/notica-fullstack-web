import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { updateGoogleTokens } from "@models/google-token";
import { getLiveUserByUuid } from "@utils/server/authz";
import logger from "@utils/shared/logger";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function clearGoogleOAuthCookies(res) {
  res.cookies.set("google_oauth_state", "", { maxAge: 0, path: "/" });
  res.cookies.set("google_code_verifier", "", { maxAge: 0, path: "/" });
}

export async function GET(req) {
  const url = new URL(req.url);
  const BaseUrl = process.env.NEXTAUTH_URL;
  if (!BaseUrl) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthErr = url.searchParams.get("error");
  const redirectTarget = "/getting-started";

  // 1) OAuth error / no code
  if (oauthErr || !code) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=error`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  }

  // 2) verify session
  const session = await getServerSession(authOptions);
  if (!session?.user?.uuid || !session?.user?.email) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=error&reason=unauthorized`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  }
  const liveUser = await getLiveUserByUuid(session.user.uuid);
  if (!liveUser?.email) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=error&reason=unauthorized`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  }
  const allowedEmail = liveUser.email.toLowerCase();

  // 3) verify state & code_verifier
  const cookieJar = await cookies();
  const expectedState = cookieJar.get("google_oauth_state")?.value || "";
  const codeVerifier = cookieJar.get("google_code_verifier")?.value || "";

  if (!returnedState || returnedState !== expectedState || !codeVerifier) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=error&reason=state`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  }

  const [uuid] = returnedState.split(":");
  if (!uuid || uuid !== session.user.uuid) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=error&reason=uuid`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  }

  try {
    // 4) exchange token
    const tokenBody = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: `${BaseUrl}/api/google/callback`,
    });

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody,
    });

    logger.debug("Google token exchange response received", {
      status: tokenResp.status,
    });

    if (!tokenResp.ok) {
      await tokenResp.text();
      logger.error("Google token exchange failed", {
        status: tokenResp.status,
      });
      const res = NextResponse.redirect(
        new URL(`${redirectTarget}?google=error&reason=token`, BaseUrl),
      );
      clearGoogleOAuthCookies(res);
      return res;
    }

    const tokenPayload = await tokenResp.json();

    // 5) fetch userinfo
    const uiResp = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
      },
    );
    logger.debug("Google userinfo response received", {
      status: uiResp.status,
    });
    const profile = await uiResp.json();

    if (!uiResp.ok) {
      logger.error("Failed to fetch userinfo", {
        status: uiResp.status,
      });
      const res = NextResponse.redirect(
        new URL(`${redirectTarget}?google=error&reason=userinfo`, BaseUrl),
      );
      clearGoogleOAuthCookies(res);
      return res;
    }

    const googleEmail = (profile.email || "").toLowerCase();
    if (googleEmail !== allowedEmail) {
      logger.warn("Email mismatch during Google OAuth callback");
      const res = NextResponse.redirect(
        new URL(
          `${redirectTarget}?google=error&reason=email_mismatch`,
          BaseUrl,
        ),
      );
      clearGoogleOAuthCookies(res);
      return res;
    }

    // 6) save tokens
    await updateGoogleTokens(
      uuid,
      tokenPayload.access_token,
      tokenPayload.refresh_token,
      Date.now() + (tokenPayload.expires_in || 0) * 1000,
      Date.now(),
    );
    logger.debug("Stored Google OAuth tokens for session user");

    // 7) success: clean cookies & redirect
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=connected`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  } catch (e) {
    logger.error("OAuth callback error", {
      message: e?.message,
    });
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?google=error&reason=server`, BaseUrl),
    );
    clearGoogleOAuthCookies(res);
    return res;
  }
}
