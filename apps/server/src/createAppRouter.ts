import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { TubService } from "./TubService";

export type AppContext = {
  tubService: TubService;
  jwtToken: string;
};

export function createAppRouter() {
  const t = initTRPC.context<AppContext>().create();
  return t.router({
    getStatus: t.procedure.query(({ ctx }) => {
      return ctx.tubService.getStatus();
    }),
    buyToken: t.procedure
      .input(
        z.object({
          tokenId: z.string(),
          amount: z.string(),
          tokenPrice: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.tubService.buyToken(
          ctx.jwtToken,
          input.tokenId,
          BigInt(input.amount),
          Number(input.tokenPrice),
        );
      }),
    sellToken: t.procedure
      .input(
        z.object({
          tokenId: z.string(),
          amount: z.string(),
          tokenPrice: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.tubService.sellToken(
          ctx.jwtToken,
          input.tokenId,
          BigInt(input.amount),
          Number(input.tokenPrice),
        );
      }),

    airdropNativeToUser: t.procedure
      .input(
        z.object({
          amount: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.tubService.airdropNativeToUser(ctx.jwtToken, BigInt(input.amount));
      }),

    recordClientEvent: t.procedure
      .input(
        z.object({
          userAgent: z.string(),
          eventName: z.string(),
          buildVersion: z.string().optional(),
          metadata: z.string().optional(),
          errorDetails: z.string().optional(),
          source: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return await ctx.tubService.recordClientEvent(input, ctx.jwtToken);
      }),

    requestCodexToken: t.procedure
      .input(z.object({ expiration: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        return await ctx.tubService.requestCodexToken(input.expiration);
      }),

    getSignedTransfer: t.procedure
      .input(z.object({ fromAddress: z.string(), toAddress: z.string(), amount: z.string(), tokenId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const amountBigInt = BigInt(input.amount);
        return await ctx.tubService.getSignedTransfer(ctx.jwtToken, { ...input, amount: amountBigInt });
      }),
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
