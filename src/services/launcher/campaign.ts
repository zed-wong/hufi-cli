import { requestJson, authHeaders } from "../../lib/http.ts";
import type {
  LauncherCampaign,
  LauncherCampaignList,
  CreateCampaignParams,
} from "../../types/launcher.ts";

export async function listLauncherCampaigns(
  baseUrl: string,
  accessToken: string,
  limit = 20
): Promise<LauncherCampaignList> {
  return (await requestJson(`${baseUrl}/campaigns?limit=${limit}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  })) as LauncherCampaignList;
}

export async function getLauncherCampaign(
  baseUrl: string,
  accessToken: string,
  campaignId: string
): Promise<LauncherCampaign> {
  return (await requestJson(`${baseUrl}/campaigns/${campaignId}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  })) as LauncherCampaign;
}

export async function createLauncherCampaign(
  baseUrl: string,
  accessToken: string,
  params: CreateCampaignParams
): Promise<LauncherCampaign> {
  return (await requestJson(`${baseUrl}/campaigns`, {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(params),
  })) as LauncherCampaign;
}
