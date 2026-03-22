export interface CampaignCreateParams {
  type: "MARKET_MAKING" | "HOLDING" | "THRESHOLD";
  exchange: string;
  pair?: string;
  symbol?: string;
  startDate: string;
  endDate: string;
  fundToken: string;
  fundAmount: string;
  dailyVolumeTarget?: number;
  dailyBalanceTarget?: number;
  minimumBalanceTarget?: number;
}

export interface CampaignCreateResult {
  escrowAddress: string;
  txHash: string;
}
