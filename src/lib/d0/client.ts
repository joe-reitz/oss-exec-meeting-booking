const D0_API_URL = process.env.D0_API_URL;
const D0_API_KEY = process.env.D0_API_KEY;
const D0_BYPASS_SECRET = process.env.D0_BYPASS_SECRET;

export async function d0Fetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!D0_API_URL) {
    throw new Error("D0_API_URL environment variable is not configured");
  }
  if (!D0_API_KEY) {
    throw new Error("D0_API_KEY environment variable is not configured");
  }

  const res = await fetch(`${D0_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${D0_API_KEY}`,
      ...(D0_BYPASS_SECRET
        ? { "x-vercel-protection-bypass": D0_BYPASS_SECRET }
        : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`d0 API error ${res.status}: ${error}`);
  }

  return res.json();
}
