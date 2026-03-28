import "server-only";

import logger from "@utils/shared/logger";
import { getAllUsers } from "@models/user";
import { getServerSession } from "next-auth";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { isLiveAdmin } from "@utils/server/authz";
import { sanitizeUsersForResponse } from "@utils/server/sanitize-user";

export const GET = async (request) => {
  try {
    // AuthN: require a valid session token
    const session = await getServerSession(authOptions);
    if (!session?.user?.uuid) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      });
    }

    // AuthZ: only admin can list all users
    if (!(await isLiveAdmin(session.user.uuid))) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
      });
    }

    // Fetch all users using the DynamoDB model
    const users = await getAllUsers();
    const safeUsers = sanitizeUsersForResponse(users);

    return new Response(JSON.stringify(safeUsers), { status: 200 });
  } catch (error) {
    logger.error("Error fetching users", error);
    return new Response("Failed to fetch all users", { status: 500 });
  }
};
