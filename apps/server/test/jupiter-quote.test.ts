import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { DefaultApi, Configuration } from "@jup-ag/api";
import { JupiterService } from "../src/JupiterService";
import { Keypair } from "@solana/web3.js";
import { Cache } from "cache-manager";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AxiosError } from "axios";

const createTestKeypair = () => Keypair.generate();

describe("Jupiter Quote Integration Test", () => {
  let jupiterService: JupiterService;
  let jupiterQuoteApi: DefaultApi;
  let connection: Connection;
  let cache: Cache;

  beforeAll(async () => {
    try {
      // Setup connection to Solana mainnet
      connection = new Connection(process.env.QUICKNODE_MAINNET_URL ?? "https://api.mainnet-beta.solana.com");

      // Setup Jupiter API client
      jupiterQuoteApi = new DefaultApi(
        new Configuration({
          basePath: process.env.JUPITER_URL,
        }),
      );

      jupiterService = new JupiterService(
        connection,
        jupiterQuoteApi,
        createTestKeypair(),
        new PublicKey("11111111111111111111111111111111"),
        100,
        0,
        15,
        cache,
      );
    } catch (error) {
      console.error("Error in test setup:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
      }
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clear the cache
    } catch (error) {
      console.error("Error in test cleanup:", error);
    }
  });

  it("should get a valid quote for SOL to USDC", async () => {
    const quoteRequest = {
      inputMint: "So11111111111111111111111111111111111111112", // SOL
      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      amount: 100000000, // 0.1 SOL
      slippageBps: 50,
      onlyDirectRoutes: true,
      restrictIntermediateTokens: true,
      maxAccounts: 50,
      asLegacyTransaction: false,
    };

    try {
      console.log("\nGetting quote for SOL -> USDC:");
      console.log("Input: 0.1 SOL");
      console.log("Request:", quoteRequest);

      const quote = await jupiterService.getQuote(quoteRequest);

      console.log("Quote response:");
      console.log({
        inputMint: quote.inputMint,
        outputMint: quote.outputMint,
        inAmount: `${Number(quote.inAmount) / 1e9} SOL`,
        outAmount: `${Number(quote.outAmount) / 1e6} USDC`,
        price: `${Number(quote.outAmount) / 1e6 / (Number(quote.inAmount) / 1e9)} USDC/SOL`,
        priceImpactPct: quote.priceImpactPct,
      });

      console.log("\nRoute Plan:");
      quote.routePlan.forEach((step, index) => {
        console.log(`\nStep ${index + 1}:`);
        console.log({
          protocol: step.swapInfo.label,
          inputMint: step.swapInfo.inputMint,
          outputMint: step.swapInfo.outputMint,
          inAmount: step.swapInfo.inAmount,
          outAmount: step.swapInfo.outAmount,
          fee: step.swapInfo.feeAmount,
          percent: `${step.percent}%`,
        });
      });

      expect(quote).toBeDefined();
      expect(quote.inputMint).toBe(quoteRequest.inputMint);
      expect(quote.outputMint).toBe(quoteRequest.outputMint);
      expect(quote.inAmount).toBe(quoteRequest.amount.toString());
      expect(Number(quote.outAmount)).toBeGreaterThan(0);
    } catch (error) {
      console.error("Error getting SOL->USDC quote:");
      if (error instanceof AxiosError) {
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Headers:", error.response?.headers);
        console.error("Response Data:", JSON.stringify(error.response?.data, null, 2));
      } else if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
      }
      throw error;
    }
  }, 30000);

  it("should get a valid quote for USDC to SOL", async () => {
    const quoteRequest = {
      inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      outputMint: "So11111111111111111111111111111111111111112", // SOL
      amount: 1000000, // 1 USDC
      slippageBps: 50,
      onlyDirectRoutes: true,
      restrictIntermediateTokens: true,
      maxAccounts: 50,
      asLegacyTransaction: false,
    };

    console.log("\nGetting quote for USDC -> SOL:");
    console.log("Input: 1 USDC");

    const quote = await jupiterService.getQuote(quoteRequest);

    console.log("Quote response:");
    console.log({
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: `${Number(quote.inAmount) / 1e6} USDC`,
      outAmount: `${Number(quote.outAmount) / 1e9} SOL`,
      price: `${Number(quote.inAmount) / 1e6 / (Number(quote.outAmount) / 1e9)} USDC/SOL`,
      priceImpactPct: quote.priceImpactPct,
    });

    console.log("\nRoute Plan:");
    quote.routePlan.forEach((step, index) => {
      console.log(`\nStep ${index + 1}:`);
      console.log({
        protocol: step.swapInfo.label,
        inputMint: step.swapInfo.inputMint,
        outputMint: step.swapInfo.outputMint,
        inAmount: step.swapInfo.inAmount,
        outAmount: step.swapInfo.outAmount,
        fee: step.swapInfo.feeAmount,
        percent: `${step.percent}%`,
      });
    });

    expect(quote).toBeDefined();
    expect(quote.inputMint).toBe(quoteRequest.inputMint);
    expect(quote.outputMint).toBe(quoteRequest.outputMint);
    expect(quote.inAmount).toBe(quoteRequest.amount.toString());
    expect(Number(quote.outAmount)).toBeGreaterThan(0);
  }, 30000);

  it("should get swap instructions after quote", async () => {
    // generate a new keypair for the user
    const userPublicKey = createTestKeypair().publicKey;

    const quoteRequest = {
      inputMint: "So11111111111111111111111111111111111111112", // SOL
      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      amount: 100000000, // 0.1 SOL
      slippageBps: 50,
      onlyDirectRoutes: true,
      restrictIntermediateTokens: true,
      maxAccounts: 50,
      asLegacyTransaction: false,
    };

    try {
      console.log("\nTesting complete swap instruction flow:");
      console.log("User Public Key:", userPublicKey.toBase58());
      console.log("Quote Request:", quoteRequest);

      const swapInstructions = await jupiterService.getSwapInstructions(quoteRequest, userPublicKey);

      console.log("\nSwap Instructions Response:");
      console.log({
        hasSetupInstructions: !!swapInstructions.instructions?.length,
        setupInstructionsCount: swapInstructions.instructions?.length || 0,
        hasSwapInstruction: !!swapInstructions.instructions?.length,
        cleanupInstructionCount: swapInstructions.instructions?.length ? 1 : 0,
      });

      // Build complete swap transaction
      console.log(
        "building Swap Message",
        swapInstructions.instructions?.length,
        swapInstructions.addressLookupTableAccounts?.length,
      );
      const message = await jupiterService.buildSwapMessage(
        swapInstructions.instructions,
        swapInstructions.addressLookupTableAccounts,
      );
      const transaction = new VersionedTransaction(message);

      console.log("\nBuilt Transaction");
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const decompiledMessage = TransactionMessage.decompile(message, {
        addressLookupTableAccounts: swapInstructions.addressLookupTableAccounts,
      });
      // Assertions
      expect(swapInstructions).toBeDefined();
      expect(swapInstructions.instructions).toBeDefined();
      expect(transaction).toBeDefined();
      expect(decompiledMessage.payerKey.equals(jupiterService.getSettings().feePayerPublicKey)).toBe(true);
      expect(decompiledMessage.instructions.length).toBeGreaterThan(0);
      expect(decompiledMessage.recentBlockhash).toBeDefined();
    } catch (error) {
      console.error("Error testing swap instructions:");
      if (error instanceof AxiosError) {
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Headers:", error.response?.headers);
        console.error("Response Data:", JSON.stringify(error.response?.data, null, 2));
      } else if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
      }
      throw error;
    }
  }, 30000);

  it("should get swap instructions for USDC to SOL", async () => {
    const userPublicKey = createTestKeypair().publicKey;

    const quoteRequest = {
      inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      outputMint: "So11111111111111111111111111111111111111112", // SOL
      amount: 1000000, // 1 USDC
      slippageBps: 50,
      onlyDirectRoutes: true,
      restrictIntermediateTokens: true,
      maxAccounts: 50,
      asLegacyTransaction: false,
    };

    try {
      console.log("\nTesting USDC->SOL swap instruction flow:");
      console.log("User Public Key:", userPublicKey.toBase58());
      console.log("Quote Request:", quoteRequest);

      const swapInstructions = await jupiterService.getSwapInstructions(quoteRequest, userPublicKey);

      console.log("\nSwap Instructions Response:");
      console.log({
        hasSetupInstructions: !!swapInstructions.instructions?.length,
        setupInstructionsCount: swapInstructions.instructions?.length || 0,
        hasSwapInstruction: !!swapInstructions.instructions?.length,
        cleanupInstructionCount: swapInstructions.instructions?.length ? 1 : 0,
      });

      // Build complete swap transaction
      const message = await jupiterService.buildSwapMessage(
        swapInstructions.instructions,
        swapInstructions.addressLookupTableAccounts,
      );
      const transaction = new VersionedTransaction(message);

      const decompiledMessage = TransactionMessage.decompile(message, {
        addressLookupTableAccounts: swapInstructions.addressLookupTableAccounts,
      });

      console.log("\nBuilt Transaction:");
      console.log({
        feePayer: decompiledMessage.payerKey.toBase58(),
        instructionsCount: decompiledMessage.instructions.length,
        recentBlockhash: decompiledMessage.recentBlockhash,
      });

      // Assertions
      expect(swapInstructions).toBeDefined();
      expect(swapInstructions.instructions).toBeDefined();
      expect(transaction).toBeDefined();
      expect(decompiledMessage.payerKey.equals(jupiterService.getSettings().feePayerPublicKey)).toBe(true);
      expect(decompiledMessage.instructions.length).toBeGreaterThan(0);
      expect(decompiledMessage.recentBlockhash).toBeDefined();
    } catch (error) {
      console.error("Error testing USDC->SOL swap instructions:");
      if (error instanceof AxiosError) {
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Headers:", error.response?.headers);
        console.error("Response Data:", JSON.stringify(error.response?.data, null, 2));
      } else if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Stack trace:", error.stack);
      }
      throw error;
    }
  }, 30000);

  it("should get instructions for USDC to GRIFT", async () => {
    const userPublicKey = createTestKeypair().publicKey;

    const quoteRequest = {
      inputMint: "DcRHumYETnVKowMmDSXQ5RcGrFZFAnaqrQ1AZCHXpump", // USDC
      outputMint: "So11111111111111111111111111111111111111112", // SOL
      amount: 1000000, // 1 USDC
      slippageBps: 50,
      onlyDirectRoutes: false,
      restrictIntermediateTokens: true,
      maxAccounts: 50,
      asLegacyTransaction: false,
    };

    const swapInstructions = await jupiterService.getSwapInstructions(quoteRequest, userPublicKey);
    console.info("content:", swapInstructions.instructions?.length);
  });
});
