import "server-only";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { updateNotionTokens } from "@models/notion-token";
import { getLiveUserByUuid } from "@utils/server/authz";
import logger from "@utils/shared/logger";

function clearNotionOAuthCookies(res) {
  res.cookies.set("notion_oauth_state", "", { maxAge: 0, path: "/" });
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
      new URL(`${redirectTarget}?notion=error`, BaseUrl),
    );
    clearNotionOAuthCookies(res);
    return res;
  }

  // 2) verify session
  const session = await getServerSession(authOptions);
  if (!session?.user?.uuid || !session?.user?.email) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?notion=error&reason=unauthorized`, BaseUrl),
    );
    clearNotionOAuthCookies(res);
    return res;
  }
  if (!(await getLiveUserByUuid(session.user.uuid))) {
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?notion=error&reason=unauthorized`, BaseUrl),
    );
    clearNotionOAuthCookies(res);
    return res;
  }

  // 3) verify state
  const cookieJar = await cookies();
  const expectedState = cookieJar.get("notion_oauth_state")?.value ?? "";

  if (!returnedState || returnedState !== expectedState) {
    logger.error("Notion OAuth state mismatch");
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?notion=error&reason=state`, BaseUrl),
    );
    clearNotionOAuthCookies(res);
    return res;
  }

  // 4) check user uuid
  const [userUuid] = returnedState.split(":");
  if (!userUuid || userUuid !== session.user.uuid) {
    logger.error("Missing or mismatched user uuid in Notion OAuth state");
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?notion=error&reason=uuid`, BaseUrl),
    );
    clearNotionOAuthCookies(res);
    return res;
  }

  try {
    // 5) exchange token
    const basic = Buffer.from(
      `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`,
    ).toString("base64");

    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${BaseUrl}/api/notion/callback`,
      }),
    });
    logger.debug("Notion token exchange response received", {
      status: tokenRes.status,
    });

    const tokenJson = await tokenRes.json();

    if (!tokenRes.ok) {
      logger.error("Notion token exchange failed", {
        status: tokenRes.status,
      });
      const res = NextResponse.redirect(
        new URL(`${redirectTarget}?notion=error&reason=token`, BaseUrl),
      );
      clearNotionOAuthCookies(res);
      return res;
    }

    await updateNotionTokens(
      userUuid,
      tokenJson.access_token,
      tokenJson.workspace_id,
      tokenJson.duplicated_template_id,
      Date.now(),
    );
    logger.debug("Stored Notion OAuth tokens for session user");

    // 6) success: clean cookies & redirect
    const res = NextResponse.redirect(
      new URL(
        `${redirectTarget}?notion=connected&workspace=${encodeURIComponent(
          tokenJson.workspace_id || "ok",
        )}`,
        BaseUrl,
      ),
    );
    clearNotionOAuthCookies(res);
    return res;
  } catch (e) {
    logger.error("Notion OAuth callback error", {
      message: e?.message,
    });
    const res = NextResponse.redirect(
      new URL(`${redirectTarget}?notion=error&reason=server`, BaseUrl),
    );
    clearNotionOAuthCookies(res);
    return res;
  }
}
