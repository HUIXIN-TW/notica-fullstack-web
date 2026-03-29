"use client";
import { isProdRuntime as isProd } from "@utils/shared/logger";
import { useCountdown } from "@hooks/useCountdown";
import { useElapsedTime } from "@hooks/useElapsedTime";
import useSyncHandler from "@hooks/useSyncHandler";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./profile.module.css";
import { getSyncUserMinMs } from "@config/client/rate-limit";
import SyncButton from "@components/button/SyncButton";
import SupportSection from "@components/profile/SupportSection";

const Profile = ({ session }) => {
  const user = session?.user;
  const router = useRouter();

  // Rate limit configuration
  const syncUserMinMs = getSyncUserMinMs(user?.role);
  const { startCountdown, isCountingDown, formattedRemaining } = useCountdown(
    user?.role === "admin" ? "cooldown:sync:admin" : "cooldown:sync:user",
  );

  const { syncResult, isSyncing, syncStartedAt, handleSync } = useSyncHandler({
    userUuid: user?.uuid,
    cooldownMs: syncUserMinMs,
    startCountdown,
  });

  // Elapsed time since sync started
  const elapsedSec = useElapsedTime(syncStartedAt);

  // --- 1. Load from session: If new user, redirect to getting started ---
  useEffect(() => {
    if (session?.isNewUser) {
      // set local storage flag
      localStorage.setItem("newUser:v1", "true");
      router.push("/getting-started");
    }
  }, [session, router]);

  // User details
  if (!user) {
    return (
      <div className={styles.profile_loading}>Loading your profile...</div>
    );
  }
  const { email, uuid, username, image } = user;

  return (
    <div className={styles.profile_container}>
      <div className={styles.profile_image_container}>
        {image && (
          <img
            className={styles.profile_image}
            src={image}
            alt="Profile Image"
          />
        )}
        {!image && (
          <img
            className={styles.profile_default_image}
            src="./assets/images/notica.png"
            alt="Default Profile Image"
          />
        )}
      </div>
      {!isProd && (
        <>
          <div className={styles.profile_detail}>
            <span className={styles.profile_label}>UUID:</span> {uuid}
          </div>
          <div className={styles.profile_detail}>
            <span className={styles.profile_label}>Name:</span> {username}
          </div>
          <div className={styles.profile_detail}>
            <span className={styles.profile_label}>Status:</span>{" "}
            {syncResult?.type ?? "-"}
          </div>
          <div className={styles.profile_detail}>
            <span className={styles.profile_label}>Notion Database ID:</span>{" "}
            {syncResult?.message?.summary?.notion_config?.database_id ?? "-"}
          </div>
          <div className={styles.profile_detail}>
            <span className={styles.profile_label}>
              Google Calendar Account:
            </span>{" "}
            {email}
          </div>
        </>
      )}
      {syncResult && (
        <>
          {syncResult?.type === "sync_success" ? (
            <>
              <div className={styles.profile_detail}>
                <span className={styles.profile_label}>
                  Date Range (Synced):
                </span>{" "}
                {syncResult?.message?.summary?.notion_config?.range ?? "-"}
              </div>
              <div className={styles.profile_detail}>
                <span className={styles.profile_label}>
                  Google Events Synced:
                </span>{" "}
                {syncResult?.message?.summary?.google_event_count ?? "-"}
              </div>
              <div className={styles.profile_detail}>
                <span className={styles.profile_label}>
                  Notion Tasks Synced:
                </span>{" "}
                {syncResult?.message?.summary?.notion_task_count ?? "-"}
              </div>
              <div className={styles.profile_detail}>
                <span className={styles.profile_label}>Last Sync Time:</span>{" "}
                {syncResult?.message?.trigger_time ?? "-"}
              </div>
            </>
          ) : (
            <div className={styles.profile_detail}>
              <span className={styles.profile_label}>Message:</span>{" "}
              {syncResult?.message ?? "-"}
            </div>
          )}
        </>
      )}

      <SyncButton
        text={
          isSyncing && syncStartedAt
            ? `Syncing... (${elapsedSec}s)`
            : isCountingDown
              ? `You can sync again in ${formattedRemaining}`
              : `Sync Calendar`
        }
        onSync={handleSync}
        disabled={isSyncing || (isCountingDown && isProd)}
      />

      <SupportSection />
    </div>
  );
};

export default Profile;
