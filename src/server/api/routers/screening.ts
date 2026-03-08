/**
 * Screening tRPC Router
 *
 * 应用层入口，编排筛选策略和会话的 CRUD 操作。
 * 不包含业务逻辑，仅负责：
 * - 输入验证（Zod schema）
 * - 领域服务调用编排
 * - 领域异常到 TRPCError 的映射
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createStrategyInputSchema,
  screeningPaginationSchema,
  updateStrategyInputSchema,
} from "~/contracts/screening";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ScreeningExecutionService } from "~/server/application/screening/screening-execution-service";
// 领域层
import { ScreeningStrategy } from "~/server/domain/screening/aggregates/screening-strategy";
import { FilterGroup } from "~/server/domain/screening/entities/filter-group";
import { ScreeningSessionStatus } from "~/server/domain/screening/enums/screening-session-status";
// 领域异常
import {
  DataNotAvailableError,
  InvalidFilterConditionError,
  InvalidStrategyError,
  NoCandidateStocksError,
  ScoringError,
  UnsupportedIndicatorError,
} from "~/server/domain/screening/errors";
import { ScoringConfig } from "~/server/domain/screening/value-objects/scoring-config";
import { PrismaScreeningSessionRepository } from "~/server/infrastructure/screening/prisma-screening-session-repository";
// Repository 实现
import { PrismaScreeningStrategyRepository } from "~/server/infrastructure/screening/prisma-screening-strategy-repository";

/**
 * 领域异常到 TRPCError 的映射
 */
function mapDomainError(error: unknown): TRPCError {
  if (error instanceof InvalidStrategyError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  if (error instanceof InvalidFilterConditionError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  if (error instanceof ScoringError) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  if (error instanceof DataNotAvailableError) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `数据服务不可用: ${error.message}`,
    });
  }

  if (error instanceof UnsupportedIndicatorError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  if (error instanceof NoCandidateStocksError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
    });
  }

  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof Error) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "未知错误",
  });
}

/**
 * Screening Router
 */
export const screeningRouter = createTRPCRouter({
  /**
   * 创建筛选策略
   * Requirements: 7.1, 7.5, 7.6
   */
  createStrategy: protectedProcedure
    .input(createStrategyInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        // 反序列化领域对象
        const filters = FilterGroup.fromDict(
          input.filters as Record<string, unknown>,
        );
        const scoringConfig = ScoringConfig.fromDict(
          input.scoringConfig as Record<string, unknown>,
        );

        // 创建策略聚合根
        const strategy = ScreeningStrategy.create({
          name: input.name,
          description: input.description,
          filters,
          scoringConfig,
          tags: input.tags,
          isTemplate: input.isTemplate,
          userId: ctx.session.user.id,
        });

        // 持久化
        await repository.save(strategy);

        return {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          tags: strategy.tags,
          isTemplate: strategy.isTemplate,
          createdAt: strategy.createdAt,
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 更新筛选策略
   * Requirements: 7.1, 7.5, 7.6
   */
  updateStrategy: protectedProcedure
    .input(updateStrategyInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        // 查找现有策略
        const strategy = await repository.findById(input.id);
        if (!strategy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "策略不存在",
          });
        }

        // 验证所有权
        if (strategy.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限修改此策略",
          });
        }

        // 更新策略
        const updates: {
          name?: string;
          description?: string;
          filters?: FilterGroup;
          scoringConfig?: ScoringConfig;
          tags?: string[];
          isTemplate?: boolean;
        } = {};

        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined)
          updates.description = input.description;
        if (input.filters !== undefined) {
          updates.filters = FilterGroup.fromDict(
            input.filters as Record<string, unknown>,
          );
        }
        if (input.scoringConfig !== undefined) {
          updates.scoringConfig = ScoringConfig.fromDict(
            input.scoringConfig as Record<string, unknown>,
          );
        }
        if (input.tags !== undefined) updates.tags = input.tags;
        if (input.isTemplate !== undefined)
          updates.isTemplate = input.isTemplate;

        strategy.update(updates);

        // 持久化
        await repository.save(strategy);

        return {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          tags: strategy.tags,
          isTemplate: strategy.isTemplate,
          updatedAt: strategy.updatedAt,
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 删除筛选策略
   * Requirements: 7.1, 7.5, 7.6
   */
  deleteStrategy: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        // 查找策略
        const strategy = await repository.findById(input.id);
        if (!strategy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "策略不存在",
          });
        }

        // 验证所有权
        if (strategy.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限删除此策略",
          });
        }

        // 删除策略
        await repository.delete(input.id);

        return { success: true };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 获取单个策略
   * Requirements: 7.1, 7.5, 7.6
   */
  getStrategy: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        const strategy = await repository.findById(input.id);
        if (!strategy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "策略不存在",
          });
        }

        // 验证所有权
        if (strategy.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限查看此策略",
          });
        }

        return {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          filters: strategy.filters.toDict(),
          scoringConfig: strategy.scoringConfig.toDict(),
          tags: strategy.tags,
          isTemplate: strategy.isTemplate,
          createdAt: strategy.createdAt,
          updatedAt: strategy.updatedAt,
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 列出所有策略
   * Requirements: 7.1, 7.5, 7.6
   */
  listStrategies: protectedProcedure
    .input(screeningPaginationSchema)
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        const strategies = await repository.findByUserId(
          ctx.session.user.id,
          input.limit,
          input.offset,
        );

        return strategies.map((strategy) => ({
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          tags: strategy.tags,
          isTemplate: strategy.isTemplate,
          createdAt: strategy.createdAt,
          updatedAt: strategy.updatedAt,
        }));
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 执行筛选策略
   * Requirements: 7.2, 7.5, 7.6
   */
  executeStrategy: protectedProcedure
    .input(z.object({ strategyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const strategyRepo = new PrismaScreeningStrategyRepository(ctx.db);
        const sessionRepo = new PrismaScreeningSessionRepository(ctx.db);
        const strategy = await strategyRepo.findById(input.strategyId);
        if (!strategy) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "策略不存在",
          });
        }

        if (strategy.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限执行此策略",
          });
        }

        const executionService = new ScreeningExecutionService({
          sessionRepository: sessionRepo,
          strategyRepository: strategyRepo,
        });
        const session = await executionService.enqueueStrategyExecution({
          strategyId: input.strategyId,
          userId: ctx.session.user.id,
        });

        return {
          sessionId: session.id,
          status: session.status,
          progressPercent: session.progressPercent,
          currentStep: session.currentStep,
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 列出最近的筛选会话
   * Requirements: 7.3, 7.5, 7.6
   */
  listRecentSessions: protectedProcedure
    .input(screeningPaginationSchema)
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningSessionRepository(ctx.db);

        const sessions = await repository.findRecentSessionsByUser(
          ctx.session.user.id,
          input.limit,
          input.offset,
        );

        return sessions.map((session) => ({
          id: session.id,
          strategyId: session.strategyId,
          strategyName: session.strategyName,
          executedAt: session.executedAt,
          status: session.status,
          progressPercent: session.progressPercent,
          currentStep: session.currentStep,
          errorMessage: session.errorMessage,
          totalScanned: session.totalScanned,
          matchedCount: session.countMatched(),
          executionTime: session.executionTime,
        }));
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 获取策略的筛选会话列表
   * Requirements: 7.3, 7.5, 7.6
   */
  getSessionsByStrategy: protectedProcedure
    .input(
      z.object({
        strategyId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningSessionRepository(ctx.db);

        const sessions = await repository.findByStrategyForUser(
          input.strategyId,
          ctx.session.user.id,
          input.limit,
          input.offset,
        );

        return sessions.map((session) => ({
          id: session.id,
          strategyId: session.strategyId,
          strategyName: session.strategyName,
          executedAt: session.executedAt,
          status: session.status,
          progressPercent: session.progressPercent,
          currentStep: session.currentStep,
          errorMessage: session.errorMessage,
          totalScanned: session.totalScanned,
          matchedCount: session.countMatched(),
          executionTime: session.executionTime,
        }));
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 获取筛选会话详情
   * Requirements: 7.3, 7.5, 7.6
   */
  getSessionDetail: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningSessionRepository(ctx.db);

        const session = await repository.findById(input.sessionId);
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }

        // 验证所有权
        if (session.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限查看此会话",
          });
        }

        return {
          id: session.id,
          strategyId: session.strategyId,
          strategyName: session.strategyName,
          executedAt: session.executedAt,
          status: session.status,
          progressPercent: session.progressPercent,
          currentStep: session.currentStep,
          errorMessage: session.errorMessage,
          cancellationRequestedAt: session.cancellationRequestedAt,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          totalScanned: session.totalScanned,
          matchedCount: session.countMatched(),
          executionTime: session.executionTime,
          topStocks: session.topStocks.map((stock) => stock.toDict()),
          otherStockCodes: session.otherStockCodes.map((code) => code.value),
          filtersSnapshot: session.filtersSnapshot.toDict(),
          scoringConfigSnapshot: session.scoringConfigSnapshot.toDict(),
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  cancelSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const sessionRepository = new PrismaScreeningSessionRepository(ctx.db);
        const session = await sessionRepository.findById(input.sessionId);
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }

        if (session.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限取消此会话",
          });
        }

        const executionService = new ScreeningExecutionService({
          sessionRepository,
          strategyRepository: new PrismaScreeningStrategyRepository(ctx.db),
        });

        const updatedSession = await executionService.requestCancellation(
          input.sessionId,
          ctx.session.user.id,
        );

        return {
          sessionId: updatedSession.id,
          status: updatedSession.status,
          progressPercent: updatedSession.progressPercent,
          currentStep: updatedSession.currentStep,
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  retrySession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const sessionRepository = new PrismaScreeningSessionRepository(ctx.db);
        const existingSession = await sessionRepository.findById(
          input.sessionId,
        );
        if (!existingSession) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }

        if (existingSession.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限重试此会话",
          });
        }

        const executionService = new ScreeningExecutionService({
          sessionRepository,
          strategyRepository: new PrismaScreeningStrategyRepository(ctx.db),
        });
        const retried = await executionService.enqueueRetry(
          input.sessionId,
          ctx.session.user.id,
        );

        return {
          sessionId: retried.id,
          status: retried.status,
          progressPercent: retried.progressPercent,
          currentStep: retried.currentStep,
        };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

  /**
   * 删除筛选会话
   * Requirements: 7.3, 7.5, 7.6
   */
  deleteSession: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningSessionRepository(ctx.db);

        // 查找会话
        const session = await repository.findById(input.id);
        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "会话不存在",
          });
        }

        // 验证所有权
        if (session.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "无权限删除此会话",
          });
        }

        if (
          session.status === ScreeningSessionStatus.RUNNING ||
          session.status === ScreeningSessionStatus.PENDING
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "请先取消进行中的任务，再删除会话",
          });
        }

        // 删除会话
        await repository.delete(input.id);

        return { success: true };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
});
