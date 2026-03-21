import { requestJson, authHeaders } from "../../lib/http.ts";
import type {
  JoinStatus,
  JoinResult,
  CampaignListResult,
} from "../../types/campaign.ts";

export async function checkJoinStatus(
  baseUrl: string,
  accessToken: string,
  chainId: number,
  address: string
): Promise<JoinStatus> {
  return (await requestJson(`${baseUrl}/campaigns/check-join-status`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ chain_id: chainId, address }),
  })) as JoinStatus;
}

export async function joinCampaign(
  baseUrl: string,
  accessToken: string,
  chainId: number,
  address: string
): Promise<JoinResult> {
  return (await requestJson(`${baseUrl}/campaigns/join`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ chain_id: chainId, address }),
  })) as JoinResult;
}

export async function listJoinedCampaigns(
  baseUrl: string,
  accessToken: string,
  limit = 20
): Promise<CampaignListResult> {
  return (await requestJson(
    `${baseUrl}/campaigns?limit=${limit}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
    }
  )) as CampaignListResult;
}

export async function getMyProgress(
  baseUrl: string,
  accessToken: string,
  chainId: number,
  campaignAddress: string
): Promise<unknown> {
  return requestJson(
    `${baseUrl}/campaigns/${chainId}-${campaignAddress}/my-progress`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
    }
  );
}

export async function getLeaderboard(
  baseUrl: string,
  chainId: number,
  campaignAddress: string,
  rankBy: string,
  limit = 20
): Promise<{ data: { address: string; result: number }[] }> {
  return (await requestJson(
    `${baseUrl}/campaigns/${chainId}-${campaignAddress}/leaderboard?rankBy=${rankBy}&limit=${limit}`
  )) as { data: { address: string; result: number }[] };
}
