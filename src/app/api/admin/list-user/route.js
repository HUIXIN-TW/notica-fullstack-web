import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { getAllUsers } from "@models/user";
import { isLiveAdmin } from "@utils/server/authz";
import { sanitizeUsersForResponse } from "@utils/server/sanitize-user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isLiveAdmin(session.user?.uuid)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const users = await getAllUsers();
    users.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

    return NextResponse.json(
      { users: sanitizeUsersForResponse(users) },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
