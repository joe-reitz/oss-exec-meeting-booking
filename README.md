# Exec Meeting Booking

An internal tool for coordinating executive meetings at conferences and events. Marketing teams use it to manage meeting requests, schedule rooms, track RSVPs, and measure pipeline impact.

Built with Next.js, Neon Postgres, and Cal.com. Optionally integrates with Salesforce (via [mOperator](https://github.com/joe-reitz/oss-moperator)), Google Calendar, SendGrid, and Slack.

## Features

- **Event management** — Create conferences/events with rooms, time slots, and assigned executives
- **Meeting request workflow** — AEs submit requests, marketing approves and schedules them
- **Room scheduling** — Visual calendar grid with conflict detection
- **RSVP tracking** — Automatic polling of Google Calendar for attendee responses
- **Goal tracking** — Set meeting targets by segment (Enterprise, Mid-Market, etc.) and track progress
- **Pipeline analytics** — Link meetings to Salesforce opportunities and measure sourced pipeline
- **Booking confirmations** — Branded email confirmations with calendar invite downloads
- **Slack notifications** — Real-time alerts when requests are submitted or approved
- **AI scheduling assistant** — Natural-language chat widget for finding availability and booking
- **Role-based access** — Marketing/admin users can approve requests; AEs can submit them

---

## Prerequisites

Before you start, you'll need accounts for:

| Service | Required? | What it does |
|---------|-----------|-------------|
| [Neon](https://neon.tech) | **Yes** | Postgres database |
| [Vercel](https://vercel.com) | **Yes** | Hosting and cron jobs |
| [Google Cloud](https://console.cloud.google.com) | **Yes** | OAuth login for your team |
| [Cal.com](https://cal.com) | Optional | Calendar invites and availability |
| [SendGrid](https://sendgrid.com) | Optional | Booking confirmation emails |
| [Slack](https://api.slack.com) | Optional | Webhook notifications |
| [mOperator](https://github.com/joe-reitz/oss-moperator) | Optional | Salesforce integration |

---

## Setup Guide

### 1. Fork and clone

```bash
git clone https://github.com/<your-org>/oss-exec-meeting-booking.git
cd oss-exec-meeting-booking
npm install
```

### 2. Create your database

1. Sign up at [neon.tech](https://neon.tech) and create a new project
2. Copy the connection string (it looks like `postgresql://user:pass@host/dbname?sslmode=require`)
3. Create a `.env.local` file from the template:

```bash
cp .env.example .env.local
```

4. Paste your connection string as `DATABASE_URL` in `.env.local`

### 3. Run database migrations

```bash
npx drizzle-kit push
```

This creates all the tables in your Neon database.

### 4. Set up Google OAuth (for login)

This lets your team sign in with their Google accounts.

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Create a new **OAuth 2.0 Client ID** (type: Web application)
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy the **Client ID** and **Client Secret** into `.env.local`:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

5. Generate an auth secret:

```bash
openssl rand -base64 32
```

6. Add it to `.env.local`:

```
AUTH_SECRET=your-generated-secret
AUTH_URL=http://localhost:3000
```

**Tip:** If you use Google Workspace, go to the **Audience** page in Google Cloud Console and set the app to **Internal**. This restricts login to your organization's email domain only.

### 5. Add your team

Marketing users who need to approve meeting requests must be added to the `users` table:

1. Edit `scripts/seed-marketing-users.mjs` with your team's names and emails
2. Run the script:

```bash
DATABASE_URL=<your-neon-url> node scripts/seed-marketing-users.mjs
```

To add executives and AEs (the people who attend meetings), use the People page in the app or import from a CSV:

```bash
APP_URL=http://localhost:3000 node scripts/import-people.mjs path/to/your-export.csv
```

The CSV should have columns: `Name`, `Email`, `Title`, and optionally `Id` (Salesforce Owner ID).

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the dashboard.

### 7. Create your first event

1. Go to **Events** and click **Create Event**
2. Fill in the conference name, dates, location, and timezone
3. Add rooms (meeting spaces at the venue)
4. Assign executives who will be attending
5. Optionally set meeting goals by segment

### 8. Deploy to Vercel

1. Push your repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo
3. Add all your `.env.local` variables to the Vercel project's Environment Variables
4. Update `AUTH_URL` to your production URL (e.g., `https://your-app.vercel.app`)
5. Add the production callback URL to your Google OAuth client: `https://your-app.vercel.app/api/auth/callback/google`
6. Deploy

The cron jobs in `vercel.json` will automatically run on Vercel to poll RSVPs, sync opportunities, recalculate goals, and send prep reminders.

---

## Optional Integrations

### Cal.com (Calendar Invites)

Cal.com handles calendar invites and availability checking.

1. Create a [Cal.com](https://cal.com) organization
2. Generate an API key from your Cal.com settings
3. Add to `.env.local`:

```
CALCOM_API_URL=https://api.cal.com/v2
CALCOM_API_KEY=your-key
CALCOM_ORG_ID=your-org-id
CALCOM_WEBHOOK_SECRET=your-webhook-secret
```

Without Cal.com, the app falls back to direct Google Calendar integration (if configured) or creates meetings without calendar invites.

### Salesforce (via mOperator)

[mOperator](https://github.com/joe-reitz/oss-moperator) is an open-source Slack agent that connects to Salesforce. It enables:

- Looking up contact segments and linked opportunities when booking
- Adding contacts to SFDC campaigns after meetings are approved
- Submitting meeting requests via Slack

**To set up:**

1. Follow the setup guide in the [oss-moperator repo](https://github.com/joe-reitz/oss-moperator)
2. Once deployed, add to `.env.local`:

```
MOPERATOR_API_URL=https://your-moperator-instance.vercel.app
MOPERATOR_API_KEY=your-api-key
MOPERATOR_WEBHOOK_SECRET=your-webhook-secret
```

### SendGrid (Emails)

Sends branded booking confirmation emails to all meeting attendees.

1. Create a [SendGrid](https://sendgrid.com) account and verify a sender email
2. Add to `.env.local`:

```
SENDGRID_API_KEY=your-key
SENDGRID_FROM_EMAIL=meetings@yourdomain.com
```

Set `APP_COMPANY_NAME` to customize the email branding (defaults to "Meeting Booking").

### Slack (Notifications)

Sends messages when meeting requests are submitted or approved.

1. Create a [Slack Incoming Webhook](https://api.slack.com/messaging/webhooks)
2. Add to `.env.local`:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Google Calendar (Direct)

If Cal.com isn't configured, you can use a Google service account to create calendar events directly.

1. Create a service account in Google Cloud Console
2. Enable domain-wide delegation
3. Add to `.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

---

## Seed Demo Data

To populate the app with example data for testing:

```bash
APP_URL=http://localhost:3000 node scripts/seed-reinvent-demo.mjs
```

This creates a sample event with rooms, meetings, people, and pipeline data.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Database:** Neon Postgres + Drizzle ORM
- **Auth:** NextAuth.js v5 with Google OAuth
- **UI:** Tailwind CSS + shadcn/ui
- **Email:** SendGrid
- **Calendar:** Cal.com API v2 / Google Calendar API

---

## License

MIT
