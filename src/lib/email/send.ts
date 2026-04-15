import sgMail from "@sendgrid/mail";
import { renderBookingConfirmationHtml } from "./booking-confirmation";
import { generateIcs } from "./ics";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

// ─── Types ──────────────────────────────────────────────────────────

interface Attendee {
  name: string;
  email: string;
  title?: string;
  company?: string;
}

interface SendBookingEmailParams {
  meetingId: string;
  meetingTitle: string;
  startTime: string; // ISO
  endTime: string; // ISO
  timezone: string;
  durationMinutes: number;
  location?: string;
  description?: string;
  internalAttendees: Attendee[];
  externalAttendees: Attendee[];
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Title-case a name: "jane smith" → "Jane Smith", preserves acronyms like "CEO" */
function titleCase(str: string): string {
  return str.replace(
    /\b\w+/g,
    (word) => {
      // Preserve words that are already all-caps (acronyms: CEO, VP, CTO, etc.)
      if (word.length >= 2 && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
  );
}

// ─── Send ───────────────────────────────────────────────────────────

export async function sendBookingConfirmationEmail(
  params: SendBookingEmailParams
): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return; // no-op if not configured

  sgMail.setApiKey(apiKey);

  const {
    meetingId,
    meetingTitle,
    startTime,
    endTime,
    timezone,
    durationMinutes,
    location,
    description,
    internalAttendees,
    externalAttendees,
  } = params;

  // Format date/time for the email body
  const zonedStart = toZonedTime(new Date(startTime), timezone);
  const tzAbbr = timezone.includes("/")
    ? timezone.split("/").pop()!.replace(/_/g, " ")
    : timezone;
  const dateTime = `${format(zonedStart, "EEEE, MMMM d 'at' h:mm a")} (${tzAbbr})`;

  // Title-case all names for proper formatting
  const tcInternal = internalAttendees.map((a) => ({
    ...a,
    name: titleCase(a.name),
    title: a.title ? titleCase(a.title) : undefined,
  }));
  const tcExternal = externalAttendees.map((a) => ({
    ...a,
    name: titleCase(a.name),
    title: a.title ? titleCase(a.title) : undefined,
    company: a.company ? titleCase(a.company) : undefined,
  }));

  // Internal attendee names for the opening line
  const internalAttendeeNames = tcInternal.map((a) => a.name);

  // Build attendee lines for the template
  const attendeeNames = [
    ...tcInternal.map(
      (a) => `${a.name}${a.title ? `, ${a.title}` : ""}`
    ),
    ...tcExternal.map(
      (a) =>
        `${a.name}${a.title ? `, ${a.title}` : ""}${a.company ? ` — ${a.company}` : ""}`
    ),
  ];
  const attendeeLines = attendeeNames
    .map((name) => `<p style="margin: 0 0 0px 0;">&nbsp;&nbsp;• ${name}</p>`)
    .join("");

  // Generate .ics content
  const allAttendees = [
    ...tcInternal.map((a) => ({ name: a.name, email: a.email })),
    ...tcExternal.map((a) => ({ name: a.name, email: a.email })),
  ];

  const icsContent = generateIcs({
    title: meetingTitle,
    description,
    startTime,
    endTime,
    location,
    attendees: allAttendees,
  });

  // Build calendar URLs
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  const icsDownloadUrl = `${appUrl}/api/meetings/${meetingId}/ics`;

  // Google Calendar URL — opens directly in Google Calendar
  const gcalStart = new Date(startTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcalEnd = new Date(endTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const gcalParams = new URLSearchParams({
    action: "TEMPLATE",
    text: meetingTitle,
    dates: `${gcalStart}/${gcalEnd}`,
    ...(location ? { location } : {}),
    ...(description ? { details: description } : {}),
  });
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`;

  // Render HTML from the email template
  const html = renderBookingConfirmationHtml({
    internalAttendeeNames,
    dateTime,
    location,
    attendeeLines,
    googleCalendarUrl,
    icsDownloadUrl,
  });

  // Collect all recipient emails
  const toEmails = allAttendees.map((a) => a.email).filter(Boolean);
  if (toEmails.length === 0) return;

  const icsBase64 = Buffer.from(icsContent).toString("base64");

  const internalNames = internalAttendeeNames.join(" & ");
  const subject = internalNames
    ? `Meeting Confirmed with ${internalNames}`
    : `Meeting Confirmed: ${meetingTitle}`;

  await sgMail.send({
    to: toEmails,
    from: fromEmail,
    subject,
    html,
    attachments: [
      {
        content: icsBase64,
        filename: "invite.ics",
        type: "text/calendar; method=REQUEST",
        disposition: "attachment",
      },
    ],
  });
}
