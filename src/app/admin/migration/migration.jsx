import React, { useEffect, useState } from "react";
import styles from "./migration.module.css";

const API_ENDPOINT = "/api/admin/migration";

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTitle(title, fallbackUrl) {
  const base =
    typeof title === "string" && title.trim() ? title.trim() : fallbackUrl;
  return base
    .replace(/\s*\(opens in a new tab\)/gi, "")
    .replace(/\s*\[PDF[^\]]*\]/gi, "")
    .replace(/\(PDF document - opens in a new tab\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function urlDescription(href) {
  if (!href) return "";
  try {
    const parsed = new URL(href);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return href;
  }
}

function normalizePdfLinks(rawLinks) {
  if (!Array.isArray(rawLinks)) return [];
  return rawLinks
    .map((item) => ({
      title: normalizeTitle(item?.title, item?.url || ""),
      url: typeof item?.url === "string" ? item.url : "",
    }))
    .filter((item) => item.url);
}

const MigrationDashboard = ({ refreshKey = null }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (refreshKey === null) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(API_ENDPOINT, { cache: "no-store" });

        if (!response.ok) {
          const errorDetails = await response
            .json()
            .catch(() => ({ error: `HTTP Status ${response.status}` }));
          throw new Error(
            `Failed to fetch: ${errorDetails.error || "Unknown error"}`,
          );
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
        console.error("Migration Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshKey]);

  if (refreshKey === null) {
    return (
      <div className={styles.state}>Click refresh to load migration data.</div>
    );
  }

  if (loading) {
    return <div className={styles.state}>Loading migration data...</div>;
  }

  if (error) {
    return <div className={styles.stateError}>Error loading data: {error}</div>;
  }

  if (!data) {
    return (
      <div className={styles.state}>Data structure is invalid or empty.</div>
    );
  }

  const monthData =
    data?.months && typeof data.months === "object" ? data.months : data;

  const entries = Object.entries(monthData || {}).map(([key, value]) => ({
    month: key,
    value: toNumber(value),
  }));

  const total = entries.reduce((sum, row) => sum + row.value, 0);

  const pdfLinks = normalizePdfLinks(data?.pdfLinks);
  const pdfCount =
    typeof data?.pdfCount === "number" && Number.isFinite(data.pdfCount)
      ? data.pdfCount
      : pdfLinks.length;

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>WA Migration Snapshot</h2>
          <p className={styles.subtitle}>
            Monthly invitation count and all discovered PDF references.
          </p>
        </div>
        {typeof data?.pdfSourceUrl === "string" && data.pdfSourceUrl ? (
          <a
            className={styles.sourceLink}
            href={data.pdfSourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Source page
          </a>
        ) : null}
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Total Invitations</p>
          <p className={styles.summaryValue}>{total.toLocaleString()}</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Months Returned</p>
          <p className={styles.summaryValue}>
            {entries.length.toLocaleString()}
          </p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryLabel}>PDF Links Returned</p>
          <p className={styles.summaryValue}>{pdfCount.toLocaleString()}</p>
        </article>
      </section>

      <section className={styles.block}>
        <div className={styles.blockHeader}>
          <h3 className={styles.blockTitle}>Invitation Number By Month</h3>
          <p className={styles.blockMeta}>
            All values shown as absolute counts
          </p>
        </div>
        <ul className={styles.monthList}>
          {entries.map((entry) => (
            <li key={entry.month} className={styles.monthItem}>
              <p className={styles.monthName}>{entry.month}</p>
              <p className={styles.monthValue}>
                {entry.value.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.block}>
        <div className={styles.blockHeader}>
          <h3 className={styles.blockTitle}>PDF Links</h3>
          <p className={styles.blockMeta}>{pdfCount.toLocaleString()} links</p>
        </div>

        {pdfLinks.length === 0 ? (
          <div className={styles.empty}>No PDF links found.</div>
        ) : (
          <ol className={styles.pdfList}>
            {pdfLinks.map((item, index) => {
              const href = item.url;
              const title = item.title;
              const meta = urlDescription(href);
              return (
                <li key={`${href}-${index}`} className={styles.pdfItem}>
                  <a
                    className={styles.pdfAnchor}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {title || href}
                  </a>
                  {meta ? <p className={styles.pdfMeta}>{meta}</p> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
};

export default MigrationDashboard;
