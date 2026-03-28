import "server-only";

export function sanitizeUserForResponse(user) {
  if (!user) return user;

  // The app is Google-only now and does not create password-based users.
  // Keep these strips defensive so legacy imports or future misuse cannot
  // expose auth-related fields through API responses.
  const { password, passwordHash, providerSub, notionConfig, ...safeUser } =
    user;

  return safeUser;
}

export function sanitizeUsersForResponse(users = []) {
  return users.map(sanitizeUserForResponse);
}
