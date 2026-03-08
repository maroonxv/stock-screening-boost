import { describe, expect, it } from "vitest";
import {
  type CreateStrategyInput,
  createStrategyInputSchema,
  filterGroupInputSchema,
  screeningPaginationSchema,
  updateStrategyInputSchema,
} from "~/contracts/screening";
import { ComparisonOperator } from "~/server/domain/screening/enums/comparison-operator";
import { IndicatorField } from "~/server/domain/screening/enums/indicator-field";
import { LogicalOperator } from "~/server/domain/screening/enums/logical-operator";
import {
  NormalizationMethod,
  ScoringDirection,
} from "~/server/domain/screening/value-objects/scoring-config";

function createTestStrategyInput(): CreateStrategyInput {
  return {
    name: "测试策略",
    description: "测试描述",
    filters: {
      groupId: "group-1",
      operator: LogicalOperator.AND,
      conditions: [
        {
          field: IndicatorField.PE,
          operator: ComparisonOperator.LESS_THAN,
          value: { type: "numeric" as const, value: 30 },
        },
      ],
      subGroups: [],
    },
    scoringConfig: {
      weights: {
        [IndicatorField.PE]: 0.6,
        [IndicatorField.PB]: 0.4,
      },
      directions: {
        [IndicatorField.PE]: ScoringDirection.DESC,
        [IndicatorField.PB]: ScoringDirection.DESC,
      },
      normalizationMethod: NormalizationMethod.MIN_MAX,
    },
    tags: ["测试"],
    isTemplate: false,
  };
}

describe("screening contracts", () => {
  it("接受有效的创建策略输入", () => {
    const result = createStrategyInputSchema.safeParse(
      createTestStrategyInput(),
    );
    expect(result.success).toBe(true);
  });

  it("拒绝空策略名称", () => {
    const input = createTestStrategyInput();
    input.name = "";
    expect(createStrategyInputSchema.safeParse(input).success).toBe(false);
  });

  it("支持嵌套 FilterGroup", () => {
    const input = createTestStrategyInput();
    input.filters.subGroups.push({
      groupId: "sub-group-1",
      operator: LogicalOperator.OR,
      conditions: [
        {
          field: IndicatorField.INDUSTRY,
          operator: ComparisonOperator.IN,
          value: {
            type: "list",
            values: ["半导体", "人工智能"],
          },
        },
      ],
      subGroups: [],
    });

    expect(filterGroupInputSchema.safeParse(input.filters).success).toBe(true);
  });

  it("时间序列条件必须带 threshold 且年份匹配", () => {
    const input = createTestStrategyInput();
    input.filters.conditions = [
      {
        field: IndicatorField.REVENUE_CAGR_3Y,
        operator: ComparisonOperator.GREATER_THAN,
        value: {
          type: "timeSeries",
          years: 3,
          threshold: 0.2,
        },
      },
    ];

    expect(createStrategyInputSchema.safeParse(input).success).toBe(true);

    input.filters.conditions = [
      {
        field: IndicatorField.REVENUE_CAGR_3Y,
        operator: ComparisonOperator.GREATER_THAN,
        value: {
          type: "timeSeries",
          years: 2,
          threshold: 0.2,
        },
      },
    ];

    expect(createStrategyInputSchema.safeParse(input).success).toBe(false);
  });

  it("允许部分更新", () => {
    const result = updateStrategyInputSchema.safeParse({
      id: "strategy-1",
      description: "更新说明",
    });
    expect(result.success).toBe(true);
  });

  it("分页默认值有效", () => {
    const result = screeningPaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });
});
