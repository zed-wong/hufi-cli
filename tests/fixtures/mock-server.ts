interface MockServers {
  recordingUrl: string;
  launcherUrl: string;
  stop: () => void;
}

export function startMockApis(): MockServers {
  const recording = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);

      if (req.method === "POST" && url.pathname === "/auth/nonce") {
        return new Response(JSON.stringify({ nonce: "mock-nonce", address: "0x0000000000000000000000000000000000000001" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname === "/auth") {
        return new Response(JSON.stringify({ access_token: "mock-access-token" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET" && url.pathname === "/campaigns") {
        return new Response(JSON.stringify({
          has_more: true,
          results: [
            {
              id: "mock-recording-campaign",
              chain_id: 137,
              address: "0x1111111111111111111111111111111111111111",
              status: "active",
              exchange_name: "mexc",
              symbol: "MOCK/USDT",
              type: "MARKET_MAKING",
            },
          ],
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname === "/campaigns/check-join-status") {
        return new Response(JSON.stringify({ status: "join_open" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname === "/campaigns/join") {
        return new Response(JSON.stringify({ id: "mock-joined-campaign" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET" && url.pathname.includes("/my-progress")) {
        return new Response(JSON.stringify({ my_score: 77, current_progress: 88 }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET" && url.pathname.includes("/leaderboard")) {
        return new Response(JSON.stringify({
          data: [
            {
              address: "0x5555555555555555555555555555555555555555",
              score: 98.76,
              result: 12.34,
              estimated_reward: 7.89,
            },
          ],
          total: 150,
          updated_at: "2026-03-22T10:11:12.000Z",
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname === "/exchange-api-keys") {
        return new Response(JSON.stringify({ id: "mock-exchange-key" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "DELETE" && url.pathname.startsWith("/exchange-api-keys/")) {
        return new Response(JSON.stringify({ deleted: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST" && url.pathname.endsWith("/revalidate")) {
        return new Response(JSON.stringify({ is_valid: true, missing_permissions: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET" && url.pathname === "/exchange-api-keys") {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ message: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const launcher = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      if (req.method === "GET" && url.pathname === "/campaigns") {
        return new Response(JSON.stringify({
          has_more: true,
          results: [
            {
              chain_id: 137,
              address: "0x1111111111111111111111111111111111111111",
              type: "MARKET_MAKING",
              exchange_name: "mexc",
              symbol: "MOCK/USDT",
              status: "active",
              fund_amount: "1000000",
              fund_token: "USDT",
              fund_token_symbol: "USDT",
              fund_token_decimals: 6,
              balance: "900000",
              amount_paid: "100000",
              start_date: "2026-01-01T00:00:00.000Z",
              end_date: "2026-01-02T00:00:00.000Z",
              launcher: "mock-launcher",
              exchange_oracle: "0x2222222222222222222222222222222222222222",
              recording_oracle: "0x3333333333333333333333333333333333333333",
              reputation_oracle: "0x4444444444444444444444444444444444444444",
            },
          ],
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ message: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  return {
    recordingUrl: `http://localhost:${recording.port}`,
    launcherUrl: `http://localhost:${launcher.port}`,
    stop: () => {
      recording.stop();
      launcher.stop();
    },
  };
}
