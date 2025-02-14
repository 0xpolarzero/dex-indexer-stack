import { afterAll, beforeAll, describe, it } from "vitest";

import { benchmark, BenchmarkMetrics, logMetrics, writeMetricsToFile } from "../lib/benchmarks";
import { clearCache, createClientCacheBypass, createClientCached, createClientNoCache } from "../lib/common";
import { ITERATIONS } from "./config";

describe("GetTokenPricesSince benchmarks", () => {
  let tokens: string[] = [];
  const metrics: BenchmarkMetrics[] = [];

  beforeAll(async () => {
    const client = await createClientNoCache();

    const refreshRes = await client.db.RefreshTokenRollingStats30MinMutation();
    if (refreshRes.error || !refreshRes.data?.api_refresh_token_rolling_stats_30min?.success)
      throw new Error("Error refreshing token rolling stats");

    // Get all tokens
    const allTokensRes = await client.db.GetAllTokensQuery();
    if (allTokensRes.error || !allTokensRes.data?.token_rolling_stats_30min) throw new Error("No tokens found");
    tokens = allTokensRes.data?.token_rolling_stats_30min.map((t) => t.mint).filter((t) => t !== null) || [];
  });

  it("should measure direct Hasura performance", async () => {
    const metric = await benchmark<"GetTokenPricesSinceQuery">({
      identifier: "Direct Hasura hit",
      exec: async (i) => {
        const client = await createClientNoCache();
        return await client.db.GetTokenPricesSinceQuery({
          token: tokens[i],
          since: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5min ago
        });
      },
      iterations: ITERATIONS,
      after: (res) => {
        if (res.error) throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  it("should measure warm cache performance", async () => {
    // Cache warmup
    for (let i = 0; i < ITERATIONS; i++) {
      const client = await createClientCached();
      await client.db.GetTokenPricesSinceQuery({
        token: tokens[i],
        since: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5min ago
      });
    }

    const metric = await benchmark<"GetTokenPricesSinceQuery">({
      identifier: "Warm cache hit",
      exec: async (i) => {
        const client = await createClientCached();

        return await client.db.GetTokenPricesSinceQuery({
          token: tokens[i],
        });
      },
      iterations: ITERATIONS,
      after: (res) => {
        if (res.error) throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  it("should measure cold cache performance", async () => {
    const metric = await benchmark<"GetTokenPricesSinceQuery">({
      identifier: "Cold cache hit",
      exec: async (i) => {
        const client = await createClientCached();

        return await client.db.GetTokenPricesSinceQuery({
          token: tokens[i],
          since: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5min ago
        });
      },
      iterations: ITERATIONS,
      before: async () => await clearCache(),
      after: (res) => {
        if (res.error) throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  it("should measure bypassing cache performance", async () => {
    const metric = await benchmark<"GetTokenPricesSinceQuery">({
      identifier: "Bypassing cache",
      exec: async (i) => {
        const client = await createClientCacheBypass();
        return await client.db.GetTokenPricesSinceQuery({
          token: tokens[i],
          since: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5min ago
        });
      },
      iterations: ITERATIONS,
      after: (res) => {
        if (res.error) throw new Error("Error or no tokens found");
      },
    });

    metrics.push({ ...metric, group: "A" });
  });

  afterAll(() => {
    logMetrics(metrics);
    writeMetricsToFile(metrics, "GetTokenPricesSince");
  });
});
