# **Privacy Policy**

Last updated: 2025-10-13

## 1. Overview

NOTICA (“the Service”, operated by Notica Studio) connects your Google Calendar and Notion workspace to synchronize events securely and privately.

We collect and process only the minimum information necessary to perform synchronization between your accounts.

## 2. What We Access

### Google Access

- **Calendar events** (`https://www.googleapis.com/auth/calendar.events`)
  Used to create, update, delete, and move events between calendars you select.
  We do **not** access your full calendar history beyond the events you choose to sync.
- **Calendar list** (`https://www.googleapis.com/auth/calendar.calendarlist.readonly`)
  Used to display the list of your calendars so you can choose which one to sync.

We do **not** request the full calendar management scope (`https://www.googleapis.com/auth/calendar`).

### Notion Access

- **Databases and pages metadata**
  (`read` and `write` capabilities under your authorized integration)
  Used to insert or update page properties when syncing events from Google Calendar.
  We do **not** access unrelated pages, content, or blocks outside the database(s) you explicitly select.

## 3. How It Works

- Authorization uses OAuth 2.0 for both Google and Notion.
- Event synchronization occurs on our backend (AWS Lambda) when triggered manually or on a configured schedule.
- Event and page data are processed transiently for synchronization and not stored permanently.

## 4. Tokens & Security

- We store the minimum required tokens (e.g., refresh token) to run background synchronization.
- Tokens are **encrypted at rest** (AWS-managed encryption) and access is restricted using **least-privilege IAM policies**.

## 5. Data Retention & Deletion

- We keep only identifiers necessary for synchronization (e.g., event IDs, timestamps).
- You can revoke access anytime from:
  - Google → Account → Security → Third-party access
  - Notion → Settings → My integrations
- To request deletion of stored identifiers/tokens, contact us at: **[whtnw.studio@gmail.com](mailto:whtnw.studio@gmail.com)** or **[huixin.yang.tw@gmail.com](mailto:huixin.yang.tw@gmail.com)**.
  We will confirm deletion within 30 days.

## 6. Ads & Sharing

- We do **not** sell your data or use it for advertising.
- Data is **not shared** with third parties except the cloud providers required to operate the service.

## 7. Contact

For any privacy questions or deletion requests:

- **[whtnw.studio@gmail.com](mailto:whtnw.studio@gmail.com)** or
- **[huixin.yang.tw@gmail.com](mailto:huixin.yang.tw@gmail.com)**
