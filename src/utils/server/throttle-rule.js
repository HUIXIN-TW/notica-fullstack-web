import "server-only";
import config, { getSyncUserThrottleConfig } from "@config/server/rate-limit";

/**
 * Build sync throttling rules: per IP and per user UUID.
 */
export function syncRules(ip, uuid, role) {
  const rules = [];
  const userSyncConfig = getSyncUserThrottleConfig(role);

  if (ip) {
    rules.push({
      key: `sync:ip:${ip}`,
      minMs: config.SYNC_IP_MIN_MS,
      window: {
        limit: config.SYNC_IP_WINDOW_LIMIT,
        ms: config.SYNC_IP_WINDOW_MS,
      },
      messages: {
        tooFrequent: "Too many requests. Please slow down.",
        windowExceeded: "Too many requests. Please try again later.",
      },
    });
  }

  if (uuid) {
    rules.push({
      key: `sync:user:${uuid}`,
      minMs: userSyncConfig.minMs,
      window: {
        limit: userSyncConfig.windowLimit,
        ms: userSyncConfig.windowMs,
      },
      messages: {
        tooFrequent: "Please wait a moment before retrying.",
        windowExceeded: "Too many syncs in a short period.",
      },
    });
  }

  return rules;
}

/**
 * Build global throttling rules: per IP and per user UUID.
 */
export function globalRules(key, ip, uuid) {
  const rules = [];

  if (ip) {
    rules.push({
      key: `${key}:ip:${ip}`,
      minMs: config.GLOBAL_IP_MIN_MS,
      window: {
        limit: config.GLOBAL_IP_WINDOW_LIMIT,
        ms: config.GLOBAL_IP_WINDOW_MS,
      },
      messages: {
        tooFrequent: "Too many requests from this IP. Please slow down.",
        windowExceeded:
          "Too many requests from this IP. Please try again later.",
      },
    });
  }

  if (uuid) {
    rules.push({
      key: `${key}:user:${uuid}`,
      minMs: config.GLOBAL_USER_MIN_MS,
      window: {
        limit: config.GLOBAL_USER_WINDOW_LIMIT,
        ms: config.GLOBAL_USER_WINDOW_MS,
      },
      messages: {
        tooFrequent: "Too many requests. Please wait a moment.",
        windowExceeded: "Too many requests in short period. Try again later.",
      },
    });
  }

  return rules;
}
