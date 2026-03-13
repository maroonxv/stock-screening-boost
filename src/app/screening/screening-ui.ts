import {
  createEmptyFilterGroup,
  type FilterConditionInput,
  type FilterGroupInput,
} from "~/contracts/screening";
import { ComparisonOperator } from "~/server/domain/screening/enums/comparison-operator";
import { IndicatorCategory } from "~/server/domain/screening/enums/indicator-category";
import {
  INDICATOR_FIELD_METADATA,
  IndicatorField,
  type IndicatorFieldMetadata,
  IndicatorValueType,
} from "~/server/domain/screening/enums/indicator-field";
import { LogicalOperator } from "~/server/domain/screening/enums/logical-operator";
import {
  NormalizationMethod,
  ScoringDirection,
} from "~/server/domain/screening/value-objects/scoring-config";

export type StrategyFormState = {
  name: string;
  description: string;
  tagsText: string;
  isTemplate: boolean;
  filters: FilterGroupInput;
  scoringRules: ScoringRuleDraft[];
  normalizationMethod: NormalizationMethod;
};

export type ScoringRuleDraft = {
  id: string;
  field: IndicatorField;
  weight: number;
  direction: ScoringDirection;
};

export type ParsedTopStock = {
  stockCode: string;
  stockName: string;
  score: number;
  indicatorPreview: string;
  explanations: string[];
};

export type ParsedWatchedStock = {
  stockCode: string;
  stockName: string;
  note: string;
  tags: string[];
  addedAt: string;
};

export const indicatorMetadataMap = new Map<
  IndicatorField,
  IndicatorFieldMetadata
>(
  Object.entries(INDICATOR_FIELD_METADATA).map(([field, metadata]) => [
    field as IndicatorField,
    metadata,
  ]),
);

export const operatorLabelMap: Record<ComparisonOperator, string> = {
  [ComparisonOperator.GREATER_THAN]: "大于",
  [ComparisonOperator.LESS_THAN]: "小于",
  [ComparisonOperator.EQUAL]: "等于",
  [ComparisonOperator.NOT_EQUAL]: "不等于",
  [ComparisonOperator.IN]: "包含于",
  [ComparisonOperator.NOT_IN]: "不包含于",
  [ComparisonOperator.BETWEEN]: "区间",
  [ComparisonOperator.CONTAINS]: "包含文本",
};

export const logicalOperatorLabelMap: Record<LogicalOperator, string> = {
  [LogicalOperator.AND]: "全部满足",
  [LogicalOperator.OR]: "满足其一",
  [LogicalOperator.NOT]: "取反",
};

export const sessionStatusLabelMap: Record<string, string> = {
  PENDING: "排队中",
  RUNNING: "执行中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
  CANCELLED: "已取消",
};

export const sessionStatusClassMap: Record<string, string> = {
  PENDING: "text-[#ffd180]",
  RUNNING: "text-[#71dcff]",
  SUCCEEDED: "text-[#63f2c1]",
  FAILED: "text-[#ff93a2]",
  CANCELLED: "text-[#b9c8d8]",
};

export function createDefaultCondition(
  field: IndicatorField = IndicatorField.PE,
): FilterConditionInput {
  const metadata = indicatorMetadataMap.get(field);

  if (!metadata) {
    throw new Error(`未找到指标元数据：${field}`);
  }

  if (metadata.category === IndicatorCategory.TIME_SERIES) {
    return {
      field,
      operator: ComparisonOperator.GREATER_THAN,
      value: {
        type: "timeSeries",
        years: metadata.lookbackYears ?? 3,
        threshold: 0.15,
      },
    };
  }

  if (metadata.valueType === IndicatorValueType.TEXT) {
    return {
      field,
      operator: ComparisonOperator.EQUAL,
      value: {
        type: "text",
        value: "",
      },
    };
  }

  return {
    field,
    operator: ComparisonOperator.LESS_THAN,
    value: {
      type: "numeric",
      value: field === IndicatorField.PB ? 5 : 30,
      unit: metadata.unit,
    },
  };
}

export function createDefaultScoringRules(): ScoringRuleDraft[] {
  return [
    {
      id: crypto.randomUUID(),
      field: IndicatorField.PE,
      weight: 0.4,
      direction: ScoringDirection.DESC,
    },
    {
      id: crypto.randomUUID(),
      field: IndicatorField.PB,
      weight: 0.3,
      direction: ScoringDirection.DESC,
    },
    {
      id: crypto.randomUUID(),
      field: IndicatorField.MARKET_CAP,
      weight: 0.3,
      direction: ScoringDirection.ASC,
    },
  ];
}

export function createDefaultStrategyForm(): StrategyFormState {
  const filters = createEmptyFilterGroup();
  filters.conditions = [
    createDefaultCondition(IndicatorField.PE),
    createDefaultCondition(IndicatorField.PB),
  ];

  return {
    name: "低估值质量筛选",
    description: "优先从估值与资产质量两个维度筛出值得进一步研究的标的。",
    tagsText: "估值, 基本面, 初筛",
    isTemplate: false,
    filters,
    scoringRules: createDefaultScoringRules(),
    normalizationMethod: NormalizationMethod.MIN_MAX,
  };
}

export function parseTags(tagsText: string): string[] {
  return tagsText
    .split(/[,\n，]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export function scoringRulesToConfig(
  rules: ScoringRuleDraft[],
  normalizationMethod: NormalizationMethod,
) {
  const weights: Record<string, number> = {};
  const directions: Record<string, ScoringDirection> = {};

  for (const rule of rules) {
    weights[rule.field] = rule.weight;
    directions[rule.field] = rule.direction;
  }

  return {
    weights,
    directions,
    normalizationMethod,
  };
}

export function scoringConfigToRules(scoringConfig: {
  weights: Record<string, number>;
  directions?: Record<string, ScoringDirection>;
}) {
  return Object.entries(scoringConfig.weights).map(([field, weight]) => ({
    id: crypto.randomUUID(),
    field: field as IndicatorField,
    weight,
    direction: scoringConfig.directions?.[field] ?? ScoringDirection.ASC,
  }));
}

export function normalizeRuleWeights(
  rules: ScoringRuleDraft[],
): ScoringRuleDraft[] {
  const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return rules;
  }

  return rules.map((rule, index) => {
    if (index === rules.length - 1) {
      const previous = rules
        .slice(0, index)
        .reduce((sum, item) => sum + item.weight / total, 0);
      return {
        ...rule,
        weight: Math.max(0, Number((1 - previous).toFixed(4))),
      };
    }

    return {
      ...rule,
      weight: Number((rule.weight / total).toFixed(4)),
    };
  });
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
    return "-";
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)} 毫秒`;
  }

  return `${(durationMs / 1000).toFixed(2)} 秒`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return value
      .toFixed(4)
      .replace(/\.0+$/, "")
      .replace(/(\.\d*?)0+$/, "$1");
  }

  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value);
}

export function parseTopStocks(rawStocks: unknown): ParsedTopStock[] {
  if (!Array.isArray(rawStocks)) {
    return [];
  }

  return rawStocks
    .map((entry) => {
      const record = toRecord(entry);
      if (!record) {
        return null;
      }

      const indicatorValuesRecord = toRecord(record.indicatorValues);
      const indicatorPreview = indicatorValuesRecord
        ? Object.entries(indicatorValuesRecord)
            .slice(0, 4)
            .map(([field, value]) => `${field}: ${formatValue(value)}`)
            .join(" · ")
        : "-";

      return {
        stockCode: readString(record.stockCode, "-"),
        stockName: readString(record.stockName, "未知股票"),
        score: readNumber(record.score, 0),
        indicatorPreview,
        explanations: readStringList(record.scoreExplanations),
      };
    })
    .filter((stock): stock is ParsedTopStock => stock !== null)
    .sort((left, right) => right.score - left.score);
}

export function parseWatchedStocks(rawStocks: unknown): ParsedWatchedStock[] {
  if (!Array.isArray(rawStocks)) {
    return [];
  }

  return rawStocks
    .map((entry) => {
      const record = toRecord(entry);
      if (!record) {
        return null;
      }

      return {
        stockCode: readString(record.stockCode, "-"),
        stockName: readString(record.stockName, "未知股票"),
        note: readString(record.note, ""),
        tags: readStringList(record.tags),
        addedAt: readString(record.addedAt, ""),
      };
    })
    .filter((stock): stock is ParsedWatchedStock => stock !== null);
}

export function countConditions(group: FilterGroupInput): number {
  return (
    group.conditions.length +
    group.subGroups.reduce(
      (sum, subGroup) => sum + countConditions(subGroup),
      0,
    )
  );
}

export function isLiveSession(status: string | undefined): boolean {
  return status === "PENDING" || status === "RUNNING";
}

export function buildConditionSummary(condition: FilterConditionInput): string {
  const indicator = indicatorMetadataMap.get(condition.field);
  const fieldLabel = indicator?.description ?? condition.field;

  switch (condition.value.type) {
    case "numeric":
      return `${fieldLabel} ${operatorLabelMap[condition.operator]} ${condition.value.value}${condition.value.unit ?? ""}`;
    case "range":
      return `${fieldLabel} 在 ${condition.value.min} ~ ${condition.value.max} 之间`;
    case "text":
      return `${fieldLabel} ${operatorLabelMap[condition.operator]} ${condition.value.value || "未填写"}`;
    case "list":
      return `${fieldLabel} ${operatorLabelMap[condition.operator]} ${condition.value.values.join(" / ") || "未填写"}`;
    case "timeSeries":
      return `${fieldLabel} ${operatorLabelMap[condition.operator]} ${condition.value.threshold ?? "-"}（${condition.value.years}年窗口）`;
  }
}

export function buildGroupSubtitle(group: FilterGroupInput): string {
  return `${logicalOperatorLabelMap[group.operator]} · ${countConditions(group)} 个条件`;
}
