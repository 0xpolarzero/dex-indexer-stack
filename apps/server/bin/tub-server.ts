#!/usr/bin/env node
import { AppRouter, createAppRouter } from "@/createAppRouter";
import { OctaneService } from "@/OctaneService";
import { TubService } from "@/TubService";
import { parseEnv } from "@bin/parseEnv";
import { Codex } from "@codex-data/sdk";
import fastifyWebsocket from "@fastify/websocket";
import { PrivyClient } from "@privy-io/server-auth";
import { clusterApiUrl, Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createJupiterApiClient, ConfigurationParameters } from '@jup-ag/api';
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createClient as createGqlClient } from "@tub/gql";
import { config } from "dotenv";
import fastify from "fastify";

config({ path: "../../.env" });

const env = parseEnv();

// @see https://fastify.dev/docs/latest/
export const server = fastify({
  maxParamLength: 5000,
  logger: true,
});

export type FeeOptions = {
  amount: number,
  sourceAccount: PublicKey,
  destinationAccount: PublicKey,
};

await server.register(import("@fastify/compress"));
await server.register(import("@fastify/cors"));
await server.register(fastifyWebsocket);

// k8s healthchecks
server.get("/healthz", (req, res) => res.code(200).send());
server.get("/readyz", (req, res) => res.code(200).send());
server.get("/", (req, res) => res.code(200).send("hello world"));

// Helper function to extract bearer token
const getBearerToken = (req: any) => {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
};

export const start = async () => {
  try {
    const connection = new Connection(
      env.NODE_ENV === "production" 
        ? env.QUICKNODE_MAINNET_URL 
        : clusterApiUrl("devnet"),
      "confirmed"
    );

    // Initialize cache for OctaneService
    const cacheManager = require('cache-manager');
    const cache = cacheManager.caching({ store: 'memory', max: 100, ttl: 10/*seconds*/ });


    // Create fee payer keypair (!! TODO: implement more robust keypair management)
    const feePayerKeypair = Keypair.fromSecretKey(new Uint8Array(Buffer.from(env.PRIVATE_KEY, "base64")));

    if (!feePayerKeypair) {
      throw new Error("Fee payer keypair not found");
    }

    if (!env.OCTANE_TRADE_FEE_RECIPIENT) {
      throw new Error("OCTANE_TRADE_FEE_RECIPIENT is not set");
    }

    const jupiterConfig: ConfigurationParameters = {
      basePath: env.JUPITER_URL,
    };

    const jupiterQuoteApi = createJupiterApiClient(jupiterConfig);
    
    // Initialize OctaneService
    const octaneService = new OctaneService(
      connection,
      jupiterQuoteApi,
      feePayerKeypair,
      new PublicKey(env.OCTANE_TRADE_FEE_RECIPIENT),
      env.OCTANE_BUY_FEE,
      env.OCTANE_SELL_FEE,
      env.OCTANE_MIN_TRADE_SIZE,
      cache
    );

    if (!process.env.GRAPHQL_URL && env.NODE_ENV === "production") {
      throw new Error("GRAPHQL_URL is not set");
    }
    const gqlClient = (
      await createGqlClient({
        url: env.NODE_ENV !== "production" ? "http://localhost:8080/v1/graphql" : env.GRAPHQL_URL,
        hasuraAdminSecret: env.NODE_ENV !== "production" ? "password" : env.HASURA_ADMIN_SECRET,
      })
    ).db;

    const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
    const codexSdk = new Codex(env.CODEX_API_KEY);

    const tubService = new TubService(gqlClient, privy, codexSdk, octaneService);

    // @see https://trpc.io/docs/server/adapters/fastify
    server.register(fastifyTRPCPlugin<AppRouter>, {
      prefix: "/trpc",
      useWSS: true,
      trpcOptions: {
        router: createAppRouter(),
        createContext: async (opt) => ({ 
          tubService, 
          jwtToken: getBearerToken(opt.req) ?? '' 
        }),
      },
    });
    await server.listen({ host: env.SERVER_HOST, port: env.SERVER_PORT });
    console.log(`tub server listening on http://${env.SERVER_HOST}:${env.SERVER_PORT}`);

    // Apply WebSocket handler
    applyWSSHandler({
      wss: server.websocketServer,
      router: createAppRouter(),
      createContext: async (opt) => ({ 
        tubService, 
        jwtToken: getBearerToken(opt.req) ?? '' 
      }),
    });

    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
