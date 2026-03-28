"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import SignInButton from "@components/button/SignInButton";
import SyncButton from "@components/button/SyncButton";
import NavigateButton from "@components/button/NavigateButton";
import useSyncHandler from "@hooks/useSyncHandler";
import { useCountdown } from "@hooks/useCountdown";
import { useElapsedTime } from "@hooks/useElapsedTime";
import { getSyncUserMinMs } from "@config/client/rate-limit";
import styles from "./profile.module.css";
import { isProdRuntime as isProd } from "@utils/shared/logger";
import { isNotionMobileApp } from "@utils/client/embed-context";

export default function EmbedSyncPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const [isNotionMobile, setIsNotionMobile] = useState(false);

  useEffect(() => {
    const notionMobile = isNotionMobileApp();
    setIsNotionMobile(notionMobile);
    if (notionMobile && typeof window !== "undefined") {
      setFallbackUrl(window.location.href);
    }
  }, []);

  const syncUserMinMs = getSyncUserMinMs(user?.role);
  const { startCountdown, isCountingDown, formattedRemaining } = useCountdown(
    user?.role === "admin" ? "cooldown:sync:admin" : "cooldown:sync:user",
  );

  const { syncResult, isSyncing, syncStartedAt, handleSync } = useSyncHandler({
    userUuid: user?.uuid,
    cooldownMs: syncUserMinMs,
    startCountdown,
  });

  const elapsedSec = useElapsedTime(syncStartedAt);

  const syncButtonText =
    isSyncing && syncStartedAt
      ? `Syncing... (${elapsedSec}s)`
      : isCountingDown
      ? `You can sync again in ${formattedRemaining}`
      : `Sync Calendar`;

  if (isNotionMobile) {
    return (
      <div className={styles.card}>
        <h1 className={styles.title}>Notica Sync</h1>
        <p className={styles.description}>
          Interactive embeds are not supported in the Notion mobile app. Please
          open this page in your mobile browser to continue.
        </p>
        <NavigateButton path="/profile" text="Open in browser" />
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Notica Sync</h1>
      {!user && (
        <>
          <p className={styles.description}>
            Sign in with Google to connect your calendar and trigger manual
            syncs from this embed.
          </p>
          <SignInButton />
        </>
      )}
      {user && (
        <>
          <p className={styles.description}>
            Signed in as <strong>{user.email}</strong>. Trigger a manual sync
            whenever you update your Notion tasks.
          </p>
          <SyncButton
            text={syncButtonText}
            onSync={handleSync}
            disabled={isSyncing || (isCountingDown && isProd)}
          />
          {syncResult && (
            <>
              <div className={styles.divider} />
              <div className={styles.status}>
                Last Status: <strong>{syncResult?.type ?? "-"}</strong>
              </div>
              <div className={styles.result_message}>
                {syncResult?.message
                  ? syncResult?.type === "sync_success"
                    ? `Last sync at ${syncResult?.message?.trigger_time || "-"}`
                    : syncResult?.message
                  : "-"}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
