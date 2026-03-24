import { Interface } from "ethers";

interface JsonRpcRequest {
  id?: number | string | null;
  method?: string;
  params?: unknown[];
}

const stakingInterface = new Interface([
  "function getAvailableStake(address _staker) external view returns (uint256)",
  "function getStakedTokens(address _staker) external view returns (uint256)",
  "function minimumStake() external view returns (uint256)",
  "function lockPeriod() external view returns (uint32)",
]);

const erc20Interface = new Interface([
  "function balanceOf(address) external view returns (uint256)",
]);

const selectors = {
  getAvailableStake: stakingInterface.getFunction("getAvailableStake")!.selector,
  getStakedTokens: stakingInterface.getFunction("getStakedTokens")!.selector,
  minimumStake: stakingInterface.getFunction("minimumStake")!.selector,
  lockPeriod: stakingInterface.getFunction("lockPeriod")!.selector,
  balanceOf: erc20Interface.getFunction("balanceOf")!.selector,
};

function encodeResult(method: string): string {
  switch (method) {
    case selectors.getStakedTokens:
      return stakingInterface.encodeFunctionResult("getStakedTokens", [0n]);
    case selectors.getAvailableStake:
      return stakingInterface.encodeFunctionResult("getAvailableStake", [0n]);
    case selectors.minimumStake:
      return stakingInterface.encodeFunctionResult("minimumStake", [1n]);
    case selectors.lockPeriod:
      return stakingInterface.encodeFunctionResult("lockPeriod", [1000]);
    case selectors.balanceOf:
      return erc20Interface.encodeFunctionResult("balanceOf", [0n]);
    default:
      throw new Error(`Unsupported eth_call selector: ${method}`);
  }
}

export interface MockRpcServer {
  url: string;
  stop: () => void;
}

export function startMockRpcServer(): MockRpcServer {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const body = (await req.json()) as JsonRpcRequest;
      const method = body.method;
      const id = body.id ?? 1;

      if (method === "eth_chainId") {
        return Response.json({ jsonrpc: "2.0", id, result: "0x89" });
      }

      if (method === "eth_blockNumber") {
        return Response.json({ jsonrpc: "2.0", id, result: "0x1" });
      }

      if (method === "eth_call") {
        const params = Array.isArray(body.params) ? body.params : [];
        const tx = (params[0] ?? {}) as Record<string, string>;
        const data = String(tx.data ?? "");
        const selector = data.slice(0, 10);

        try {
          return Response.json({
            jsonrpc: "2.0",
            id,
            result: encodeResult(selector),
          });
        } catch (error) {
          return Response.json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      return Response.json({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Unsupported method: ${method}`,
        },
      });
    },
  });

  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(),
  };
}

if (import.meta.main) {
  const server = startMockRpcServer();
  console.log(server.url);

  process.on("SIGTERM", () => {
    server.stop();
    process.exit(0);
  });

  await new Promise(() => {});
}
