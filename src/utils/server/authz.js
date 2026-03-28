import "server-only";

import { getUserById } from "@models/user";

export async function getLiveUserByUuid(uuid) {
  if (!uuid || typeof uuid !== "string") return null;
  return getUserById(uuid);
}

export async function getLiveUserRole(uuid) {
  const user = await getLiveUserByUuid(uuid);
  return user?.role ?? null;
}

export async function isLiveAdmin(uuid) {
  return (await getLiveUserRole(uuid)) === "admin";
}
