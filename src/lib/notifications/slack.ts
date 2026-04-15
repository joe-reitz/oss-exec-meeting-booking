const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

interface SlackNotification {
  text: string;
  blocks?: Array<Record<string, unknown>>;
}

export async function sendSlackNotification(
  payload: SlackNotification
): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not configured — skipping notification");
    return false;
  }

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

export async function sendSlackDM(email: string, message: string): Promise<boolean> {
  const moperatorUrl = process.env.MOPERATOR_API_URL;
  const moperatorKey = process.env.MOPERATOR_API_KEY;
  if (!moperatorUrl || !moperatorKey) {
    console.warn("mOperator not configured — skipping Slack DM");
    return false;
  }

  try {
    const res = await fetch(`${moperatorUrl}/api/notifications/slack-dm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": moperatorKey,
      },
      body: JSON.stringify({ email, message }),
    });
    return res.ok;
  } catch (error) {
    console.error("Failed to send Slack DM:", error);
    return false;
  }
}

export function buildInfoRequestedMessage(opts: {
  accountName: string;
  requesterName: string;
  message: string;
  requestUrl: string;
}) {
  return `Hey ${opts.requesterName}, we need more info on your meeting request for *${opts.accountName}*:\n\n> ${opts.message}\n\nUpdate your request here: ${opts.requestUrl}`;
}

export function buildRequestApprovedMessage(opts: {
  accountName: string;
  guestName: string;
  eventName: string;
  meetingUrl: string;
}) {
  return {
    text: `Meeting request approved: ${opts.accountName} — ${opts.guestName} at ${opts.eventName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Meeting Request Approved* :white_check_mark:\n*Account:* ${opts.accountName}\n*Guest:* ${opts.guestName}\n*Event:* ${opts.eventName}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Meeting" },
            url: opts.meetingUrl,
          },
        ],
      },
    ],
  };
}
