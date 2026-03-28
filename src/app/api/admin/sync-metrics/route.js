import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { getSyncCounts, getDailySyncCountsLastNDays } from "@models/sync-logs";
import { isLiveAdmin } from "@utils/server/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isLiveAdmin(session.user?.uuid)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const [{ totalCount }, dailyCounts] = await Promise.all([
      getSyncCounts(),
      getDailySyncCountsLastNDays(7),
    ]);

    return NextResponse.json(
      { totalCount, dailyCounts },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Internal Server Error", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
