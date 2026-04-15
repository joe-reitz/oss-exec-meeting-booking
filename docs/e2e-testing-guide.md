# End-to-End Testing Guide

Manual test scripts for verifying all critical flows in the exec-meeting-booking app. Each scenario includes preconditions, step-by-step actions, and expected results.

**Base URL:** `http://localhost:3000` (or your production deployment URL)

**Prerequisites:**
- App running (`npm run dev`)
- Database seeded with at least one event, room, exec, and AE (`POST /api/seed` or manual creation)
- Environment variables configured per `.env.example`

---

## Scenario 1: Booking Flow End-to-End

**Goal:** Verify the full lifecycle: create event -> add room -> book meeting -> Cal.com booking -> Google Calendar event -> RSVP polling -> status update.

### Preconditions
- Cal.com API key configured (`CALCOM_API_KEY`, `CALCOM_API_URL`)
- Google service account configured (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- At least one person exists with a `calcomUsername` and `googleCalendarId`

### Steps

1. **Create an event**
   ```
   POST /api/events
   {
     "name": "Test Conference 2026",
     "location": "Las Vegas Convention Center",
     "startDate": "2026-06-01",
     "endDate": "2026-06-03",
     "timezone": "America/Los_Angeles"
   }
   ```
   - Expected: 201, returns event with `id`
   - Save the `eventId`

2. **Add a room to the event**
   ```
   POST /api/events/{eventId}/rooms
   {
     "name": "Suite 101",
     "capacity": 8,
     "meetingDurationMinutes": 30,
     "breakDurationMinutes": 10,
     "availabilityStart": "08:00",
     "availabilityEnd": "18:00"
   }
   ```
   - Expected: 201, returns room with `id`
   - Save the `roomId`

3. **Set up Cal.com event type** (if not already linked)
   ```
   POST /api/events/{eventId}/calcom-setup
   ```
   - Expected: 200, event now has a `calcomEventTypeId`

4. **Book a meeting**
   ```
   POST /api/meetings
   {
     "title": "Acme Corp - Jane Smith",
     "eventId": "{eventId}",
     "startTime": "2026-06-01T10:00:00-07:00",
     "endTime": "2026-06-01T10:30:00-07:00",
     "timezone": "America/Los_Angeles",
     "durationMinutes": 30,
     "roomId": "{roomId}",
     "participantIds": ["{execPersonId}", "{aePersonId}"],
     "externalAttendeeName": "Jane Smith",
     "externalAttendeeEmail": "jane@acme.com",
     "externalAttendeeCompany": "Acme Corp"
   }
   ```
   - Expected: 201
   - Verify `calcomBookingUid` is present (Cal.com booking created)
   - Verify `status` is `"pending"` (has Cal.com booking) or `"draft"` (if Cal.com failed)
   - Check `_calcomError` is null

5. **Verify Cal.com booking exists**
   - Log into Cal.com dashboard, confirm the booking appears
   - Or: check the `calcomBookingId` via Cal.com API

6. **Verify Google Calendar event** (if Cal.com created one)
   ```
   GET /api/meetings/{meetingId}
   ```
   - Check `googleEventId` is populated
   - Open Google Calendar for the exec/AE to confirm the event appears

7. **Trigger RSVP poll**
   ```
   POST /api/cron/poll-rsvp
   Authorization: Bearer {CRON_SECRET}
   ```
   - Expected: 200
   - If the external attendee has responded in Google Calendar, check:
     ```
     GET /api/meetings/{meetingId}
     ```
   - Verify `externalRsvpStatus` updated (e.g., `"accepted"`, `"declined"`, `"tentative"`)
   - Verify participant `googleRsvpStatus` values updated

8. **Confirm meeting status progression**
   - After RSVP acceptance, manually update status:
     ```
     PATCH /api/meetings/{meetingId}
     { "status": "confirmed" }
     ```
   - Expected: 200, status is now `"confirmed"`

### Pass Criteria
- Meeting created with Cal.com booking
- Google Calendar event visible to participants
- RSVP polling returns updated statuses
- Meeting can progress through status lifecycle

---

## Scenario 2: Meeting Request Workflow

**Goal:** Verify the full request lifecycle: mOperator webhook -> pending request -> approve -> meeting created -> invite sent.

### Preconditions
- At least one event with rooms exists
- `MOPERATOR_WEBHOOK_SECRET` configured in `.env`

### Steps

1. **Simulate mOperator webhook**
   ```
   POST /api/webhooks/moperator
   Headers:
     x-webhook-secret: {MOPERATOR_WEBHOOK_SECRET}
     Content-Type: application/json
   Body:
   {
     "eventId": "{eventId}",
     "meetingType": "prospect",
     "accountName": "BigCo Inc",
     "estimatedDealSize": "$500K",
     "businessImpact": "New logo, strategic account",
     "guestName": "Bob Johnson",
     "guestEmail": "bob@bigco.com",
     "guestTitle": "VP Engineering",
     "guestCompany": "BigCo Inc",
     "goalOutcome": "Technical deep-dive on platform",
     "requiresExec": true,
     "preferredDateWindow": "June 1-2",
     "notes": "Met at previous event, very interested",
     "requesterName": "Alice AE",
     "requesterEmail": "alice@company.com"
   }
   ```
   - Expected: 201, returns request with `id` and `status: "pending"`
   - Save the `requestId`

2. **Verify request appears in list**
   ```
   GET /api/meeting-requests?status=pending
   ```
   - Expected: new request appears with all fields populated

3. **Verify pending count**
   ```
   GET /api/meeting-requests/count?status=pending
   ```
   - Expected: count includes the new request

4. **Request more info (optional path)**
   ```
   PATCH /api/meeting-requests/{requestId}
   {
     "status": "info_requested",
     "infoRequestMessage": "Can you confirm the attendee's availability for June 1 AM?"
   }
   ```
   - Expected: 200, status changes to `"info_requested"`
   - If Slack is configured, verify DM sent to requester

5. **Approve the request**
   ```
   PATCH /api/meeting-requests/{requestId}
   {
     "status": "approved",
     "roomId": "{roomId}",
     "startTime": "2026-06-01T14:00:00-07:00",
     "endTime": "2026-06-01T14:30:00-07:00",
     "durationMinutes": 30,
     "participantIds": ["{execPersonId}"]
   }
   ```
   - Expected: 200
   - Response includes `meetingId` (meeting was created)
   - Verify request `status` is `"approved"`

6. **Verify the created meeting**
   ```
   GET /api/meetings/{meetingId}
   ```
   - Expected: meeting exists with correct title (`"BigCo Inc - Bob Johnson"`), room, time, participants, and external attendee info

7. **Test rejection path**
   - Create another request via webhook (repeat step 1)
   ```
   PATCH /api/meeting-requests/{newRequestId}
   {
     "status": "rejected",
     "rejectionReason": "No exec availability during this window"
   }
   ```
   - Expected: 200, status is `"rejected"`, `rejectionReason` populated

### Pass Criteria
- Webhook creates pending request
- Approval creates a meeting with all details carried over
- Rejection stores reason
- Info-request triggers Slack DM (if configured)

---

## Scenario 3: Goal Recalculation

**Goal:** Verify all three goal types recalculate correctly based on meeting data.

### Preconditions
- At least one person (AE) exists
- At least one event with meetings exists
- SFDC opportunities synced (for pipeline/account coverage goals)

### Steps

1. **Create a meeting quota goal**
   ```
   POST /api/goals
   {
     "name": "Q2 Meeting Target",
     "type": "meeting_quota",
     "period": "quarterly",
     "periodStart": "2026-04-01",
     "periodEnd": "2026-06-30",
     "targetValue": 20,
     "unit": "meetings",
     "personId": "{aePersonId}"
   }
   ```
   - Expected: 201, `currentValue: 0`

2. **Create a pipeline target goal**
   ```
   POST /api/goals
   {
     "name": "Q2 Pipeline Target",
     "type": "pipeline_target",
     "period": "quarterly",
     "periodStart": "2026-04-01",
     "periodEnd": "2026-06-30",
     "targetValue": 1000000,
     "unit": "dollars",
     "personId": "{aePersonId}"
   }
   ```
   - Expected: 201, `currentValue: 0`

3. **Create an account coverage goal**
   ```
   POST /api/goals
   {
     "name": "Strategic Account Coverage",
     "type": "account_coverage",
     "period": "quarterly",
     "periodStart": "2026-04-01",
     "periodEnd": "2026-06-30",
     "targetValue": 5,
     "unit": "accounts",
     "targetAccountList": ["Acme Corp", "BigCo Inc", "MegaCloud", "DataFlow", "CloudNet"]
   }
   ```
   - Expected: 201, `currentValue: 0`

4. **Book meetings that should affect goal counts**
   - Create 2-3 meetings with status `"confirmed"` or `"completed"` within the Q2 date range
   - Assign the AE as a participant
   - Link at least one meeting to an SFDC opportunity (set `sfdcOpportunityId`)

5. **Trigger goal recalculation**
   ```
   POST /api/cron/recalculate-goals
   Authorization: Bearer {CRON_SECRET}
   ```
   - Expected: 200, returns recalculation results

6. **Verify updated goal values**
   ```
   GET /api/goals
   ```
   - **meeting_quota:** `currentValue` should equal the count of confirmed/completed meetings for this AE in Q2
   - **pipeline_target:** `currentValue` should equal the sum of linked opportunity amounts
   - **account_coverage:** `currentValue` should equal the count of distinct accounts from linked opportunities that match the target list

7. **Check leaderboard reflects goals**
   ```
   GET /api/leaderboard
   ```
   - Expected: AE appears with correct meeting count and pipeline values

### Pass Criteria
- Each goal type recalculates to the correct value
- Adding/removing meetings and re-running recalculation changes values
- Leaderboard data is consistent with goal values

---

## Scenario 4: Availability Logic

**Goal:** Verify combined availability correctly intersects Cal.com participant availability with room booking windows.

### Preconditions
- At least 2 people with `calcomUsername` set (so Cal.com can return their availability)
- At least 1 room with existing meetings booked

### Steps

1. **Check availability for a single person**
   ```
   GET /api/meetings/availability?personIds={personId1}&startDate=2026-06-01&endDate=2026-06-02
   ```
   - Expected: returns available slots based on Cal.com calendar

2. **Check availability for multiple people**
   ```
   GET /api/meetings/availability?personIds={personId1},{personId2}&startDate=2026-06-01&endDate=2026-06-02
   ```
   - Expected: returns only slots where BOTH people are free (intersection)
   - Verify the slot count is <= the count for either individual

3. **Check availability with a room that has existing bookings**
   ```
   GET /api/meetings/availability?personIds={personId1}&roomId={roomId}&startDate=2026-06-01&endDate=2026-06-02
   ```
   - Expected: slots that conflict with existing room bookings are removed
   - Verify: if room has a meeting at 10:00-10:30, no slot overlaps that window

4. **Book a meeting in a returned slot, then re-check**
   - Pick a slot from step 3 and book a meeting at that time
   - Re-run the same availability query
   - Expected: that slot is no longer available

5. **Cancel the meeting and re-check**
   ```
   DELETE /api/meetings/{meetingId}
   ```
   - Re-run availability query
   - Expected: the slot is available again (cancelled meetings excluded)

6. **Test with AI agent**
   - In the chat interface, ask: "Find availability for {personName} in {roomName} on June 1"
   - Expected: agent returns slots consistent with the API response

### Pass Criteria
- Single-person availability matches Cal.com
- Multi-person availability is the intersection
- Room bookings are correctly subtracted
- Cancelled meetings don't block availability
- AI agent returns consistent results

---

## Scenario 5: Timezone Handling

**Goal:** Verify that events in different timezones display and store times correctly.

### Preconditions
- Events exist or will be created in multiple timezones

### Steps

1. **Create an event in Pacific time**
   ```
   POST /api/events
   {
     "name": "West Coast Summit",
     "location": "San Francisco",
     "startDate": "2026-07-01",
     "endDate": "2026-07-02",
     "timezone": "America/Los_Angeles"
   }
   ```

2. **Create an event in Eastern time**
   ```
   POST /api/events
   {
     "name": "East Coast Forum",
     "location": "New York",
     "startDate": "2026-07-01",
     "endDate": "2026-07-02",
     "timezone": "America/New_York"
   }
   ```

3. **Add rooms to both events and book meetings at "10:00 AM local"**
   - West Coast: `startTime: "2026-07-01T10:00:00-07:00"` (10 AM PDT = 17:00 UTC)
   - East Coast: `startTime: "2026-07-01T10:00:00-04:00"` (10 AM EDT = 14:00 UTC)

4. **Verify stored times are correct**
   ```
   GET /api/meetings/{westCoastMeetingId}
   GET /api/meetings/{eastCoastMeetingId}
   ```
   - Expected: `startTime` values are in ISO 8601 with correct UTC offsets
   - West Coast 10:00 AM PDT = `2026-07-01T17:00:00.000Z`
   - East Coast 10:00 AM EDT = `2026-07-01T14:00:00.000Z`

5. **Verify grid display**
   - Navigate to `/events/{westCoastEventId}` and select July 1
   - Expected: meeting shows at 10:00 AM in the grid (Pacific time)
   - Navigate to `/events/{eastCoastEventId}` and select July 1
   - Expected: meeting shows at 10:00 AM in the grid (Eastern time)

6. **Verify the meetings list page**
   ```
   GET /api/events/{eventId}/meetings?date=2026-07-01
   ```
   - For each event, verify meetings returned are those occurring on July 1 in that event's timezone

7. **Test date boundary edge case**
   - Book a meeting at 11:00 PM Eastern (= next day UTC)
   - Verify it appears on the correct date in the grid (July 1, not July 2)

### Pass Criteria
- Times stored as UTC in the database
- Times displayed in the event's local timezone in the UI
- Date filtering works correctly across timezone boundaries
- No off-by-one day errors at timezone boundaries

---

## Scenario 6: Webhook Verification

**Goal:** Verify that webhook endpoints properly validate signatures/secrets and reject invalid requests.

### Steps

#### Cal.com Webhook Signature Verification

1. **Send a valid webhook**
   ```
   POST /api/webhooks/calcom
   Headers:
     x-cal-signature-256: {valid HMAC-SHA256 of body using CALCOM_WEBHOOK_SECRET}
     Content-Type: application/json
   Body:
   {
     "triggerEvent": "BOOKING_CREATED",
     "createdAt": "2026-06-01T10:00:00Z",
     "payload": {
       "uid": "test-booking-uid-123",
       "title": "Test Meeting",
       "startTime": "2026-06-01T10:00:00Z",
       "endTime": "2026-06-01T10:30:00Z",
       "status": "ACCEPTED"
     }
   }
   ```
   - Expected: 200 (processed, or 404 if no matching meeting -- but not 401)

2. **Send with invalid signature**
   ```
   POST /api/webhooks/calcom
   Headers:
     x-cal-signature-256: invalid-signature-value
     Content-Type: application/json
   Body: (same as above)
   ```
   - Expected: 401 `{ "error": "Invalid signature" }`

3. **Send with missing signature**
   ```
   POST /api/webhooks/calcom
   Headers:
     Content-Type: application/json
   Body: (same as above)
   ```
   - Expected: 200 (signature check is skipped when header is empty -- note this may be a security concern to revisit)

#### mOperator Webhook Secret Verification

4. **Send with valid secret**
   ```
   POST /api/webhooks/moperator
   Headers:
     x-webhook-secret: {MOPERATOR_WEBHOOK_SECRET}
     Content-Type: application/json
   Body:
   {
     "eventId": "{validEventId}",
     "accountName": "Test Co",
     "guestName": "Test Guest",
     "guestEmail": "test@testco.com",
     "requesterName": "Requester",
     "requesterEmail": "req@company.com"
   }
   ```
   - Expected: 201 (request created)

5. **Send with wrong secret**
   ```
   POST /api/webhooks/moperator
   Headers:
     x-webhook-secret: wrong-secret
   Body: (same as above)
   ```
   - Expected: 401 `{ "error": "Unauthorized" }`

6. **Send with missing secret (when env var is set)**
   ```
   POST /api/webhooks/moperator
   Headers:
     Content-Type: application/json
   Body: (same as above)
   ```
   - Expected: 401

#### Cron Endpoint Auth

7. **Call cron without auth**
   ```
   POST /api/cron/poll-rsvp
   ```
   - Expected: 401 `{ "error": "Unauthorized" }`

8. **Call cron with wrong bearer token**
   ```
   POST /api/cron/poll-rsvp
   Authorization: Bearer wrong-token
   ```
   - Expected: 401

9. **Call cron with correct bearer token**
   ```
   POST /api/cron/poll-rsvp
   Authorization: Bearer {CRON_SECRET}
   ```
   - Expected: 200

### Pass Criteria
- Cal.com webhooks reject invalid signatures
- mOperator webhooks reject wrong/missing secrets
- Cron endpoints reject unauthorized requests
- All accept valid credentials

---

## Scenario 7: Double-Booking Prevention

**Goal:** Verify that room conflict detection prevents overlapping meetings in the same room across all code paths.

### Preconditions
- An event with at least 2 rooms exists
- One room has an existing meeting booked (e.g., 10:00-10:30 AM on a specific date)

### Steps

#### Path 1: POST /api/meetings (direct booking)

1. **Attempt to book overlapping meeting in same room**
   ```
   POST /api/meetings
   {
     "title": "Conflicting Meeting",
     "eventId": "{eventId}",
     "startTime": "2026-06-01T10:15:00-07:00",
     "endTime": "2026-06-01T10:45:00-07:00",
     "timezone": "America/Los_Angeles",
     "durationMinutes": 30,
     "roomId": "{roomId}",
     "participantIds": [],
     "externalAttendeeName": "Conflict Test",
     "externalAttendeeEmail": "conflict@test.com"
   }
   ```
   - Expected: **409** with `error: "Room conflict"` and `conflictingMeeting` details
   - The conflicting meeting's `id`, `title`, `startTime`, and `endTime` should be in the response

2. **Book in a different room at the same time (should succeed)**
   ```
   POST /api/meetings
   { ...same body but "roomId": "{differentRoomId}" }
   ```
   - Expected: **201** (no conflict -- different room)

3. **Book in the same room at a non-overlapping time (should succeed)**
   ```
   POST /api/meetings
   { ...same body but "startTime": "2026-06-01T11:00:00-07:00", "endTime": "2026-06-01T11:30:00-07:00" }
   ```
   - Expected: **201** (no conflict -- different time)

4. **Test exact boundary (end == start, should succeed)**
   ```
   POST /api/meetings
   { ...same body but "startTime": "2026-06-01T10:30:00-07:00", "endTime": "2026-06-01T11:00:00-07:00" }
   ```
   - Expected: **201** (meetings are back-to-back, not overlapping)

#### Path 2: AI Agent

5. **Via chat, ask the AI to book a conflicting slot**
   - "Book a meeting with {personName} in {roomName} on June 1 at 10:15 AM for 30 minutes with guest John Doe (john@test.com)"
   - Expected: agent reports the room conflict and suggests alternative times

#### Path 3: Meeting request approval

6. **Create a meeting request, then approve with conflicting time**
   ```
   PATCH /api/meeting-requests/{requestId}
   {
     "status": "approved",
     "roomId": "{roomId}",
     "startTime": "2026-06-01T10:00:00-07:00",
     "endTime": "2026-06-01T10:30:00-07:00",
     "durationMinutes": 30,
     "participantIds": []
   }
   ```
   - Expected: **409** with room conflict error

#### Path 4: PATCH room change

7. **Create a meeting in Room B, then try to move it to Room A (which has a conflict)**
   ```
   PATCH /api/meetings/{roomBMeetingId}
   { "roomId": "{roomAId}" }
   ```
   - Expected: **409** if Room A has an overlapping meeting at the same time

8. **Move to Room A at a non-conflicting time (room B meeting doesn't overlap)**
   - If the Room B meeting is at a time when Room A is free, the PATCH should succeed
   - Expected: **200**

#### Path 5: Silent update time change

9. **Silently move a meeting's time to overlap with another meeting in the same room**
   ```
   PATCH /api/meetings/{meetingId}/silent-update
   {
     "newStartTime": "2026-06-01T10:00:00.000Z",
     "newEndTime": "2026-06-01T10:30:00.000Z"
   }
   ```
   - Expected: **409** if another meeting exists in that room at that time

#### Edge cases

10. **Cancelled meetings don't block**
    - Cancel the existing meeting (`DELETE /api/meetings/{meetingId}`)
    - Retry the conflicting booking from step 1
    - Expected: **201** (cancelled meetings are excluded from conflict checks)

11. **Meeting doesn't conflict with itself**
    - PATCH a meeting's roomId to its current room (no-op room change)
    - Expected: **200** (excludeMeetingId prevents self-conflict)

### Pass Criteria
- All 5 code paths reject overlapping bookings with 409
- Different rooms at the same time: allowed
- Adjacent (back-to-back) meetings: allowed
- Cancelled/rescheduled meetings: don't block
- Self-conflict: prevented by excludeMeetingId

---

## Scenario 8: Authentication & Access Control

**Goal:** Verify authentication is enforced and test the auth flow.

### Steps

#### Unauthenticated Access

1. **Access a protected page without auth**
   - Open `/dashboard` in an incognito browser
   - Expected: redirected to `/login`

2. **Call an API without a session**
   ```
   GET /api/events
   ```
   - Note: Currently, API routes may NOT enforce auth (this is a known gap). Document actual behavior:
     - If 401: auth is enforced -- good
     - If 200: auth is NOT enforced on API routes -- flag for follow-up

#### Credentials Login

3. **Log in with email (development mode)**
   - Go to `/login`
   - Enter any email address (e.g., `test@company.com`)
   - Expected: auto-creates user and redirects to `/dashboard`
   - Verify: user appears in the database with `role: "marketing"` (default)

4. **Verify session persists**
   - Navigate between pages (`/events`, `/goals`, `/people`)
   - Expected: no re-auth required, user name visible in header

#### Google OAuth Login

5. **Log in with Google** (if `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` configured)
   - Click "Sign in with Google" on `/login`
   - Complete OAuth flow
   - Expected: redirected to `/dashboard` with Google profile info

#### Role Behavior

6. **Check user role assignment**
   - After login, check the session/JWT:
     ```
     GET /api/auth/session
     ```
   - Expected: `role` field is present (`marketing`, `ae`, `exec`, or `admin`)

7. **Test role-based UI differences** (if implemented)
   - Log in as different roles
   - Verify sidebar/navigation shows appropriate links
   - Note: RBAC is not currently enforced on API routes -- document this gap

#### Session Expiry

8. **Test session expiry**
   - Log in, then wait for JWT expiry (or manually clear cookies)
   - Try accessing `/dashboard`
   - Expected: redirected to `/login`

### Pass Criteria
- Protected pages require authentication
- Login flows work (credentials + Google OAuth)
- Sessions persist across navigation
- Known gap: API routes lack role-based access control (document for future work)

---

## Quick Reference: Common curl Commands

```bash
# Set base URL
BASE=http://localhost:3000

# Create event
curl -s -X POST $BASE/api/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Event","location":"Test City","startDate":"2026-06-01","endDate":"2026-06-03","timezone":"America/Los_Angeles"}'

# List events
curl -s $BASE/api/events | jq .

# Create room
curl -s -X POST $BASE/api/events/{eventId}/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"Suite 101","capacity":8,"meetingDurationMinutes":30,"breakDurationMinutes":10}'

# Book meeting
curl -s -X POST $BASE/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Meeting","eventId":"{eventId}","startTime":"2026-06-01T10:00:00-07:00","endTime":"2026-06-01T10:30:00-07:00","timezone":"America/Los_Angeles","durationMinutes":30,"roomId":"{roomId}","participantIds":[],"externalAttendeeName":"Jane Doe","externalAttendeeEmail":"jane@example.com"}'

# Trigger cron jobs
curl -s -X POST $BASE/api/cron/poll-rsvp -H "Authorization: Bearer $CRON_SECRET"
curl -s -X POST $BASE/api/cron/recalculate-goals -H "Authorization: Bearer $CRON_SECRET"

# Send mOperator webhook
curl -s -X POST $BASE/api/webhooks/moperator \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $MOPERATOR_WEBHOOK_SECRET" \
  -d '{"eventId":"{eventId}","accountName":"Test Co","guestName":"Bob","guestEmail":"bob@test.com","requesterName":"Alice","requesterEmail":"alice@co.com"}'
```
