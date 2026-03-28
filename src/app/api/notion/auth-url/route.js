import "server-only";

import { isProdRuntime as isProd } from "@utils/shared/logger";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { getLiveUserByUuid } from "@utils/server/authz";

const CLIENT_ID = process.env.NOTION_CLIENT_ID;
const BASEURL = process.env.NEXTAUTH_URL;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.uuid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getLiveUserByUuid(session.user.uuid))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!BASEURL)
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  const redirectUri = `${BASEURL}/api/notion/callback`;
  const state = `${session.user.uuid}:${crypto.randomUUID()}`;

  // Notion authorize URL
  const auth = new URL("https://api.notion.com/v1/oauth/authorize");
  auth.searchParams.set("client_id", CLIENT_ID);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("owner", "user");
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("state", state);

  // Set short-lived httpOnly cookie for CSRF + user binding
  const res = NextResponse.json({ url: auth.toString() });
  res.cookies.set("notion_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
