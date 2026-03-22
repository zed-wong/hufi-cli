import { test, expect, describe } from "bun:test";

describe("listLauncherCampaigns", () => {
  test("forwards page and page-size query params", async () => {
    const { listLauncherCampaigns } = await import("../../../src/services/launcher/campaign.ts");

    let seenUrl = "";
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        seenUrl = req.url;
        return new Response(JSON.stringify({ has_more: false, results: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    try {
      await listLauncherCampaigns(
        `http://localhost:${server.port}`,
        137,
        25,
        "active",
        3
      );

      expect(seenUrl).toContain("chain_id=137");
      expect(seenUrl).toContain("limit=25");
      expect(seenUrl).toContain("page=3");
    } finally {
      server.stop();
    }
  });
});
