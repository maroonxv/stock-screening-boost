/**
 * ScreeningStrategy 聚合根属性基测试
 *
 * Feature: stock-screening-platform
 * Property 1: 策略业务不变量验证
 *
 * 对于任意 ScreeningStrategy，在创建或更新后，以下不变量必须同时成立：
 * (a) name 非空
 * (b) filters 包含至少一个有效条件（递归检查）
 * (c) scoringConfig 的权重之和等于 1.0（浮点精度 ±0.001）
 *
 * 违反任一不变量的操作应被拒绝并抛出验证错误。
 *
 * **Validates: Requirements 1.2, 1.5, 1.6**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { ScreeningStrategy } from "../screening-strategy";
import { FilterGroup } from "../../entities/filter-group";
import { ScoringConfig, NormalizationMethod } from "../../value-objects/scoring-config";
import { InvalidStrategyError } from "../../errors";
import { LogicalOperator } from "../../enums/logical-operator";
import { IndicatorField } from "../../enums/indicator-field";
import {
  arbFilterGroup,
  arbScoringConfig,
  arbStrategyName,
  arbUserId,
  arbNumericIndicatorField,
  arbValidFilterCondition,
} from "../../__tests__/generators";

describe("ScreeningStrategy - Property-Based Tests", () => {
  describe("Property 1: 策略业务不变量验证", () => {
    it("应该接受所有满足不变量的策略参数", () => {
      fc.assert(
        fc.property(
          arbStrategyName,
          arbFilterGroup(),
          arbScoringConfig,
          arbUserId,
          (name, filters, scoringConfig, userId) => {
            // 当所有不变量都满足时，创建应该成功
            const strategy = ScreeningStrategy.create({
              name,
              filters,
              scoringConfig,
              userId,
            });

            // 验证不变量 (a): name 非空
            expect(strategy.name).toBe(name);
            expect(strategy.name.trim().length).toBeGreaterThan(0);

            // 验证不变量 (b): filters 包含至少一个有效条件
            expect(filters.hasAnyCondition()).toBe(true);

            // 验证不变量 (c): scoringConfig 权重之和等于 1.0（±0.001）
            const totalWeight = Array.from(scoringConfig.weights.values()).reduce(
              (sum, weight) => sum + weight,
              0
            );
            expect(Math.abs(totalWeight - 1.0)).toBeLessThanOrEqual(0.001);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("应该拒绝空名称的策略", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("", "   ", "\t", "\n", "  \t\n  "),
          arbValidFilterCondition,
          arbScoringConfig,
          arbUserId,
          (emptyName, condition, scoringConfig, userId) => {
            // 违反不变量 (a): name 为空或仅包含空白字符
            const filters = FilterGroup.create(LogicalOperator.AND, [condition], []);
            
            expect(() =>
              ScreeningStrategy.create({
                name: emptyName,
                filters,
                scoringConfig,
                userId,
              })
            ).toThrow(InvalidStrategyError);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("应该拒绝没有任何条件的 FilterGroup", () => {
      fc.assert(
        fc.property(
          arbStrategyName,
          arbScoringConfig,
          arbUserId,
          (name, scoringConfig, userId) => {
            // 违反不变量 (b): filters 不包含任何条件
            const emptyFilterGroup = FilterGroup.create(
              LogicalOperator.AND,
              [],
              []
            );

            expect(() =>
              ScreeningStrategy.create({
                name,
                filters: emptyFilterGroup,
                scoringConfig,
                userId,
              })
            ).toThrow(InvalidStrategyError);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("应该拒绝权重之和不为 1.0 的 ScoringConfig", () => {
      fc.assert(
        fc.property(
          arbStrategyName,
          arbValidFilterCondition,
          arbUserId,
          fc.array(
            fc.tuple(
              arbNumericIndicatorField,
              fc.double({ min: 0.01, max: 1, noNaN: true, noDefaultInfinity: true })
            ),
            { minLength: 1, maxLength: 5 }
          ),
          fc.double({ min: 0.1, max: 0.9, noNaN: true, noDefaultInfinity: true }),
          (name, condition, userId, weightPairs, invalidFactor) => {
            // 违反不变量 (c): 权重之和不等于 1.0
            // 通过乘以一个不等于 1 的因子来破坏权重和
            const totalWeight = weightPairs.reduce(
              (sum, [, weight]) => sum + weight,
              0
            );
            const invalidWeights = new Map(
              weightPairs.map(([field, weight]) => [
                field,
                (weight / totalWeight) * invalidFactor,
              ])
            );

            // ScoringConfig.create 应该在创建时就拒绝无效权重
            expect(() =>
              ScoringConfig.create(invalidWeights, NormalizationMethod.MIN_MAX)
            ).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it("更新后应该重新验证所有不变量", () => {
      fc.assert(
        fc.property(
          arbStrategyName,
          arbFilterGroup(),
          arbScoringConfig,
          arbUserId,
          (name, filters, scoringConfig, userId) => {
            // 创建有效策略
            const strategy = ScreeningStrategy.create({
              name,
              filters,
              scoringConfig,
              userId,
            });

            // 尝试更新为空名称应该失败
            expect(() =>
              strategy.update({
                name: "",
              })
            ).toThrow(InvalidStrategyError);

            // 尝试更新为空 FilterGroup 应该失败
            const emptyFilterGroup = FilterGroup.create(
              LogicalOperator.AND,
              [],
              []
            );
            expect(() =>
              strategy.update({
                filters: emptyFilterGroup,
              })
            ).toThrow(InvalidStrategyError);

            // 原始策略应该保持不变
            expect(strategy.name).toBe(name);
            expect(strategy.filters.hasAnyCondition()).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("不变量验证应该是原子性的（全部满足或全部拒绝）", () => {
      fc.assert(
        fc.property(
          arbStrategyName,
          arbFilterGroup(),
          arbScoringConfig,
          arbUserId,
          (name, filters, scoringConfig, userId) => {
            // 创建有效策略
            const strategy = ScreeningStrategy.create({
              name,
              filters,
              scoringConfig,
              userId,
            });

            const originalName = strategy.name;
            const originalFilters = strategy.filters;

            // 尝试同时更新为无效的名称和无效的 FilterGroup
            const emptyFilterGroup = FilterGroup.create(
              LogicalOperator.AND,
              [],
              []
            );

            expect(() =>
              strategy.update({
                name: "",
                filters: emptyFilterGroup,
              })
            ).toThrow(InvalidStrategyError);

            // 验证策略状态完全没有改变（原子性）
            expect(strategy.name).toBe(originalName);
            expect(strategy.filters).toBe(originalFilters);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
