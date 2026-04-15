# Exec Meeting Booking — Product Overview & Next Steps

## What This App Does

Marketing books hotel suites and conference rooms at industry events (AWS re:Invent, Dreamforce, etc.) and schedules executive meetings with prospects/customers in those rooms. The primary interface is a **Room x Time grid** for each conference day — think Google Calendar but scoped to a specific event's rooms.

## Stakeholders & How They Use It

### Marketing Team (Primary Users)
- **Create events** (conferences) with dates, location, and room inventory
- **Book meetings** by clicking empty slots on the Room x Time grid
- Fill in external attendee details (name, email, company, title) and assign internal participants
- **Track RSVP status** — see at a glance who has accepted/declined via Google Calendar integration
- **Manage the schedule** — move meetings between rooms, cancel, use "silent edit" to update calendar events without triggering notifications
- **Link Salesforce opportunities** to meetings for pipeline attribution
- **Monitor goals** — meeting quotas, pipeline targets, and account coverage metrics
- **Use the AI assistant** to find availability and book meetings via natural language

### Account Executives (AEs)
- View their meeting schedule across events
- See which meetings they're assigned to and upcoming commitments
- Goal tracking (personal meeting quotas and pipeline targets)

### Executives
- Passive — their calendar availability is pulled from Cal.com
- They show up as participants on meetings
- Don't need to interact with the app directly

## Current Architecture

```
UI (Next.js App Router)
  └── Events list → Event detail (Room x Time grid)
       ├── Click empty cell → Book Meeting dialog
       ├── Click meeting → Meeting Detail sheet
       ├── Rooms bar (add/edit/delete rooms)
       └── Day navigator (arrows within event date range)

API Routes
  ├── /api/events/              — CRUD conferences
  ├── /api/events/[id]/rooms/   — CRUD rooms per event
  ├── /api/events/[id]/meetings — GET meetings for grid (by date)
  ├── /api/meetings/            — CRUD meetings (booking flow)
  ├── /api/meetings/[id]/rsvp   — Poll Google Calendar RSVP
  ├── /api/meetings/[id]/silent-update — Edit without notifications
  ├── /api/people/              — CRUD execs and AEs
  ├── /api/goals/               — CRUD goal tracking
  ├── /api/dashboard/           — Aggregated stats
  └── /api/chat/                — AI scheduling assistant

Integrations
  ├── Cal.com        — Availability slots, booking creation
  ├── Google Calendar — RSVP polling, silent event updates
  ├── Salesforce/d0  — Opportunity data, pipeline tracking
  └── AI Gateway     — GPT-4o scheduling assistant
```

## Database Schema (Post-Rework)

- **events** — conferences (name, location, dates, timezone, color)
- **rooms** — scoped to events, cascade delete (name, capacity, sort order)
- **meetings** — linked to event + room, with Cal.com/Google/SFDC integrations
- **meeting_participants** — junction table (person + role per meeting)
- **people** — execs and AEs with Cal.com usernames
- **goals** — meeting quotas, pipeline targets, account coverage
- **opportunities** — synced from Salesforce via d0
- **audit_log** — change tracking

## What Works Today

- Event CRUD with conference cards (name, dates, location, room/meeting counts)
- Room management per event
- Room x Time grid with day navigation
- Book Meeting dialog (room, time, duration, external attendee, internal participants, SFDC link)
- Meeting Detail sheet with RSVP status and actions
- Cal.com booking creation
- Google Calendar RSVP polling and silent updates
- AI scheduling assistant (chat)
- Goal tracking and recalculation
- Dashboard with stats, charts, recent activity
- People management

## Next Steps for Requirements Discussion

### 1. Auth & Access Control
- Currently: single Credentials provider (email login, auto-creates users)
- Decide: who gets access? SSO via Google? Role-based permissions beyond marketing/ae/exec/admin?
- Should AEs and execs have their own views, or is this marketing-only?

### 2. Event Lifecycle
- What happens when a conference ends? Archive? Auto-complete meetings?
- Do events need approval workflows before going live?
- Template events for recurring conferences (e.g., "re:Invent" every year)?

### 3. Room Management
- Are rooms always hotel suites, or also meeting rooms at the venue?
- Do rooms need time-based availability (e.g., only available 8am-6pm)?
- Room setup/teardown buffer time between meetings?

### 4. Meeting Booking Flow
- Should the external attendee receive a calendar invite directly from this app, or does marketing send it separately?
- Confirmation workflow: who approves a meeting before it's "confirmed"?
- How are meeting titles generated? Convention like "[Company] x [Exec Name]"?
- Should there be conflict detection (double-booking a room, overlapping participants)?

### 5. RSVP & Notifications
- The silent update feature exists — when is it used vs. normal updates?
- Do we need email notifications to marketing when RSVP status changes?
- Escalation when a prospect declines?

### 6. Salesforce Integration
- Is linking an opportunity optional or required per meeting?
- Should pipeline data flow back to SFDC (e.g., log meeting activity)?
- What d0 queries are needed for account/opportunity enrichment?

### 7. Goals & Reporting
- Who sets goals — marketing leadership? Per-event or global?
- What reports do stakeholders need after a conference?
- Export capabilities (CSV, PDF recap)?

### 8. AI Assistant
- What are the top 3 tasks the AI should handle?
- Should it proactively suggest bookings based on goal progress?
- Does it need access to Salesforce data for context?

### 9. Mobile / On-Site Usage
- Will marketing use this on a laptop at the conference, or on mobile?
- Does the grid need a mobile-optimized view?
- Offline capability needed?

### 10. Deployment & Env Vars
Current required env vars:
```
DATABASE_URL          — Neon Postgres connection string
AUTH_SECRET           — NextAuth JWT signing secret
GOOGLE_CLIENT_ID      — Google OAuth (if using Google sign-in)
GOOGLE_CLIENT_SECRET  — Google OAuth
CALCOM_API_URL        — Cal.com API endpoint
CALCOM_API_KEY        — Cal.com API key
CALCOM_WEBHOOK_SECRET — Cal.com webhook verification
GOOGLE_SERVICE_ACCOUNT_EMAIL — For Calendar API
GOOGLE_PRIVATE_KEY    — Service account key
D0_API_URL            — d0/SFDC API
D0_API_KEY            — d0 authentication
D0_BYPASS_SECRET      — d0 bypass
AI_GATEWAY_URL        — AI provider endpoint
AI_GATEWAY_API_KEY    — AI provider key
CRON_SECRET           — Cron job authentication
```
