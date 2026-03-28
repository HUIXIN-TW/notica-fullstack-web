import "server-only";

import logger from "@utils/shared/logger";
import { getUserById } from "@models/user";
import { getServerSession } from "next-auth";
import { authOptions } from "@api/auth/[...nextauth]/route";
import { sanitizeUserForResponse } from "@utils/server/sanitize-user";

export const GET = async (request) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.uuid) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
      });
    }

    const uuid = session.user.uuid;
    if (!uuid || typeof uuid !== "string") {
      return new Response(JSON.stringify({ message: "Invalid token" }), {
        status: 400,
      });
    }

    const user = await getUserById(uuid);
    if (!user) {
      return new Response(JSON.stringify({ message: "User not found" }), {
        status: 404,
      });
    }

    return new Response(JSON.stringify(sanitizeUserForResponse(user)), {
      status: 200,
    });
  } catch (error) {
    logger.error("Error fetching current user", error);
    return new Response("Failed to fetch the current user", { status: 500 });
  }
};
