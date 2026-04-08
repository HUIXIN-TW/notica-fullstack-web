# **Privacy Policy**

Last updated: 2026-04-08

## 1. Overview

NOTICA ("the Service", operated by Notica Studio) connects your Google Calendar and Notion workspace to synchronize tasks and events. This policy explains exactly what Google user data we access, how we use it, how we protect it, and how you can delete it.

Our use of Google API data complies with the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

---

## 2. Google User Data We Access

We request the following Google OAuth scopes:

| Scope                                                            | Purpose                                                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `https://www.googleapis.com/auth/calendar.events`                | Read, create, update, and delete calendar events in calendars you select for sync |
| `https://www.googleapis.com/auth/calendar.calendarlist.readonly` | List your calendars so you can choose which one to sync                           |

We do **not** request the full calendar management scope (`https://www.googleapis.com/auth/calendar`).

---

## 3. How We Use Google User Data

Google user data is used **solely** to perform the synchronization service you explicitly requested:

- **Calendar events** are read to detect new or updated tasks in your selected Google Calendar. They are processed transiently (in memory, during the sync operation) and are **not stored on our servers or in any database**.
- **Calendar list** is read once to display your available calendars in the configuration UI so you can choose which calendar to sync.
- We do **not** use Google user data to serve ads, build user profiles, or for any purpose unrelated to synchronization.
- We do **not** transfer or expose Google user data to any AI/ML training systems.

---

## 4. Data Sharing

We do **not** sell, rent, or trade your Google user data.

Google user data is **not shared** with third parties except:

- **AWS** (Amazon Web Services): Our cloud infrastructure provider. Sync operations run on AWS Lambda. No Google Calendar event content is written to persistent storage (DynamoDB or otherwise) — only OAuth tokens are stored there (see Section 5).
- **Notion**: Task write-back is sent directly to Notion's API using your authorized integration. No Google event data is retained after the sync call completes.

No other third parties receive your Google user data.

---

## 5. Data Storage & Protection

### What is stored

| Data                                                                       | Storage      | Purpose                                                      |
| -------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| Google OAuth **refresh token**                                             | AWS DynamoDB | Allows background sync without requiring you to log in again |
| Notion OAuth **access token**                                              | AWS DynamoDB | Allows background sync with your Notion workspace            |
| Internal sync metadata (e.g., last synced timestamp, selected calendar ID) | AWS DynamoDB | Tracks sync state                                            |

**We do not store Google Calendar event content** (titles, descriptions, attendees, etc.) in any database. Event data is processed in memory during the sync Lambda execution and discarded immediately after.

### How tokens are protected

- All data in DynamoDB is **encrypted at rest** using AWS-managed encryption keys (AWS KMS).
- All data in transit uses **TLS/HTTPS**.
- Access to DynamoDB is restricted to dedicated Lambda functions using **least-privilege IAM roles**. No role has broader access than required.
- OAuth tokens are never logged or exposed in error messages.

---

## 6. Data Retention & Deletion

- OAuth tokens and sync metadata are retained for as long as your account is active and synchronization is enabled.
- **To stop all sync and revoke access immediately**, you can disconnect at any time from:
  - **Google**: [myaccount.google.com → Security → Third-party apps with account access](https://myaccount.google.com/permissions)
  - **Notion**: Settings → My connections → Remove NOTICA

- **To request deletion of all stored tokens and metadata** (including your DynamoDB records), contact us at:
  - **[whtnw.studio@gmail.com](mailto:whtnw.studio@gmail.com)** or **[huixin.yang.tw@gmail.com](mailto:huixin.yang.tw@gmail.com)**

  We will confirm and complete deletion within **30 days** of your request.

---

## 7. Notion Data

Your Notion databases and pages belong to you. We access only the specific database(s) you authorize through Notion's OAuth integration. We read task metadata to detect sync targets and write back updated properties (e.g., event ID, sync status). We do not access pages or databases outside the scope you grant.

---

## 8. Children's Privacy

The Service is not directed at children under 13. We do not knowingly collect data from children under 13.

---

## 9. Changes to This Policy

We will update this page and revise the "Last updated" date when material changes are made. Continued use of the Service after changes constitutes acceptance.

---

## 10. Contact

For privacy questions or data deletion requests:

- **[whtnw.studio@gmail.com](mailto:whtnw.studio@gmail.com)**
- **[huixin.yang.tw@gmail.com](mailto:huixin.yang.tw@gmail.com)**
