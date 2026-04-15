# Exec Meeting Booking — Testing Plan

This document outlines end-to-end testing scenarios for marketing stakeholders to validate before broader rollout. Work through each section in order — later sections depend on earlier ones.

---

## Prerequisites

- Access to the app at `exec-meeting-booking.vercel.sh` (Vercel team SSO)
- A personal email you can receive calendar invites at (for testing external attendee flow)
- Access to the Cal.com dashboard (for verifying event type setup)

---

## 1. Event Setup

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.1 | Create a new event | Click **Add Event**, fill in name, description, location, dates, timezone, color. Click **Add Event**. | Event appears in Upcoming Events grid with correct details. |
| 1.2 | Calendar date picker works | When selecting start/end dates, click the calendar icon | A calendar popover appears (not browser native picker). Works in dark mode. |
| 1.3 | Timezone is correct | Create an event in London (Europe/London timezone) | Date header on the event page shows "(Europe/London)". |
| 1.4 | Cal.com auto-provisions | After creating an event, go to the event page | Cal.com Scheduling card shows "Connected" with an Event Type ID. |
| 1.5 | Add rooms | On the event page, click **Add Room**. Add 2-3 rooms with names and capacities. | Rooms appear as columns in the scheduling grid. |
| 1.6 | Assign execs | Edit the event, check exec checkboxes in Assign Execs | Execs are saved and visible when editing again. |
| 1.7 | Set goals | Edit the event, add a goal with segment breakdown | Goal appears on the Dashboard with a progress ring. |
| 1.8 | Edit event | Click Edit on the event card, change the description, save | Description updates on the card. |
| 1.9 | Past events collapse | Create an event with dates in the past | It appears under the collapsible "Past Events" section, not in Upcoming. |

---

## 2. Meeting Booking (Grid)

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 2.1 | Book a meeting | Click an empty time slot on the grid. Fill in external attendee details (use your personal email). Add an internal participant via search. Click **Book**. | Toast says "Meeting booked — calendar invite sent". Meeting block appears on the grid. |
| 2.2 | Calendar invite received | Check the external attendee email inbox | Calendar invite received with correct time, attendee names, and venue location (not Cal Video). |
| 2.3 | Correct timezone | Book a meeting at 10:00 AM on a London event while you're in a US timezone | The calendar invite shows 10:00 AM BST (London time), not PST. |
| 2.4 | Meeting detail sheet | Click the meeting block on the grid | Side panel opens with meeting title, time, room, attendee info, participants, and RSVP status. Proper left padding. |
| 2.5 | Meeting shows "Confirmed" | After a successful booking | Status badge shows "Confirmed" or "Pending confirmation", NOT "Draft — No invite sent". |
| 2.6 | Cancel a meeting | Click a meeting, then **Cancel Meeting** | Meeting disappears from grid. |
| 2.7 | Participant search | When booking, type a name in the participant search field | Filtered results appear in a dropdown. Click to add. Selected participants show as dismissible badges. |
| 2.8 | Multiple rooms | Book meetings in different rooms at the same time | Each meeting shows in the correct room column. |

---

## 3. Meeting Requests

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 3.1 | Submit a request | Go to **Requests > New Request**. Fill in all fields. Submit. | Toast confirms submission. Request appears in the Pending tab. |
| 3.2 | Sidebar badge | After submitting a request | Requests nav item shows a badge count. |
| 3.3 | Review a request | Click **Review** on a pending request | Detail sheet opens with all submitted info. Approve/Reject/Request Info buttons visible. |
| 3.4 | Approve a request | Click Approve, select a date (from event date dropdown), time, room, and participants. Confirm. | Toast says "Request approved — meeting created". Meeting appears on the event grid. Calendar invite sent. |
| 3.5 | Reject a request | Click Reject, enter a reason, confirm | Request moves to Rejected tab with reason displayed. |
| 3.6 | Request info | Click Request Info, enter a question, send | Request shows "info requested" status. Requester receives a Slack DM (if mOperator configured). Request still shows in Pending tab and can be approved/rejected. |
| 3.7 | Re-action after info requested | Open an info_requested request, click Approve | Can still approve/reject the request normally. |

---

## 4. Dashboard

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 4.1 | Stats populate | Book a few meetings, then visit Dashboard | Stat cards show non-zero values with animated count-up. |
| 4.2 | Event filter | Select a specific event from the dropdown | All cards, charts, and lists filter to that event only. Pipeline donut shows only linked opportunities. |
| 4.3 | Pipeline donut | With pipeline data present | Donut chart shows stages in different colors with total in the center. Hover shows tooltip with dollar amounts. |
| 4.4 | Goal progress rings | With goals configured | Radial rings show percentage (green >75%, amber 25-75%, red <25%). |
| 4.5 | Upcoming meetings | With future meetings booked | Meeting cards show with RSVP-colored left border, time badge, and attendee info. |
| 4.6 | Recent activity | After creating/editing/deleting meetings | Timeline shows colored dots (green=create, blue=edit, red=delete). |

---

## 5. My Meetings

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 5.1 | Personal schedule | Visit **My Meetings** | Shows all meetings where you're a participant. |
| 5.2 | Event filter | Filter by event | Only meetings for that event show. |
| 5.3 | Export CSV | Click **Export CSV** | CSV file downloads with meeting details. |
| 5.4 | Prep notes | Meetings have a prep notes column | Can view/edit prep notes. |

---

## 6. People Management

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 6.1 | Add a person | Click **Add Person**, fill in name, email, type (Exec or AE) | Person appears in the list. No Cal.com/SFDC fields shown in the form. |
| 6.2 | Sync Cal.com | Click **Sync Cal.com** button | Toast shows "X updated, Y skipped". People with matching Cal.com accounts get their username populated. |
| 6.3 | Edit a person | Click the edit icon on a person row | Can update name, email, title, type. |
| 6.4 | Delete a person | Click the delete icon | Person is removed. |
| 6.5 | Tabs filter | Switch between All / Executives / Account Executives | List filters correctly. |

---

## 7. Goals & Leaderboard

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 7.1 | Create a goal | Go to **Goals**, click **Add Goal** | Goal appears with progress bar. |
| 7.2 | Goal progress updates | After booking meetings that count toward a goal | Progress updates (may take up to 1 hour due to cron recalculation). |
| 7.3 | Leaderboard tabs | Visit **Leaderboard**, switch between Most Meetings / Pipeline / Goal Completion | Rankings display with gold/silver/bronze badges for top 3. |
| 7.4 | Leaderboard event filter | Filter by event | Rankings scope to that event. |

---

## 8. Help Page

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8.1 | Help page loads | Click **Help** in sidebar | Page loads with Quick Start, Feature Reference, Roles, FAQ sections. |
| 8.2 | Collapsible sections | Click on a Feature Reference section | Expands with smooth animation. Chevron rotates. |
| 8.3 | FAQ items | Click an FAQ question | Answer expands below. |
| 8.4 | Dark mode | Toggle dark mode from the header sun/moon icon | Help page renders correctly in both modes. Callouts have colored backgrounds. |

---

## 9. Dark Mode & Design

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 9.1 | Toggle dark mode | Click the sun/moon icon in the header | App switches between light/dark mode. Preference persists on refresh. |
| 9.2 | System preference | Set to "System" mode | Follows OS dark mode setting. |
| 9.3 | Geist Pixel headlines | Look at page titles and section headers | Headlines use the pixel font (blocky/distinctive). |
| 9.4 | Vercel logo | Check sidebar top-left | Vercel triangle, no box around it. |
| 9.5 | Side panels have padding | Open any detail sheet (meeting, request) | Content has proper left padding, not hugging the edge. |

---

## 10. Cal.com Integration

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 10.1 | Auto-setup on event creation | Create a new event | Cal.com Scheduling card shows "Connected" automatically. |
| 10.2 | Disconnect and reconnect | Click Disconnect, then Set Up Cal.com | New event type created successfully (no slug conflict). |
| 10.3 | Send Invite on draft | For any meeting in "draft" status, click **Send Invite** | Invite sent, meeting status changes to Confirmed. |
| 10.4 | Location in invite | Check the calendar invite email | Shows venue/room location, NOT "Cal Video" with a video URL. |
| 10.5 | RSVP tracking | Accept or decline the calendar invite, wait 5 min | RSVP status updates on the meeting detail and dashboard. |

---

## 11. Edge Cases

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 11.1 | Delete event with meetings | Delete an event that has meetings, requests, and goals | Everything deletes cleanly. No orphaned data on dashboard. |
| 11.2 | Empty states | Visit Dashboard, My Meetings, Requests with no data | Friendly empty state messages with icons, no errors. |
| 11.3 | Scheduling assistant | Click the chat icon, ask "What events are available?" | Claude responds with event information (requires AI Gateway). |
| 11.4 | Rapid clicking | Click "Set Up Cal.com" or "Send Invite" multiple times quickly | First click processes, subsequent clicks don't cause duplicates (button disables during loading). |

---

## Known Limitations

- **Scheduling Assistant**: Requires AI Gateway API key and correct URL (`https://ai-gateway.vercel.sh/v1`). May not work if these aren't configured.
- **Slack notifications**: Require mOperator API URL and key. Info Requested and prep reminders won't send Slack DMs without these.
- **RSVP polling**: Runs every 5 minutes via cron. RSVP changes aren't instant.
- **Goal recalculation**: Runs every hour via cron. Goal progress isn't real-time.
- **Pipeline data**: Syncs from Salesforce every 2 hours via d0. New opportunities won't appear immediately.

---

## Reporting Issues

If you find a bug or something doesn't work as expected:
1. Screenshot the error (include the browser console if there's a red error)
2. Note which page/action triggered it
3. Share in the #exec-meeting-booking Slack channel or file a GitHub issue
