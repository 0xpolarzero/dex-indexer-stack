import { PublicKey } from "@solana/web3.js";

import { RaydiumAmmParser } from "@/lib/parsers/raydium-amm-parser";

export const PRICE_DATA_BATCH_SIZE = 10;
export const PRICE_PRECISION = 10 ** 18;

export const RAYDIUM_PUBLIC_KEY = RaydiumAmmParser.PROGRAM_ID;
export const WRAPPED_SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

export const LOG_FILTERS = ["swap", RAYDIUM_PUBLIC_KEY.toString()];
