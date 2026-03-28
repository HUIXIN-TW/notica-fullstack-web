import "server-only";

import logger from "@utils/shared/logger";
import { getUserById } from "@models/user";
import { getServerSession } from "next-auth";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { isLiveAdmin } from "@utils/server/authz";
import { sanitizeUserForResponse } from "@utils/server/sanitize-user";

export const GET = async (request, { params }) => {
  try {
    // AuthN
    const session = await getServerSession(authOptions);
    if (!session?.user?.uuid) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      });
    }

    // Fetch user by id using the DynamoDB model
    const userId = params.uuid;
    const user = await getUserById(userId);

    // If user not found, return 404
    if (!user) {
      return new Response(JSON.stringify({ message: "User not found" }), {
        status: 404,
      });
    }

    // AuthZ: only the same user (owner) or admin can read
    const canReadAnyUser = await isLiveAdmin(session.user.uuid);
    if (!canReadAnyUser && session.user.uuid !== user.uuid) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
      });
    }

    return new Response(JSON.stringify(sanitizeUserForResponse(user)), {
      status: 200,
    });
  } catch (error) {
    logger.error("Error fetching user", error);
    return new Response("Failed to fetch the user", { status: 500 });
  }
};
