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

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";

// Repository 实现
import { PrismaScreeningStrategyRepository } from "~/server/infrastructure/screening/prisma-screening-strategy-repository";
import { PrismaScreeningSessionRepository } from "~/server/infrastructure/screening/prisma-screening-session-repository";
import { PythonDataServiceClient } from "~/server/infrastructure/screening/python-data-service-client";

// 领域层
import { ScreeningStrategy } from "~/server/domain/screening/aggregates/screening-strategy";
import { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";
import { FilterGroup } from "~/server/domain/screening/entities/filter-group";
import { ScoringConfig } from "~/server/domain/screening/value-objects/scoring-config";
import { IndicatorCalculationService } from "~/server/domain/screening/services/indicator-calculation-service";
import { ScoringService } from "~/server/domain/screening/services/scoring-service";

// 领域异常
import {
  InvalidStrategyError,
  InvalidFilterConditionError,
  ScoringError,
  DataNotAvailableError,
} from "~/server/domain/screening/errors";

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
 * Zod Schema 定义
 */

// FilterCondition Schema
const filterConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.union([
    z.object({ type: z.literal("numeric"), value: z.number(), unit: z.string().optional() }),
    z.object({ type: z.literal("text"), value: z.string() }),
    z.object({ type: z.literal("list"), values: z.array(z.string()) }),
    z.object({ type: z.literal("range"), min: z.number(), max: z.number() }),
    z.object({ type: z.literal("timeSeries"), years: z.number(), threshold: z.number().optional() }),
  ]),
});

// FilterGroup Schema (递归)
type FilterGroupInput = {
  groupId: string;
  operator: string;
  conditions: z.infer<typeof filterConditionSchema>[];
  subGroups: FilterGroupInput[];
};

const filterGroupSchema: z.ZodType<FilterGroupInput> = z.lazy(() =>
  z.object({
    groupId: z.string(),
    operator: z.string(),
    conditions: z.array(filterConditionSchema),
    subGroups: z.array(filterGroupSchema),
  })
);

// ScoringConfig Schema
const scoringConfigSchema = z.object({
  weights: z.record(z.string(), z.number()),
  normalizationMethod: z.string(),
});

// 创建策略 Schema
const createStrategySchema = z.object({
  name: z.string().min(1, "策略名称不能为空"),
  description: z.string().optional(),
  filters: filterGroupSchema,
  scoringConfig: scoringConfigSchema,
  tags: z.array(z.string()).default([]),
  isTemplate: z.boolean().default(false),
});

// 更新策略 Schema
const updateStrategySchema = z.object({
  id: z.string(),
  name: z.string().min(1, "策略名称不能为空").optional(),
  description: z.string().optional(),
  filters: filterGroupSchema.optional(),
  scoringConfig: scoringConfigSchema.optional(),
  tags: z.array(z.string()).optional(),
  isTemplate: z.boolean().optional(),
});

// 分页 Schema
const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

/**
 * Screening Router
 */
export const screeningRouter = createTRPCRouter({
  /**
   * 创建筛选策略
   * Requirements: 7.1, 7.5, 7.6
   */
  createStrategy: protectedProcedure
    .input(createStrategySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        // 反序列化领域对象
        const filters = FilterGroup.fromDict(input.filters as Record<string, unknown>);
        const scoringConfig = ScoringConfig.fromDict(input.scoringConfig as Record<string, unknown>);

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
    .input(updateStrategySchema)
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
        if (input.description !== undefined) updates.description = input.description;
        if (input.filters !== undefined) {
          updates.filters = FilterGroup.fromDict(input.filters as Record<string, unknown>);
        }
        if (input.scoringConfig !== undefined) {
          updates.scoringConfig = ScoringConfig.fromDict(input.scoringConfig as Record<string, unknown>);
        }
        if (input.tags !== undefined) updates.tags = input.tags;
        if (input.isTemplate !== undefined) updates.isTemplate = input.isTemplate;

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
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningStrategyRepository(ctx.db);

        const strategies = await repository.findAll(input.limit, input.offset);

        // 过滤当前用户的策略
        const userStrategies = strategies.filter(
          (s) => s.userId === ctx.session.user.id
        );

        return userStrategies.map((strategy) => ({
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

        // 查找策略
        const strategy = await strategyRepo.findById(input.strategyId);
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
            message: "无权限执行此策略",
          });
        }

        // 初始化服务
        const dataClient = new PythonDataServiceClient({
          baseUrl: process.env.PYTHON_SERVICE_URL ?? "http://localhost:8000",
        });
        const calcService = new IndicatorCalculationService(dataClient);
        const scoringService = new ScoringService();

        // 获取候选股票列表
        const stockCodes = await dataClient.getAllStockCodes();
        const candidateStocks = await dataClient.getStocksByCodes(stockCodes);

        // 执行筛选
        const result = await strategy.execute(
          candidateStocks,
          scoringService,
          calcService
        );

        // 创建会话
        const session = ScreeningSession.create({
          strategyId: strategy.id,
          strategyName: strategy.name,
          result,
          filtersSnapshot: strategy.filters,
          scoringConfigSnapshot: strategy.scoringConfig,
          userId: ctx.session.user.id,
        });

        // 持久化会话
        await sessionRepo.save(session);

        return {
          sessionId: session.id,
          totalScanned: session.totalScanned,
          matchedCount: session.countMatched(),
          executionTime: session.executionTime,
          topStocks: session.topStocks.map((stock) => stock.toDict()),
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
    .input(paginationSchema)
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningSessionRepository(ctx.db);

        const sessions = await repository.findRecentSessions(input.limit);

        // 过滤当前用户的会话
        const userSessions = sessions.filter(
          (s) => s.userId === ctx.session.user.id
        );

        return userSessions.map((session) => ({
          id: session.id,
          strategyId: session.strategyId,
          strategyName: session.strategyName,
          executedAt: session.executedAt,
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
    .input(z.object({ strategyId: z.string(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      try {
        const repository = new PrismaScreeningSessionRepository(ctx.db);

        const sessions = await repository.findByStrategy(input.strategyId, input.limit);

        // 过滤当前用户的会话
        const userSessions = sessions.filter(
          (s) => s.userId === ctx.session.user.id
        );

        return userSessions.map((session) => ({
          id: session.id,
          strategyId: session.strategyId,
          strategyName: session.strategyName,
          executedAt: session.executedAt,
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

        // 删除会话
        await repository.delete(input.id);

        return { success: true };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
});
