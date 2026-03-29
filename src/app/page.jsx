"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  CalendarSync,
  CheckCircle2,
  Database,
  ShieldCheck,
} from "lucide-react";
import SignInButton from "@components/button/SignInButton";
import styles from "./page.module.css";
import { isEmbedded } from "@utils/client/embed-context";

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const loading = status === "loading";
  const authenticated = status === "authenticated";

  useEffect(() => {
    if (isEmbedded()) {
      router.replace("/embedded/profile");
    } else if (authenticated) {
      router.replace("/profile");
    }
  }, [authenticated, router]);

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>Notica Studio</div>
          <h1>
            Keep Google Calendar and Notion in sync without manual copying.
          </h1>
          <p className={styles.lead}>
            Connect Google Calendar, connect Notion, choose the calendars and
            database you care about, and run sync with clear setup and status.
          </p>

          <div className={styles.ctaRow}>
            {status === "unauthenticated" && !loading && (
              <div className={styles.primaryCta}>
                <SignInButton text="Continue with Google" />
              </div>
            )}
            <Link href="/getting-started" className={styles.secondaryCta}>
              See setup steps
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
            <Link href="/faq" className={styles.secondaryCta}>
              Read FAQ
            </Link>
          </div>

          <div className={styles.inlineMeta}>
            <span>Selected calendars only</span>
            <span>Notion database sync</span>
            <span>Manual control with status feedback</span>
          </div>
        </div>

        <div className={styles.heroRail}>
          <aside className={styles.heroPanel}>
            <h2>What Notica does</h2>
            <ul className={styles.featureList}>
              <li>
                <CalendarSync size={18} strokeWidth={2} />
                <div>
                  <strong>Sync the calendars you pick</strong>
                  <span>
                    Notica focuses on the calendars you explicitly connect
                    instead of pulling in your entire workspace.
                  </span>
                </div>
              </li>
              <li>
                <Database size={18} strokeWidth={2} />
                <div>
                  <strong>Write into your Notion database</strong>
                  <span>
                    Use a Notion database as the destination for calendar events
                    and keep the structure easy to review.
                  </span>
                </div>
              </li>
              <li>
                <ShieldCheck size={18} strokeWidth={2} />
                <div>
                  <strong>Keep setup focused</strong>
                  <span>
                    The app requests the permissions needed for calendar sync
                    and Notion integration setup, with details in the privacy
                    policy.
                  </span>
                </div>
              </li>
            </ul>
          </aside>

          <aside className={styles.heroChecklist}>
            <h2>Before setup</h2>
            <ul className={styles.setupList}>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <div>
                  <strong>Prepare the calendars you want to sync</strong>
                  <span>
                    Notica works best when you already know which Google
                    calendars should flow into Notion.
                  </span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <div>
                  <strong>Choose a destination database in Notion</strong>
                  <span>
                    Duplicate the template or connect your own database before
                    finishing configuration.
                  </span>
                </div>
              </li>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <div>
                  <strong>Review permissions and policies</strong>
                  <span>
                    Check Privacy Policy and Terms before connecting shared
                    calendars or workspace data.
                  </span>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>How it works</h2>
          <p>Three steps from sign-in to a working sync flow.</p>
        </div>
        <div className={styles.cardGrid}>
          <article className={styles.stepCard}>
            <div className={styles.stepNumber}>01</div>
            <h3>Sign in with Google</h3>
            <p>
              Start with your Google account so Notica can read the calendars
              you choose and sync events on your behalf.
            </p>
          </article>
          <article className={styles.stepCard}>
            <div className={styles.stepNumber}>02</div>
            <h3>Connect Notion and duplicate the template</h3>
            <p>
              Authorize Notion, open the provided template, and prepare the
              database that will receive synced events.
            </p>
          </article>
          <article className={styles.stepCard}>
            <div className={styles.stepNumber}>03</div>
            <h3>Choose settings and run sync</h3>
            <p>
              Finish your configuration, trigger sync, and monitor the result
              from the product instead of guessing what happened.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Before you continue</h2>
          <p>
            These are the core things the product touches and where to review
            them.
          </p>
        </div>
        <div className={styles.cardGrid}>
          <article className={styles.infoCard}>
            <h3>Google Calendar access</h3>
            <p>
              Used to list calendars and sync the events from the calendars you
              select.
            </p>
            <ul className={styles.checkList}>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>Calendar list visibility for selection</span>
              </li>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>Calendar event sync for chosen calendars</span>
              </li>
            </ul>
          </article>
          <article className={styles.infoCard}>
            <h3>Notion access</h3>
            <p>
              Used to connect your target database so synced events can be
              created or updated in Notion.
            </p>
            <ul className={styles.checkList}>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>Database and page metadata access</span>
              </li>
              <li>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span>Workspace connection you can revoke anytime</span>
              </li>
            </ul>
          </article>
          <article className={styles.infoCard}>
            <h3>Policy and support</h3>
            <p>
              Review the operating terms before connecting accounts or editing
              your sync setup.
            </p>
            <div className={styles.linkList}>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <a
                href="https://github.com/HUIXIN-TW/NotionSyncGCal"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open source reference
              </a>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
