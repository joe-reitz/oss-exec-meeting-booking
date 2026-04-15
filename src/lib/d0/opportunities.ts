import { d0Fetch } from "./client";

export interface D0Opportunity {
  id: string;
  name: string;
  accountId: string | null;
  accountName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  stageName: string | null;
  amount: number | null;
  closeDate: string | null;
  probability: number | null;
  type: string | null;
}

interface D0OpportunityFilters {
  ownerId?: string;
  accountId?: string;
  stageName?: string;
}

/**
 * Fetches opportunities from the d0 API with optional filters.
 */
export async function getOpportunities(
  filters?: D0OpportunityFilters
): Promise<D0Opportunity[]> {
  const params = new URLSearchParams();

  if (filters?.ownerId) {
    params.set("ownerId", filters.ownerId);
  }
  if (filters?.accountId) {
    params.set("accountId", filters.accountId);
  }
  if (filters?.stageName) {
    params.set("stageName", filters.stageName);
  }

  const query = params.toString();
  const path = `/opportunities${query ? `?${query}` : ""}`;

  return d0Fetch<D0Opportunity[]>(path);
}

/**
 * Fetches a single opportunity by ID from the d0 API.
 */
export async function getOpportunityById(
  id: string
): Promise<D0Opportunity> {
  return d0Fetch<D0Opportunity>(`/opportunities/${id}`);
}
