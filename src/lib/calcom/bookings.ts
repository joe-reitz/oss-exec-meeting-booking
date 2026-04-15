import { calcomFetch } from "./client";

// ─── Request / Response Types ────────────────────────────────────────

export interface CreateBookingAttendee {
  name: string;
  email: string;
  timeZone: string;
}

export interface CreateBookingRequest {
  eventTypeId: number;
  start: string;
  attendee: CreateBookingAttendee;
  guests?: string[];
  location?: { type: string; address: string };
  metadata?: Record<string, unknown>;
  bookingFieldsResponses?: Record<string, unknown>;
  allowConflicts?: boolean;
}

export interface CalcomBooking {
  id: number;
  uid: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  status: string;
  attendees: Array<{
    name: string;
    email: string;
    timeZone: string;
  }>;
  metadata: Record<string, unknown> | null;
  meetingUrl: string | null;
  references?: Array<{
    type: string;
    uid: string;
    meetingId?: string;
    meetingUrl?: string;
    externalCalendarId?: string;
  }>;
}

export interface CalcomBookingResponse {
  status: string;
  data: CalcomBooking;
}

export interface CancelBookingRequest {
  cancellationReason?: string;
}

// ─── API Functions ───────────────────────────────────────────────────

/**
 * Create a new booking via the Cal.com API.
 * POST /v2/bookings
 */
export async function createBooking(
  data: CreateBookingRequest
): Promise<CalcomBookingResponse> {
  return calcomFetch<CalcomBookingResponse>("/bookings", {
    method: "POST",
    headers: {
      "cal-api-version": "2026-02-25",
    },
    body: JSON.stringify(data),
  });
}

/**
 * Get a single booking by its UID.
 * GET /v2/bookings/{uid}
 */
export async function getBooking(
  bookingUid: string
): Promise<CalcomBookingResponse> {
  return calcomFetch<CalcomBookingResponse>(`/bookings/${bookingUid}`);
}

/**
 * Cancel a booking by its UID.
 * DELETE /v2/bookings/{uid}/cancel
 */
export async function cancelBooking(
  bookingUid: string,
  reason?: string
): Promise<CalcomBookingResponse> {
  return calcomFetch<CalcomBookingResponse>(`/bookings/${bookingUid}/cancel`, {
    method: "DELETE",
    body: JSON.stringify({
      cancellationReason: reason,
    } satisfies CancelBookingRequest),
  });
}
