import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { PrismaPortfolioSnapshotRepository } from "~/server/infrastructure/timing/prisma-portfolio-snapshot-repository";
import { PrismaTimingAnalysisCardRepository } from "~/server/infrastructure/timing/prisma-timing-analysis-card-repository";
import { PrismaTimingRecommendationRepository } from "~/server/infrastructure/timing/prisma-timing-recommendation-repository";

const portfolioPositionInput = z.object({
  stockCode: z.string().regex(/^\d{6}$/, "stockCode must be 6 digits"),
  stockName: z.string().trim().min(1).max(64),
  quantity: z.number().nonnegative(),
  costBasis: z.number().nonnegative(),
  currentWeightPct: z.number().min(0).max(100),
  sector: z.string().trim().min(1).max(64).optional(),
  themes: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
});

const portfolioRiskPreferencesInput = z.object({
  maxSingleNamePct: z.number().positive().max(100),
  maxThemeExposurePct: z.number().positive().max(100),
  defaultProbePct: z.number().positive().max(100),
  maxPortfolioRiskBudgetPct: z.number().positive().max(100),
});

const portfolioSnapshotFields = {
  name: z.string().trim().min(1).max(64),
  baseCurrency: z.string().trim().min(1).max(12).default("CNY"),
  cash: z.number().min(0),
  totalCapital: z.number().positive(),
  positions: z.array(portfolioPositionInput).max(100).default([]),
  riskPreferences: portfolioRiskPreferencesInput,
};

const portfolioSnapshotInput = z
  .object(portfolioSnapshotFields)
  .refine((value) => value.totalCapital >= value.cash, {
    message: "totalCapital must be greater than or equal to cash",
    path: ["totalCapital"],
  });

const listTimingCardsInput = z.object({
  limit: z.number().int().min(1).max(100).default(24),
  stockCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  sourceType: z.enum(["single", "watchlist", "screening"]).optional(),
  watchListId: z.string().cuid().optional(),
});

const getTimingCardInput = z.object({
  id: z.string().cuid(),
});

const updatePortfolioSnapshotInput = z
  .object({
    id: z.string().cuid(),
    ...portfolioSnapshotFields,
  })
  .refine((value) => value.totalCapital >= value.cash, {
    message: "totalCapital must be greater than or equal to cash",
    path: ["totalCapital"],
  });

const listRecommendationsInput = z.object({
  limit: z.number().int().min(1).max(100).default(24),
  watchListId: z.string().cuid().optional(),
  portfolioSnapshotId: z.string().cuid().optional(),
  workflowRunId: z.string().cuid().optional(),
});

export const timingRouter = createTRPCRouter({
  listTimingCards: protectedProcedure
    .input(listTimingCardsInput)
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTimingAnalysisCardRepository(ctx.db);

      return repository.listForUser({
        userId: ctx.session.user.id,
        limit: input.limit,
        stockCode: input.stockCode,
        sourceType: input.sourceType,
        watchListId: input.watchListId,
      });
    }),

  getTimingCard: protectedProcedure
    .input(getTimingCardInput)
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTimingAnalysisCardRepository(ctx.db);
      const card = await repository.getByIdForUser(
        ctx.session.user.id,
        input.id,
      );

      if (!card) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timing card not found",
        });
      }

      return card;
    }),

  createPortfolioSnapshot: protectedProcedure
    .input(portfolioSnapshotInput)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaPortfolioSnapshotRepository(ctx.db);
      return repository.create({
        userId: ctx.session.user.id,
        name: input.name,
        baseCurrency: input.baseCurrency,
        cash: input.cash,
        totalCapital: input.totalCapital,
        positions: input.positions,
        riskPreferences: input.riskPreferences,
      });
    }),

  updatePortfolioSnapshot: protectedProcedure
    .input(updatePortfolioSnapshotInput)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaPortfolioSnapshotRepository(ctx.db);
      const snapshot = await repository.update(input.id, ctx.session.user.id, {
        name: input.name,
        baseCurrency: input.baseCurrency,
        cash: input.cash,
        totalCapital: input.totalCapital,
        positions: input.positions,
        riskPreferences: input.riskPreferences,
      });

      if (!snapshot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Portfolio snapshot not found",
        });
      }

      return snapshot;
    }),

  listPortfolioSnapshots: protectedProcedure.query(async ({ ctx }) => {
    const repository = new PrismaPortfolioSnapshotRepository(ctx.db);
    return repository.listForUser(ctx.session.user.id);
  }),

  listRecommendations: protectedProcedure
    .input(listRecommendationsInput)
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTimingRecommendationRepository(ctx.db);
      return repository.listForUser({
        userId: ctx.session.user.id,
        limit: input.limit,
        watchListId: input.watchListId,
        portfolioSnapshotId: input.portfolioSnapshotId,
        workflowRunId: input.workflowRunId,
      });
    }),
});
