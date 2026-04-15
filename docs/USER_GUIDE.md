# Exec Meeting Booking — User Guide

Welcome to the Exec Meeting Booking app. This tool helps marketing operations teams coordinate executive meetings at conferences, trade shows, and field events. It handles scheduling, room assignments, RSVP tracking, and performance reporting — all in one place.

---

## Quick Start

This walkthrough covers the core workflow from creating an event to tracking results.

### Step 1: Create an Event

An **event** represents a conference, trade show, or field event where your execs will take meetings.

1. Go to **Events** in the sidebar.
2. Click **Add Event**.
3. Fill in the basics: name, dates, location, and timezone.
4. Pick a color (used to visually distinguish events across the app).
5. Toggle **Active** on when you're ready for people to see it.
6. Click **Create**.

### Step 2: Add Rooms

Rooms are the physical meeting spaces at your event. Each room gets its own column in the scheduling grid.

1. Open your event by clicking **Manage** on the event card.
2. Click **Add Room** in the room bar above the grid.
3. Enter the room name, an optional description, and the capacity.
4. Repeat for each available room.

### Step 3: Assign Executives

Tell the app which execs are attending this event so meetings can be scheduled for them.

1. On the **Events** page, click **Edit** on your event card.
2. In the **Assign Execs** section, check the boxes next to the executives attending.
3. Save.

> **Note:** Executives must be added to the **People** page first (see the People section below).

### Step 4: Set Goals

Goals let you track meeting quotas and pipeline targets per event.

1. While creating or editing an event, scroll to the **Goals** section.
2. Click **Add Goal** and enter a name (e.g., "Q2 Meeting Quota") and target value.
3. Optionally break down the goal by **segment** (Commercial, SMB, Startups, Majors) with individual targets per segment.
4. Save.

Goals are recalculated automatically every hour as meetings are booked and confirmed.

### Step 5: Book Meetings

There are three ways to book a meeting:

**Option A: Click the Grid (most common)**
1. Open your event and navigate to the right date using the date arrows.
2. Click an empty time slot in the room you want.
3. Fill in the meeting details: title, external attendee info, internal participants, and optional Salesforce Opportunity ID.
4. Click **Book**.

The app will create a calendar event via Cal.com and send invites automatically.

**Option B: Submit a Meeting Request**
1. Go to **Requests > New Request** in the sidebar.
2. Fill in the request form: event, account, guest details, business impact, and any exec preferences.
3. Submit. The event owner will review and approve/reject from the Requests page.

**Option C: Use the AI Assistant**
1. Click the chat icon in the bottom-right corner of any page.
2. Ask a natural language question like "Find a 30-minute slot for Lisa Chen with the VP of Sales at Acme Corp."
3. The assistant will suggest available times and can book directly.

### Step 6: Track Progress

- **Dashboard** shows your key metrics at a glance: meetings this week, RSVP rate, pipeline influenced, and goal progress.
- **My Meetings** shows your personal schedule with prep notes.
- **Leaderboard** shows who's booking the most meetings, generating the most pipeline, and hitting their goals.

---

## Feature Reference

### Dashboard

The Dashboard is your command center. It shows four stat cards at the top:

| Stat | What It Means |
|------|---------------|
| **Meetings This Week** | Count of confirmed, pending, and completed meetings in the current week |
| **RSVP Acceptance Rate** | Percentage of external attendees who accepted their calendar invite |
| **Pipeline Influenced** | Total dollar value of Salesforce opportunities linked to your meetings |
| **Active Goals Progress** | Average completion percentage across all active goals |

Below the stats you'll find:
- **Upcoming Meetings** — your next 7 days of meetings with attendee names, times, and RSVP status.
- **Goal Progress** — active goals with progress bars and a bar chart comparing current vs. target.
- **Pipeline Summary** — a pie chart breaking down opportunity dollar amounts by deal stage.
- **Recent Activity** — an audit log of the latest changes (meetings created, updated, deleted, etc.).

Use the **event filter** dropdown at the top right to scope everything to a single event.

---

### Events & the Room Grid

The **Events** page lists all your conferences and events as cards. Each card shows the event name, dates, location, room count, and meeting count.

#### The Room x Time Grid

When you click **Manage** on an event, you land on the scheduling grid. This is the heart of the app.

- **Columns** represent rooms. Each room is a column.
- **Rows** represent 30-minute time slots from 7 AM to 8 PM.
- **Meeting blocks** appear as colored cards in the grid showing the company name, attendee, and RSVP status.
- **Empty cells** are clickable — click to book a meeting in that room at that time.

Use the **date navigator** (left/right arrows) at the top to move between event dates. The header also shows a quick count of meetings and RSVP rate for the selected day.

#### Meeting Details

Click any meeting block to open the detail sheet. From here you can:
- View all attendee and participant info
- See and refresh RSVP status from Google Calendar
- Edit the meeting time, room, or attendees
- Use **Silent Update** to change calendar details without sending a notification to the attendee
- Add or edit **Prep Notes**
- Delete the meeting (cancels the Cal.com booking and Google Calendar event)

#### Integrations Section

At the bottom of the event page, there's an **Integrations** card where you can link a Cal.com Event Type ID. This connects the event to Cal.com so the app can check availability and create bookings through Cal.com's scheduling system.

---

### Meeting Requests

The Requests page is an approval workflow for meeting bookings submitted by AEs or via mOperator.

#### For AEs (submitting requests)

1. Go to **Requests > New Request**.
2. Select the event, fill in guest details (name, email, company, title), account name, and estimated deal size.
3. Describe the business impact — this helps the event owner prioritize.
4. Optionally request a specific exec and indicate if a Sales Engineer is needed.
5. Submit.

Your request enters the queue as **Pending**.

#### For Marketing (reviewing requests)

1. Go to **Requests** and use the status tabs (Pending / Approved / Rejected / All) to filter.
2. Click a request to see the full details.
3. Choose an action:
   - **Approve** — the meeting will be booked on the grid.
   - **Reject** — select a reason (e.g., "No availability," "Low priority").
   - **Request Info** — ask the submitter for more details before deciding.

The sidebar badge shows how many requests are pending.

---

### My Meetings

**My Meetings** is a personal view of all meetings where you are a participant. It's designed primarily for AEs preparing for their meetings.

- Filter by event using the dropdown.
- See each meeting's title, time, room, external attendee, RSVP status, segment, and status.
- The **Prep Notes** column shows any notes attached to the meeting — fill these in to prepare talking points, account context, or follow-up actions.
- Click **Export CSV** to download your schedule as a spreadsheet for offline reference or sharing.

> **Tip:** You'll receive a Slack reminder 3 days before each meeting prompting you to fill in prep notes if you haven't already.

---

### People

The People page manages your database of **Executives** and **Account Executives**.

Use the tabs to switch between the two lists. For each person you can set:

| Field | Purpose |
|-------|---------|
| **Name & Email** | Basic identity (required) |
| **Title** | Job title for context |
| **Type** | Exec or AE — determines how they appear in the app |
| **Cal.com Username** | Links to their Cal.com profile for availability checking |
| **Google Calendar ID** | Used for RSVP polling |
| **Salesforce Owner ID** | Links their meetings to SFDC opportunities |

People must be added here before they can be assigned to events or added as meeting participants.

---

### Goals

Goals track measurable targets for your events. There are three types:

| Goal Type | What It Tracks |
|-----------|---------------|
| **Meeting Quota** | Number of meetings booked (e.g., "Book 40 meetings at Dreamforce") |
| **Pipeline Target** | Dollar value of pipeline influenced (e.g., "$2M pipeline from SKO meetings") |
| **Account Coverage** | Number of target accounts met with |

Each goal has:
- A **target value** and **current value** (updated automatically every hour).
- A **period** (weekly, monthly, quarterly, yearly) with start and end dates.
- An optional **person** scope (track one AE's meetings) or **event** scope (track one event's meetings).
- Optional **segment breakdown** — split the target across segments like Commercial, SMB, Startups, and Majors.

Goals appear on the Dashboard with progress bars and on the Leaderboard ranked by completion percentage.

---

### Leaderboard

The Leaderboard shows performance rankings across three views:

| Tab | Ranks By | Shows |
|-----|----------|-------|
| **Most Meetings** | Number of confirmed meetings | Meeting count per person |
| **Pipeline Generated** | Total dollar value of linked opportunities | Pipeline amount per person |
| **Goal Completion** | Average goal completion percentage | Completion % with progress bar |

The top three performers get gold, silver, and bronze badges. Use the event filter to scope rankings to a single event.

---

### AI Scheduling Assistant

The chat widget in the bottom-right corner is an AI assistant that can help with scheduling tasks. You can ask it things like:

- "When is Lisa Chen available next Tuesday?"
- "Find a 60-minute slot for the Acme Corp meeting with Room A"
- "What meetings do I have at Dreamforce?"

The assistant has access to your event data, room availability, and people information.

---

## Roles

The app supports different roles, each with a different primary workflow:

### Marketing / Event Owner

You're the person running the event. Your typical workflow:
1. Create the event, add rooms, assign execs, set goals.
2. Review and approve/reject meeting requests.
3. Use the grid to manually book or adjust meetings.
4. Monitor the dashboard and leaderboard for progress.
5. Use silent updates to fix scheduling issues without spamming attendees.

### Account Executive

You're booking meetings with your accounts. Your typical workflow:
1. Submit meeting requests via the Requests page or ask the event owner to book directly.
2. Check **My Meetings** for your personal schedule.
3. Fill in **Prep Notes** before each meeting.
4. Export your schedule to CSV for offline reference.
5. Check the **Leaderboard** to see how you stack up.

### Executive

You're taking the meetings. Your typical workflow:
1. Check **My Meetings** to see what's on your calendar.
2. Review prep notes before each meeting.
3. Your calendar invites come through Google Calendar / Cal.com — accept or decline from there.

---

## FAQ

**Q: How do calendar invites get sent?**
When a meeting is booked, the app creates a booking through Cal.com, which sends calendar invites via Google Calendar. The external attendee receives an invite with meeting details, and internal participants are added to the event.

**Q: What happens when someone declines a meeting?**
The app polls Google Calendar every 5 minutes for RSVP updates. When a decline is detected, the meeting's RSVP status updates automatically. You'll see it reflected on the grid and in the dashboard stats.

**Q: Can I move a meeting to a different room or time?**
Yes. Click the meeting on the grid, then click Edit in the detail sheet. You can change the room, time, or attendees. Use **Silent Update** if you don't want the external attendee to receive a change notification.

**Q: How does pipeline tracking work?**
The app syncs opportunities from Salesforce every 2 hours. When a meeting is linked to a Salesforce Opportunity ID, that opportunity's dollar amount counts toward your Pipeline Influenced metric.

**Q: What are segments?**
Segments categorize meetings by customer type (e.g., Commercial, SMB, Startups, Majors). When you set up goals with segment breakdowns, the app tracks how many meetings fall into each segment so you can ensure balanced coverage across your business.

**Q: How do Slack reminders work?**
Three days before each meeting, the app sends a Slack DM to the assigned AE reminding them to fill in prep notes. This runs automatically — no setup needed on your end.

**Q: How does Cal.com integration work?**
Cal.com is set up automatically when you create an event — you choose a meeting duration and the app handles the rest. Cal.com powers availability checking and sends calendar invites when meetings are booked.

**Q: Who can see what?**
Currently all logged-in users can see all events, meetings, and data. The app is scoped to your team — anyone with team access can view and edit.
