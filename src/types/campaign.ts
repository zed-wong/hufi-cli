export interface JoinStatus {
  status: string;
  joined_at?: string;
  reason?: string;
}

export interface JoinResult {
  id: string;
}

export interface Campaign {
  id: string;
  chain_id?: number;
  address?: string;
  [key: string]: unknown;
}

export interface CampaignListResult {
  results: Campaign[];
  total?: number;
}
