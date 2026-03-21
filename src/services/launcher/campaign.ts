import { requestJson } from "../../lib/http.ts";
import type {
  LauncherCampaign,
  LauncherCampaignList,
} from "../../types/launcher.ts";

export async function listLauncherCampaigns(
  baseUrl: string,
  chainId: number,
  limit = 20
): Promise<LauncherCampaignList> {
  const url = `${baseUrl}/campaigns?chain_id=${chainId}&limit=${limit}`;
  return (await requestJson(url)) as LauncherCampaignList;
}

export async function getLauncherCampaign(
  baseUrl: string,
  chainId: number,
  campaignAddress: string
): Promise<LauncherCampaign> {
  const url = `${baseUrl}/campaigns/${chainId}-${campaignAddress}`;
  return (await requestJson(url)) as LauncherCampaign;
}
