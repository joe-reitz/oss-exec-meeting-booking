import { calcomFetch } from "./client";

const CALCOM_ORG_ID = process.env.CALCOM_ORG_ID;

interface CalcomOrgUser {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  profile?: {
    username: string | null;
  };
}

interface CalcomOrgUsersResponse {
  status: string;
  data: CalcomOrgUser[];
}

export async function listOrgUsers(): Promise<CalcomOrgUser[]> {
  if (!CALCOM_ORG_ID) {
    throw new Error("CALCOM_ORG_ID environment variable is not set");
  }

  const res = await calcomFetch<CalcomOrgUsersResponse>(
    `/organizations/${CALCOM_ORG_ID}/users?take=500`
  );

  return res.data;
}
