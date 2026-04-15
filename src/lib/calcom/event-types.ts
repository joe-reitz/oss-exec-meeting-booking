import { calcomFetch } from "./client";

interface CreateEventTypeParams {
  title: string;
  lengthInMinutes: number;
  description?: string;
  location?: string;
}

interface CalcomEventType {
  id: number;
  title: string;
  slug: string;
  lengthInMinutes: number;
}

interface CalcomEventTypeResponse {
  status: string;
  data: CalcomEventType;
}

export async function createEventType({
  title,
  lengthInMinutes,
  description,
  location,
}: CreateEventTypeParams): Promise<CalcomEventType> {
  const slug = `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${Date.now()}`;

  const body: Record<string, unknown> = {
    title,
    slug,
    lengthInMinutes,
    description: description ?? `Meetings for ${title}`,
    disableBookingConfirmationEmails: true,
  };

  if (location) {
    body.locations = [{ type: "address", address: location, public: true }];
  }

  const res = await calcomFetch<CalcomEventTypeResponse>("/event-types", {
    method: "POST",
    headers: {
      "cal-api-version": "2024-06-14",
    },
    body: JSON.stringify(body),
  });

  return res.data;
}

/**
 * Patch an existing Cal.com event type (e.g. to disable confirmation emails).
 */
export async function patchEventType(
  eventTypeId: number,
  updates: Record<string, unknown>
): Promise<void> {
  await calcomFetch(`/event-types/${eventTypeId}`, {
    method: "PATCH",
    headers: {
      "cal-api-version": "2024-06-14",
    },
    body: JSON.stringify(updates),
  });
}
