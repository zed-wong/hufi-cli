export interface LauncherCampaign {
  id: string;
  name: string;
  chain_id: number;
  escrow_address?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  [key: string]: unknown;
}

export interface LauncherCampaignList {
  results: LauncherCampaign[];
  total?: number;
}

export interface CreateCampaignParams {
  name: string;
  chain_id: number;
  reward_token?: string;
  reward_amount?: string;
  start_time?: string;
  end_time?: string;
  [key: string]: unknown;
}
