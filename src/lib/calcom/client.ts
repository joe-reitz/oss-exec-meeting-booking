const CALCOM_API_URL = process.env.CALCOM_API_URL || "https://api.cal.com/v2";
const CALCOM_API_KEY = process.env.CALCOM_API_KEY;

export async function calcomFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!CALCOM_API_KEY) {
    throw new Error("CALCOM_API_KEY environment variable is not set");
  }

  const res = await fetch(`${CALCOM_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
      Authorization: `Bearer ${CALCOM_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Cal.com API error ${res.status}: ${error}`);
  }

  return res.json();
}
