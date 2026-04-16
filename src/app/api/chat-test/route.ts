import { NextResponse } from "next/server";

/**
 * GET /api/chat-test — minimal test of AI Gateway connectivity.
 * Hit this URL in the browser to see if the gateway works.
 */
export async function GET() {
  const gatewayUrl = process.env.AI_GATEWAY_URL;
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "AI_GATEWAY_API_KEY not set" });
  }
  if (!gatewayUrl) {
    return NextResponse.json({ error: "AI_GATEWAY_URL not set" });
  }

  const baseURL = gatewayUrl.endsWith("/v1") ? gatewayUrl : `${gatewayUrl}/v1`;

  try {
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "Say hello in exactly 3 words." }],
        max_tokens: 50,
        stream: false,
      }),
    });

    const data = await res.text();
    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      baseURL,
      response: data.slice(0, 500),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
      baseURL,
      hasKey: true,
    });
  }
}
