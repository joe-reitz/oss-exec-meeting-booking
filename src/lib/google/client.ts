import { google, calendar_v3 } from "googleapis";

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

/**
 * Returns a Google Calendar client, optionally impersonating a user
 * via domain-wide delegation.
 */
export function getCalendarClient(
  impersonateEmail?: string
): calendar_v3.Calendar {
  const client = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: impersonateEmail,
  });

  return google.calendar({
    version: "v3",
    auth: impersonateEmail ? client : auth,
  });
}
