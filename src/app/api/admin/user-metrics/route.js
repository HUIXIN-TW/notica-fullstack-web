import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { getDailyUserCountsLast14 } from "@models/user";
import { isLiveAdmin } from "@utils/server/authz";

export async function GET() {
  try {
    // 1. get session
    const session = await getServerSession(authOptions);

    // 2. verify session
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    // 3. verify user role
    if (!(await isLiveAdmin(session.user?.uuid))) {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 },
      );
    }

    // 4. execute main query
    const data = await getDailyUserCountsLast14();
    return NextResponse.json(data); // [{ createdAt: "YYYY-MM-DD", count: N }, ...]
  } catch (err) {
    console.error("Error fetching user metrics:", err);
    return NextResponse.json(
      { error: "Internal Server Error", detail: err.message },
      { status: 500 },
    );
  }
}
