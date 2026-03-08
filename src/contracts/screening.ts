import { z } from "zod";
import { ComparisonOperator } from "~/server/domain/screening/enums/comparison-operator";
import type { IndicatorCategory } from "~/server/domain/screening/enums/indicator-category";
import {
  getIndicatorLookbackYears,
  INDICATOR_FIELD_METADATA,
  IndicatorField,
  type IndicatorFieldMetadata,
  isTimeSeriesIndicator,
} from "~/server/domain/screening/enums/indicator-field";
import { LogicalOperator } from "~/server/domain/screening/enums/logical-operator";
import {
  NormalizationMethod,
  ScoringDirection,
} from "~/server/domain/screening/value-objects/scoring-config";

export const screeningSessionStatusValues = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
] as const;

export const screeningSessionStatusSchema = z.enum(
  screeningSessionStatusValues,
);

export const numericIndicatorValueSchema = z.object({
  type: z.literal("numeric"),
  value: z.number(),
  unit: z.string().optional(),
});

export const textIndicatorValueSchema = z.object({
  type: z.literal("text"),
  value: z.string(),
});

export const listIndicatorValueSchema = z.object({
  type: z.literal("list"),
  values: z.array(z.string()),
});

export const rangeIndicatorValueSchema = z.object({
  type: z.literal("range"),
  min: z.number(),
  max: z.number(),
});

export const timeSeriesIndicatorValueSchema = z.object({
  type: z.literal("timeSeries"),
  years: z.number().int().positive(),
  threshold: z.number().optional(),
});

export const indicatorValueSchema = z.discriminatedUnion("type", [
  numericIndicatorValueSchema,
  textIndicatorValueSchema,
  listIndicatorValueSchema,
  rangeIndicatorValueSchema,
  timeSeriesIndicatorValueSchema,
]);

export const filterConditionInputSchema = z
  .object({
    field: z.nativeEnum(IndicatorField),
    operator: z.nativeEnum(ComparisonOperator),
    value: indicatorValueSchema,
  })
  .superRefine((condition, ctx) => {
    if (
      condition.value.type === "timeSeries" &&
      condition.operator !== ComparisonOperator.GREATER_THAN &&
      condition.operator !== ComparisonOperator.LESS_THAN
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operator"],
        message: "时间序列条件仅支持大于或小于比较",
      });
    }

    if (condition.value.type !== "timeSeries") {
      return;
    }

    if (!isTimeSeriesIndicator(condition.field)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["field"],
        message: "timeSeries 值仅能用于时间序列指标字段",
      });
    }

    if (condition.value.threshold === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value", "threshold"],
        message: "时间序列条件必须提供 threshold",
      });
    }

    const expectedYears = getIndicatorLookbackYears(condition.field);
    if (
      expectedYears !== undefined &&
      condition.value.years !== expectedYears
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value", "years"],
        message: `该指标固定使用 ${expectedYears} 年窗口`,
      });
    }
  });

export type FilterGroupInput = {
  groupId: string;
  operator: LogicalOperator;
  conditions: z.infer<typeof filterConditionInputSchema>[];
  subGroups: FilterGroupInput[];
};

export const filterGroupInputSchema: z.ZodType<FilterGroupInput> = z.lazy(() =>
  z.object({
    groupId: z.string(),
    operator: z.nativeEnum(LogicalOperator),
    conditions: z.array(filterConditionInputSchema),
    subGroups: z.array(filterGroupInputSchema),
  }),
);

export const scoringConfigInputSchema = z.object({
  weights: z.record(z.nativeEnum(IndicatorField), z.number()),
  directions: z
    .record(z.nativeEnum(IndicatorField), z.nativeEnum(ScoringDirection))
    .optional(),
  normalizationMethod: z.nativeEnum(NormalizationMethod),
});

export const createStrategyInputSchema = z.object({
  name: z.string().min(1, "策略名称不能为空"),
  description: z.string().optional(),
  filters: filterGroupInputSchema,
  scoringConfig: scoringConfigInputSchema,
  tags: z.array(z.string()).default([]),
  isTemplate: z.boolean().default(false),
});

export const updateStrategyInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "策略名称不能为空").optional(),
  description: z.string().optional(),
  filters: filterGroupInputSchema.optional(),
  scoringConfig: scoringConfigInputSchema.optional(),
  tags: z.array(z.string()).optional(),
  isTemplate: z.boolean().optional(),
});

export const screeningPaginationSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export type CreateStrategyInput = z.infer<typeof createStrategyInputSchema>;
export type UpdateStrategyInput = z.infer<typeof updateStrategyInputSchema>;
export type FilterConditionInput = z.infer<typeof filterConditionInputSchema>;
export type ScoringConfigInput = z.infer<typeof scoringConfigInputSchema>;
export type ScreeningSessionStatusValue = z.infer<
  typeof screeningSessionStatusSchema
>;

export type ScreeningIndicatorOption = {
  field: IndicatorField;
  category: IndicatorCategory;
  description: string;
  unit?: string;
  lookbackYears?: number;
};

function toIndicatorOption(
  field: IndicatorField,
  metadata: IndicatorFieldMetadata,
): ScreeningIndicatorOption {
  return {
    field,
    category: metadata.category,
    description: metadata.description,
    unit: metadata.unit,
    lookbackYears: metadata.lookbackYears,
  };
}

export const screeningIndicatorOptions = Object.entries(
  INDICATOR_FIELD_METADATA,
).map(([field, metadata]) =>
  toIndicatorOption(field as IndicatorField, metadata),
);

export function createEmptyFilterGroup(
  operator: LogicalOperator = LogicalOperator.AND,
): FilterGroupInput {
  return {
    groupId: crypto.randomUUID(),
    operator,
    conditions: [],
    subGroups: [],
  };
}
