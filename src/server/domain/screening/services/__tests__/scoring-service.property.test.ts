/**
 * ScoringService 属性基测试
 *
 * Feature: stock-screening-platform
 * Property 6: 筛选结果按评分降序排列
 *
 * 对于任意 ScreeningStrategy 和任意候选股票列表，执行 execute 后生成的 ScreeningResult
 * 中 matchedStocks 列表应按 score 降序排列（即对于任意相邻元素 i 和 i+1，
 * `matchedStocks[i].score >= matchedStocks[i+1].score`）。
 *
 * **Validates: Requirements 3.1**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ScoringService } from "../scoring-service.js";
import { IndicatorCalculationService } from "../indicator-calculation-service.js";
import { arbStock, arbScoringConfig } from "../../__tests__/generators.js";

describe("ScoringService - Property-Based Tests", () => {
  describe("Property 6: 筛选结果按评分降序排列", () => {
    it("对于任意股票列表和评分配置，结果应按评分降序排列", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbStock, { minLength: 2, maxLength: 50 }),
          arbScoringConfig,
          async (stocks, config) => {
            // 创建服务实例
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            // 执行评分
            const scoredStocks = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );

            // 验证结果按评分降序排列
            for (let i = 0; i < scoredStocks.length - 1; i++) {
              const currentScore = scoredStocks[i]!.score;
              const nextScore = scoredStocks[i + 1]!.score;

              // 当前股票的评分应该 >= 下一只股票的评分
              expect(currentScore).toBeGreaterThanOrEqual(nextScore);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("对于单只股票，应该返回包含该股票的列表", async () => {
      await fc.assert(
        fc.asyncProperty(
          arbStock,
          arbScoringConfig,
          async (stock, config) => {
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            const scoredStocks = await scoringService.scoreStocks(
              [stock],
              config,
              calcService
            );

            // 应该返回包含一只股票的列表
            expect(scoredStocks).toHaveLength(1);
            expect(scoredStocks[0]!.stockCode.equals(stock.code)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("对于空股票列表，应该返回空列表", async () => {
      await fc.assert(
        fc.asyncProperty(arbScoringConfig, async (config) => {
          const scoringService = new ScoringService();
          const calcService = new IndicatorCalculationService();

          const scoredStocks = await scoringService.scoreStocks(
            [],
            config,
            calcService
          );

          // 应该返回空列表
          expect(scoredStocks).toEqual([]);
        }),
        { numRuns: 100 }
      );
    });

    it("评分结果应该在 [0, 1] 区间内", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbStock, { minLength: 1, maxLength: 50 }),
          arbScoringConfig,
          async (stocks, config) => {
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            const scoredStocks = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );

            // 验证所有评分在 [0, 1] 区间内
            for (const scored of scoredStocks) {
              expect(scored.score).toBeGreaterThanOrEqual(0);
              expect(scored.score).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("scoreBreakdown 中的所有归一化得分应该在 [0, 1] 区间内", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbStock, { minLength: 1, maxLength: 50 }),
          arbScoringConfig,
          async (stocks, config) => {
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            const scoredStocks = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );

            // 验证所有 scoreBreakdown 值在 [0, 1] 区间内
            for (const scored of scoredStocks) {
              for (const breakdownScore of scored.scoreBreakdown.values()) {
                expect(breakdownScore).toBeGreaterThanOrEqual(0);
                expect(breakdownScore).toBeLessThanOrEqual(1);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("返回的股票数量应该等于输入的股票数量", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbStock, { minLength: 0, maxLength: 50 }),
          arbScoringConfig,
          async (stocks, config) => {
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            const scoredStocks = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );

            // 返回的股票数量应该等于输入的股票数量
            expect(scoredStocks.length).toBe(stocks.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("返回的股票代码应该与输入的股票代码一致", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbStock, { minLength: 1, maxLength: 50 }),
          arbScoringConfig,
          async (stocks, config) => {
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            const scoredStocks = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );

            // 收集输入和输出的股票代码
            const inputCodes = new Set(stocks.map((s) => s.code.value));
            const outputCodes = new Set(scoredStocks.map((s) => s.stockCode.value));

            // 股票代码集合应该一致
            expect(outputCodes.size).toBe(inputCodes.size);
            for (const code of inputCodes) {
              expect(outputCodes.has(code)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("对于评分相同的股票，排序应该是稳定的", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbStock, { minLength: 2, maxLength: 20 }),
          arbScoringConfig,
          async (stocks, config) => {
            const scoringService = new ScoringService();
            const calcService = new IndicatorCalculationService();

            // 执行两次评分
            const scoredStocks1 = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );
            const scoredStocks2 = await scoringService.scoreStocks(
              stocks,
              config,
              calcService
            );

            // 两次评分的结果应该一致（相同的输入产生相同的输出）
            expect(scoredStocks1.length).toBe(scoredStocks2.length);

            for (let i = 0; i < scoredStocks1.length; i++) {
              expect(scoredStocks1[i]!.stockCode.equals(scoredStocks2[i]!.stockCode)).toBe(
                true
              );
              expect(scoredStocks1[i]!.score).toBeCloseTo(scoredStocks2[i]!.score, 10);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
