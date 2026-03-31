"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import Button from "@components/button/Button";
import formatTimestamp from "@utils/client/format-timestamp";
import formatSyncLog from "@utils/client/format-sync-log";
import MigrationDashboard from "./migration/migration.jsx";
import styles from "./admin.module.css";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
);

const CHART_BORDER_COLOR = "rgba(99, 102, 241, 1)";
const CHART_GRADIENT_START = "rgba(99, 102, 241, 0.3)";
const CHART_GRADIENT_END = "rgba(99, 102, 241, 0)";
const CHART_POINT_COLOR = "#6366F1";

function buildTrendChartConfig({ labels, counts, label }) {
  return {
    data: {
      labels,
      datasets: [
        {
          label,
          data: counts,
          fill: true,
          borderColor: CHART_BORDER_COLOR,
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, CHART_GRADIENT_START);
            gradient.addColorStop(1, CHART_GRADIENT_END);
            return gradient;
          },
          pointBackgroundColor: CHART_POINT_COLOR,
          borderWidth: 2,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1E1E1E",
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 10,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { color: "#555", precision: 0 },
        },
        x: {
          grid: { display: false },
          ticks: { color: "#777", autoSkip: true, maxTicksLimit: 14 },
        },
      },
    },
  };
}

export default function Admin() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [userCounts, setUserCounts] = useState(null);
  const [syncCounts, setSyncCounts] = useState(null);
  const [syncDailyCounts, setSyncDailyCounts] = useState(null);
  const [latestSyncLogs, setLatestSyncLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [migrationRefreshKey, setMigrationRefreshKey] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // gate: login + admin only
  useEffect(() => {
    if (
      status === "unauthenticated" ||
      (status === "authenticated" && session?.user?.role !== "admin")
    ) {
      router.push("/");
    }
  }, [status, session, router]);

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [uRes, sRes, lslRes, luRes] = await Promise.all([
        fetch("/api/admin/user-metrics", { cache: "no-store" }),
        fetch("/api/admin/sync-metrics", { cache: "no-store" }),
        fetch("/api/admin/list-sync-log", { cache: "no-store" }),
        fetch("/api/admin/list-user", { cache: "no-store" }),
      ]);
      if (!uRes.ok) throw new Error(`user-metrics ${uRes.status}`);
      if (!sRes.ok) throw new Error(`sync-metrics ${sRes.status}`);
      if (!lslRes.ok) throw new Error(`list-sync-log ${lslRes.status}`);
      if (!luRes.ok) throw new Error(`list-user ${luRes.status}`);

      setUserCounts(await uRes.json());
      const { totalCount, dailyCounts } = await sRes.json();
      setSyncCounts(Number(totalCount) || 0);
      setSyncDailyCounts(dailyCounts || []);
      const syncLogPayload = await lslRes.json();
      setLatestSyncLogs(syncLogPayload?.items || []);
      const allUsers = await luRes.json();
      setUsers(allUsers?.users || []);
    } catch (e) {
      setError(e?.message || "refresh failed");
    } finally {
      setLoading(false);
    }
  }

  const usersChart = useMemo(() => {
    const labels = (userCounts ?? []).map((d) => d.createdAt);
    const counts = (userCounts ?? []).map((d) => d.count ?? 0);
    return buildTrendChartConfig({
      labels,
      counts,
      label: "New users per day",
    });
  }, [userCounts]);

  const syncDailyCountsChart = useMemo(() => {
    const labels = (syncDailyCounts ?? []).map((d) => d.date);
    const counts = (syncDailyCounts ?? []).map((d) => d.count ?? 0);
    return buildTrendChartConfig({
      labels,
      counts,
      label: "Sync operations per day",
    });
  }, [syncDailyCounts]);

  const toggleLogExpansion = (key) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const shortUuid = (uuid) => {
    if (!uuid) return "—";
    const str = String(uuid);
    const firstSegment = str.split("-")[0];
    return firstSegment || str.slice(0, 8);
  };

  const toCount = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const toMs = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const asNumber = Number(value);
      if (Number.isFinite(asNumber)) return asNumber;
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const sumCounts = (items) =>
    items.reduce((sum, item) => sum + toCount(item?.count), 0);

  const totalUsers = Array.isArray(users) ? users.length : 0;
  const adminUsers = Array.isArray(users)
    ? users.filter((user) => user?.role === "admin").length
    : 0;
  const standardUsers = Math.max(totalUsers - adminUsers, 0);
  const avgSyncPerDay =
    Array.isArray(syncDailyCounts) && syncDailyCounts.length
      ? Math.round((sumCounts(syncDailyCounts) / syncDailyCounts.length) * 10) /
        10
      : 0;
  const latestSyncAt =
    Array.isArray(latestSyncLogs) && latestSyncLogs.length
      ? latestSyncLogs.reduce((max, item) => {
          const next = toMs(item?.timestamp);
          if (!Number.isFinite(next)) return max;
          return max === null || next > max ? next : max;
        }, null)
      : null;
  const latestUserCreatedAt =
    Array.isArray(users) && users.length
      ? users.reduce((max, user) => {
          const next = toMs(user?.createdAtMs ?? user?.createdAt);
          if (!Number.isFinite(next)) return max;
          return max === null || next > max ? next : max;
        }, null)
      : null;
  const totalNewUsers14d = Array.isArray(userCounts)
    ? sumCounts(userCounts)
    : 0;
  const avgNewUsersPerDay =
    Array.isArray(userCounts) && userCounts.length
      ? Math.round((totalNewUsers14d / userCounts.length) * 10) / 10
      : 0;
  const latestUserTrendPoint =
    Array.isArray(userCounts) && userCounts.length
      ? userCounts[userCounts.length - 1]
      : null;
  const totalSyncFromDailyCounts = Array.isArray(syncDailyCounts)
    ? sumCounts(syncDailyCounts)
    : 0;
  const avgSyncPerTrendDay =
    Array.isArray(syncDailyCounts) && syncDailyCounts.length
      ? Math.round((totalSyncFromDailyCounts / syncDailyCounts.length) * 10) /
        10
      : 0;
  const peakSyncDay =
    Array.isArray(syncDailyCounts) && syncDailyCounts.length
      ? syncDailyCounts.reduce((peak, item) => {
          const value = toCount(item?.count);
          if (!peak || value > peak.value) {
            return { value, date: item?.date || "—" };
          }
          return peak;
        }, null)
      : null;

  const renderExpandableLog = (logPayload, key) => {
    const expanded = expandedLogs.has(key);
    return (
      <div className={styles.logCellContent}>
        <div
          className={
            expanded ? styles.logTextExpanded : styles.logTextCollapsed
          }
        >
          {formatSyncLog(logPayload, { expanded: true })}
        </div>
        <button
          type="button"
          className={styles.logToggle}
          onClick={() => toggleLogExpansion(key)}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
    );
  };

  const refreshAll = () => {
    setMigrationRefreshKey((k) => (k ?? 0) + 1);
    fetchDashboardData();
  };

  if (
    status === "loading" ||
    (status === "authenticated" && session?.user?.role !== "admin")
  ) {
    return <div>Loading…</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.actions}>
        <Button
          text={loading ? "Refreshing…" : "Refresh"}
          onClick={refreshAll}
          disabled={loading}
        />
      </div>

      {error && (
        <div className={styles.section}>
          <div className={styles.card}>Error: {error}</div>
        </div>
      )}

      <div className={styles.grid}>
        <section className={`${styles.section} ${styles.card}`}>
          <div className={styles.chartWrapMigration}>
            <MigrationDashboard refreshKey={migrationRefreshKey} />
          </div>
        </section>
        <section className={`${styles.section} ${styles.card}`}>
          <div className={styles.sectionHeading}>
            <h2>Notica Fullstack DynamoDB Statistics</h2>
            <p>
              User and sync metrics, trends, and latest operational records.
            </p>
          </div>
          <div className={styles.statsGrid}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>Total Users</p>
              <p className={styles.statValue}>{totalUsers.toLocaleString()}</p>
              <p className={styles.statHint}>
                {adminUsers.toLocaleString()} admin |{" "}
                {standardUsers.toLocaleString()} standard
              </p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>Sync Operations (7d)</p>
              <p className={styles.statValue}>
                {(syncCounts ?? 0).toLocaleString()}
              </p>
              <p className={styles.statHint}>Rolling window total (168h)</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>Avg Sync / Day</p>
              <p className={styles.statValue}>
                {avgSyncPerDay.toLocaleString()}
              </p>
              <p className={styles.statHint}>
                Based on current 7-day trend data
              </p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>Latest Sync Event</p>
              <p className={styles.statValueSmall}>
                {latestSyncAt ? formatTimestamp(latestSyncAt) : "No data"}
              </p>
              <p className={styles.statHint}>
                Most recent sync record timestamp
              </p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>Newest User Created</p>
              <p className={styles.statValueSmall}>
                {latestUserCreatedAt
                  ? formatTimestamp(latestUserCreatedAt)
                  : "No data"}
              </p>
              <p className={styles.statHint}>Latest record in user table</p>
            </article>
          </div>
          <div className={styles.unifiedSection}>
            <div className={styles.subSection}>
              <div className={styles.sectionHeading}>
                <h2>New User Trend (last 14 days)</h2>
                <p>
                  {Array.isArray(userCounts) ? userCounts.length : 0} data
                  points
                </p>
              </div>
              <div className={styles.inlineMetaRow}>
                <span className={styles.inlineMetaChip}>
                  Total: {totalNewUsers14d.toLocaleString()}
                </span>
                <span className={styles.inlineMetaChip}>
                  Avg/day: {avgNewUsersPerDay.toLocaleString()}
                </span>
                <span className={styles.inlineMetaChip}>
                  Latest:{" "}
                  {toCount(latestUserTrendPoint?.count).toLocaleString()}
                </span>
              </div>
              <div className={styles.chartPanel}>
                <div className={styles.chartWrap}>
                  {userCounts ? (
                    <Line data={usersChart.data} options={usersChart.options} />
                  ) : (
                    <div className={styles.emptyState}>No data</div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.subSection}>
              <div className={styles.sectionHeading}>
                <h2>Sync Count (last 7 days)</h2>
                <p>
                  {Array.isArray(syncDailyCounts) ? syncDailyCounts.length : 0}{" "}
                  data points
                </p>
              </div>
              <div className={styles.inlineMetaRow}>
                <span className={styles.inlineMetaChip}>
                  Total: {(syncCounts ?? 0).toLocaleString()}
                </span>
                <span className={styles.inlineMetaChip}>
                  Avg/day: {avgSyncPerTrendDay.toLocaleString()}
                </span>
                <span className={styles.inlineMetaChip}>
                  Peak:{" "}
                  {peakSyncDay
                    ? `${peakSyncDay.value.toLocaleString()} on ${peakSyncDay.date}`
                    : "No data"}
                </span>
              </div>
              <div className={styles.chartPanel}>
                <div className={styles.chartWrap}>
                  {syncDailyCounts ? (
                    <Line
                      data={syncDailyCountsChart.data}
                      options={syncDailyCountsChart.options}
                    />
                  ) : (
                    <div className={styles.emptyState}>No data</div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.subSection}>
              <div className={styles.sectionHeading}>
                <h2>User List</h2>
                <p>{totalUsers.toLocaleString()} users</p>
              </div>
              <div className={styles.inlineMetaRow}>
                <span className={styles.inlineMetaChip}>
                  Admin: {adminUsers.toLocaleString()}
                </span>
                <span className={styles.inlineMetaChip}>
                  Standard: {standardUsers.toLocaleString()}
                </span>
                <span className={styles.inlineMetaChip}>
                  Newest:{" "}
                  {latestUserCreatedAt
                    ? formatTimestamp(latestUserCreatedAt)
                    : "No data"}
                </span>
              </div>
              <div className={styles.tableSurface}>
                <div className={styles.logsTableWrap}>
                  {loading && !users.length ? (
                    <div className={styles.emptyState}>Loading…</div>
                  ) : users.length ? (
                    <table className={styles.logsTable}>
                      <thead>
                        <tr>
                          <th>UUID</th>
                          <th>Role</th>
                          <th>Created At</th>
                          <th>Last Login</th>
                          <th>Last Sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.uuid}>
                            <td
                              className={styles.mono}
                              title={user.uuid}
                              data-label="UUID"
                            >
                              {shortUuid(user.uuid)}
                            </td>
                            <td data-label="Role">
                              <span className={styles.triggerBadge}>
                                {user.role || "user"}
                              </span>
                            </td>
                            <td
                              className={styles.timestampCell}
                              data-label="Created At"
                            >
                              {formatTimestamp(
                                user.createdAtMs || user.createdAt,
                              )}
                            </td>
                            <td
                              className={styles.timestampCell}
                              data-label="Last Login"
                            >
                              {formatTimestamp(
                                user.lastLoginAtMs || user.lastLoginAt,
                              )}
                            </td>
                            <td
                              className={`${styles.mono} ${styles.logCell}`}
                              data-label="Last Sync"
                            >
                              {renderExpandableLog(
                                user.lastSyncLog,
                                `user-${user.uuid}-lastSyncLog`,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className={styles.emptyState}>No users found</div>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.subSection}>
              <div className={styles.sectionHeading}>
                <h2>Latest Sync Log List (20)</h2>
                <p>{latestSyncLogs.length.toLocaleString()} records</p>
              </div>
              <div className={styles.inlineMetaRow}>
                <span className={styles.inlineMetaChip}>
                  Latest event:{" "}
                  {latestSyncAt ? formatTimestamp(latestSyncAt) : "No data"}
                </span>
                <span className={styles.inlineMetaChip}>
                  Rolling total (7d): {(syncCounts ?? 0).toLocaleString()}
                </span>
              </div>
              <div className={styles.tableSurface}>
                <div className={styles.logsTableWrap}>
                  {loading && !latestSyncLogs.length ? (
                    <div className={styles.emptyState}>Loading…</div>
                  ) : latestSyncLogs.length ? (
                    <table className={styles.logsTable}>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Trigger</th>
                          <th>UUID</th>
                          <th>Log</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestSyncLogs.map((item, idx) => (
                          <tr
                            key={`${item.uuid || "log"}-${item.timestamp || idx}`}
                          >
                            <td
                              className={styles.timestampCell}
                              data-label="Timestamp"
                            >
                              {formatTimestamp(item.timestamp)}
                            </td>
                            <td data-label="Trigger">
                              <span className={styles.triggerBadge}>
                                {item.trigger_by || "—"}
                              </span>
                            </td>
                            <td
                              className={styles.mono}
                              title={item.uuid || "—"}
                              data-label="UUID"
                            >
                              {shortUuid(item.uuid)}
                            </td>
                            <td
                              className={`${styles.mono} ${styles.logCell}`}
                              data-label="Log"
                            >
                              {renderExpandableLog(
                                item.log,
                                `${item.uuid || "log"}-${item.timestamp || idx}`,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className={styles.emptyState}>
                      No sync records found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
