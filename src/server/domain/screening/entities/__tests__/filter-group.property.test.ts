/**
 * FilterGroup 实体属性基测试
 *
 * Feature: stock-screening-platform
 * Property 4: FilterGroup 与 FilterCondition 序列化往返一致性
 *
 * 对于任意有效的 FilterGroup（包含任意深度的递归嵌套和各类 FilterCondition），
 * 执行 `FilterGroup.fromDict(filterGroup.toDict())` 应产生与原始 FilterGroup 结构等价的对象。
 *
 * **Validates: Requirements 2.5, 2.6**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { FilterGroup } from "../filter-group";
import { FilterCondition } from "../../value-objects/filter-condition";
import { LogicalOperator } from "../../enums/logical-operator";
import { arbValidFilterCondition, arbFilterGroup } from "../../__tests__/generators";

describe("FilterGroup - Property-Based Tests", () => {
  describe("Property 4: FilterGroup 与 FilterCondition 序列化往返一致性", () => {
    it("应该对任意 FilterGroup 保持序列化往返一致性", () => {
      fc.assert(
        fc.property(arbFilterGroup(), (originalGroup) => {
          // 执行序列化和反序列化
          const serialized = originalGroup.toDict();
          const restored = FilterGroup.fromDict(serialized);

          // 验证结构等价性
          assertFilterGroupEquals(originalGroup, restored);
        }),
        { numRuns: 100 }
      );
    });

    it("应该对深度嵌套的 FilterGroup 保持序列化往返一致性", () => {
      fc.assert(
        fc.property(arbFilterGroup(5), (originalGroup) => {
          // 执行序列化和反序列化
          const serialized = originalGroup.toDict();
          const restored = FilterGroup.fromDict(serialized);

          // 验证结构等价性
          assertFilterGroupEquals(originalGroup, restored);
        }),
        { numRuns: 50 }
      );
    });

    it("应该对包含 NOT 运算符的 FilterGroup 保持序列化往返一致性", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // NOT 组包含单个条件
            arbValidFilterCondition.map((condition) =>
              FilterGroup.create(LogicalOperator.NOT, [condition], [])
            ),
            // NOT 组包含单个子组
            arbFilterGroup(2).map((subGroup) =>
              FilterGroup.create(LogicalOperator.NOT, [], [subGroup])
            )
          ),
          (originalGroup) => {
            // 执行序列化和反序列化
            const serialized = originalGroup.toDict();
            const restored = FilterGroup.fromDict(serialized);

            // 验证结构等价性
            assertFilterGroupEquals(originalGroup, restored);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("应该对包含各种 FilterCondition 类型的 FilterGroup 保持序列化往返一致性", () => {
      fc.assert(
        fc.property(
          fc.array(arbValidFilterCondition, { minLength: 1, maxLength: 5 }),
          fc.constantFrom(LogicalOperator.AND, LogicalOperator.OR),
          (conditions, operator) => {
            const originalGroup = FilterGroup.create(operator, conditions, []);

            // 执行序列化和反序列化
            const serialized = originalGroup.toDict();
            const restored = FilterGroup.fromDict(serialized);

            // 验证结构等价性
            assertFilterGroupEquals(originalGroup, restored);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("序列化后的对象应该可以被 JSON.stringify 处理", () => {
      fc.assert(
        fc.property(arbFilterGroup(), (originalGroup) => {
          const serialized = originalGroup.toDict();

          // 验证可以被 JSON 序列化
          const jsonString = JSON.stringify(serialized);
          expect(jsonString).toBeDefined();
          expect(jsonString.length).toBeGreaterThan(0);

          // 验证可以从 JSON 反序列化
          const parsed = JSON.parse(jsonString) as Record<string, unknown>;
          const restored = FilterGroup.fromDict(parsed);

          // 验证结构等价性
          assertFilterGroupEquals(originalGroup, restored);
        }),
        { numRuns: 100 }
      );
    });

    it("多次序列化往返应该保持一致性", () => {
      fc.assert(
        fc.property(arbFilterGroup(), (originalGroup) => {
          // 第一次往返
          const serialized1 = originalGroup.toDict();
          const restored1 = FilterGroup.fromDict(serialized1);

          // 第二次往返
          const serialized2 = restored1.toDict();
          const restored2 = FilterGroup.fromDict(serialized2);

          // 第三次往返
          const serialized3 = restored2.toDict();
          const restored3 = FilterGroup.fromDict(serialized3);

          // 验证所有版本都等价
          assertFilterGroupEquals(originalGroup, restored1);
          assertFilterGroupEquals(originalGroup, restored2);
          assertFilterGroupEquals(originalGroup, restored3);
          assertFilterGroupEquals(restored1, restored2);
          assertFilterGroupEquals(restored2, restored3);
        }),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * 断言两个 FilterGroup 结构等价
 *
 * 验证以下属性：
 * - groupId 相同
 * - operator 相同
 * - conditions 数量和内容相同
 * - subGroups 数量和内容相同（递归验证）
 */
function assertFilterGroupEquals(
  group1: FilterGroup,
  group2: FilterGroup
): void {
  // 验证 groupId
  expect(group2.groupId).toBe(group1.groupId);

  // 验证 operator
  expect(group2.operator).toBe(group1.operator);

  // 验证 conditions 数量
  expect(group2.conditions.length).toBe(group1.conditions.length);

  // 验证每个 condition 的内容
  for (let i = 0; i < group1.conditions.length; i++) {
    const condition1 = group1.conditions[i]!;
    const condition2 = group2.conditions[i]!;
    assertFilterConditionEquals(condition1, condition2);
  }

  // 验证 subGroups 数量
  expect(group2.subGroups.length).toBe(group1.subGroups.length);

  // 递归验证每个 subGroup
  for (let i = 0; i < group1.subGroups.length; i++) {
    const subGroup1 = group1.subGroups[i]!;
    const subGroup2 = group2.subGroups[i]!;
    assertFilterGroupEquals(subGroup1, subGroup2);
  }
}

/**
 * 断言两个 FilterCondition 相等
 */
function assertFilterConditionEquals(
  condition1: FilterCondition,
  condition2: FilterCondition
): void {
  expect(condition2.field).toBe(condition1.field);
  expect(condition2.operator).toBe(condition1.operator);

  // 使用 FilterCondition 的 equals 方法验证值相等
  expect(condition1.equals(condition2)).toBe(true);
}
