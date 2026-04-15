import { streamText, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { schedulingTools } from "@/lib/ai/scheduling-agent";

const gatewayUrl = process.env.AI_GATEWAY_URL || "https://ai-gateway.vercel.sh";
const baseURL = gatewayUrl.endsWith("/v1") ? gatewayUrl : `${gatewayUrl}/v1`;

const gateway = createOpenAI({
  baseURL,
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const SYSTEM_PROMPT = `You are a helpful scheduling assistant for Vercel's marketing team. You help find availability and book meetings between Vercel executives/AEs and external contacts at conferences and events.

Key capabilities:
- Look up executives and account executives by name
- Find available meeting time slots across multiple participants
- List events (conferences) and their rooms
- Check progress toward meeting goals
- Book meetings (only after explicit user confirmation)

When a user asks to book a meeting:
1. Help them identify the right participants (execs and AEs) using lookupPerson
2. Determine the event/conference using listEvents
3. Find available rooms using listRooms
4. Find available time slots using findAvailability
5. Present options clearly and ask the user to pick a slot
6. Confirm ALL details before booking: title, participants, external attendee (name, email, company), time, room
7. Only call bookMeeting after the user explicitly confirms all details

When presenting availability:
- Format time slots clearly with day, date, and time
- Group slots by day if there are many
- Suggest the most convenient options first

Be concise and helpful. Use a professional but friendly tone. If you're unsure about something, ask for clarification.

Today's date is ${new Date().toISOString().split("T")[0]}.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawMessages = body.messages ?? [];

    // Filter to only valid user/assistant messages — remove system messages
    // and any malformed entries that could cause "messages do not match" errors
    const messages = rawMessages.filter(
      (m: { role: string }) => m.role === "user" || m.role === "assistant"
    );

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid messages provided" }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const result = streamText({
      model: gateway("anthropic/claude-sonnet-4-20250514"),
      system: SYSTEM_PROMPT,
      messages,
      tools: schedulingTools,
      stopWhen: stepCountIs(10),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Chat request failed";
    console.error("[/api/chat] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
