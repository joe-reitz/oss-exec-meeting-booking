import { calcomFetch } from "./client";

export interface CalcomSlot {
  time: string;
}

export interface CalcomSlotsResponse {
  status: string;
  data: {
    slots: Record<string, CalcomSlot[]>;
  };
}

export interface GetAvailableSlotsParams {
  startTime: string;
  endTime: string;
  eventTypeId?: number;
  usernames?: string[];
}

/**
 * Query Cal.com for available time slots within a date range.
 * Uses GET /v2/slots/available with query parameters.
 */
export async function getAvailableSlots(
  params: GetAvailableSlotsParams
): Promise<CalcomSlotsResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("startTime", params.startTime);
  searchParams.set("endTime", params.endTime);

  if (params.eventTypeId) {
    searchParams.set("eventTypeId", params.eventTypeId.toString());
  }

  if (params.usernames && params.usernames.length > 0) {
    for (const username of params.usernames) {
      searchParams.append("usernames", username);
    }
  }

  return calcomFetch<CalcomSlotsResponse>(
    `/slots/available?${searchParams.toString()}`
  );
}
