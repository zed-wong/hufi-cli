import { test, expect, describe } from "bun:test";

describe("campaign create output formatting", () => {
  test("formats pending and confirmation progress messages", async () => {
    const { formatCampaignCreateProgress } = await import("../../src/commands/campaign.ts");

    expect(formatCampaignCreateProgress(0)).toBe("Transaction submitted. Waiting for confirmations...");
    expect(formatCampaignCreateProgress(1)).toBe("Confirmations: 1");
  });
});
