import { d0Fetch } from "./client";

export interface PipelineStageSummary {
  stageName: string;
  totalAmount: number;
  count: number;
}

export interface AccountCoverageResult {
  accountId: string;
  accountName: string;
  opportunityCount: number;
  totalAmount: number;
}

/**
 * Returns pipeline dollar amounts grouped by opportunity stage.
 */
export async function getPipelineSummary(): Promise<PipelineStageSummary[]> {
  return d0Fetch<PipelineStageSummary[]>("/analytics/pipeline-summary");
}

/**
 * Returns coverage data for a list of account IDs --
 * how many opportunities exist and their total dollar value.
 */
export async function getAccountCoverage(
  accountIds: string[]
): Promise<AccountCoverageResult[]> {
  return d0Fetch<AccountCoverageResult[]>("/analytics/account-coverage", {
    method: "POST",
    body: JSON.stringify({ accountIds }),
  });
}
