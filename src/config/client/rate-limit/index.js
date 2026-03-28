const DEFAULT_SYNC_USER_MIN_MS = 10 * 60_000;
const DEFAULT_SYNC_ADMIN_MIN_MS = 60_000;

const config = {
  SYNC_USER_MIN_MS: DEFAULT_SYNC_USER_MIN_MS, // Minimum spacing between bursts for a standard user (10 minutes)
  SYNC_ADMIN_MIN_MS: DEFAULT_SYNC_ADMIN_MIN_MS, // Minimum spacing between bursts for an admin user (1 minute)
};

export function getSyncUserMinMs(role) {
  return role === "admin" ? config.SYNC_ADMIN_MIN_MS : config.SYNC_USER_MIN_MS;
}

export default Object.freeze(config);
