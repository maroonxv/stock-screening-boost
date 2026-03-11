import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { PrismaPortfolioSnapshotRepository } from "~/server/infrastructure/timing/prisma-portfolio-snapshot-repository";
import { PrismaTimingAnalysisCardRepository } from "~/server/infrastructure/timing/prisma-timing-analysis-card-repository";
import { PrismaTimingPresetRepository } from "~/server/infrastructure/timing/prisma-timing-preset-repository";
import { PrismaTimingRecommendationRepository } from "~/server/infrastructure/timing/prisma-timing-recommendation-repository";
import { PrismaTimingReviewRecordRepository } from "~/server/infrastructure/timing/prisma-timing-review-record-repository";

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

const listReviewRecordsInput = z.object({
  limit: z.number().int().min(1).max(100).default(24),
  stockCode: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  completedOnly: z.boolean().default(false),
});

const timingPresetConfigInput = z.object({
  factorWeights: z
    .object({
      trend: z.number().positive().max(3).optional(),
      macd: z.number().positive().max(3).optional(),
      rsi: z.number().positive().max(3).optional(),
      bollinger: z.number().positive().max(3).optional(),
      volume: z.number().positive().max(3).optional(),
      obv: z.number().positive().max(3).optional(),
      volatility: z.number().positive().max(3).optional(),
    })
    .optional(),
  agentWeights: z
    .object({
      technicalSignal: z.number().positive().max(3).optional(),
    })
    .optional(),
  confidenceThresholds: z
    .object({
      signalStrengthWeight: z.number().positive().max(1).optional(),
      alignmentWeight: z.number().positive().max(100).optional(),
      riskPenaltyPerFlag: z.number().min(0).max(20).optional(),
      neutralPenalty: z.number().min(0).max(20).optional(),
      minConfidence: z.number().min(0).max(100).optional(),
      maxConfidence: z.number().min(0).max(100).optional(),
    })
    .optional(),
  actionThresholds: z
    .object({
      addConfidence: z.number().min(0).max(100).optional(),
      addSignalStrength: z.number().min(0).max(100).optional(),
      probeConfidence: z.number().min(0).max(100).optional(),
      probeSignalStrength: z.number().min(0).max(100).optional(),
      holdConfidence: z.number().min(0).max(100).optional(),
      trimConfidence: z.number().min(0).max(100).optional(),
      exitConfidence: z.number().min(0).max(100).optional(),
    })
    .optional(),
  reviewSchedule: z
    .object({
      horizons: z
        .array(z.enum(["T5", "T10", "T20"]))
        .min(1)
        .max(3)
        .optional(),
    })
    .optional(),
});

const saveTimingPresetInput = z.object({
  id: z.string().cuid().optional(),
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(240).optional(),
  config: timingPresetConfigInput,
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

  listReviewRecords: protectedProcedure
    .input(listReviewRecordsInput)
    .query(async ({ ctx, input }) => {
      const repository = new PrismaTimingReviewRecordRepository(ctx.db);
      return repository.listForUser({
        userId: ctx.session.user.id,
        limit: input.limit,
        stockCode: input.stockCode,
        completedOnly: input.completedOnly,
      });
    }),

  listTimingPresets: protectedProcedure.query(async ({ ctx }) => {
    const repository = new PrismaTimingPresetRepository(ctx.db);
    return repository.listForUser(ctx.session.user.id);
  }),

  saveTimingPreset: protectedProcedure
    .input(saveTimingPresetInput)
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTimingPresetRepository(ctx.db);

      if (input.id) {
        const preset = await repository.update(input.id, ctx.session.user.id, {
          name: input.name,
          description: input.description,
          config: input.config,
        });

        if (!preset) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Timing preset not found",
          });
        }

        return preset;
      }

      return repository.create({
        userId: ctx.session.user.id,
        name: input.name,
        description: input.description,
        config: input.config,
      });
    }),
});
