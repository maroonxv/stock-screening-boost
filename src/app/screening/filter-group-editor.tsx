"use client";

import {
  type FilterGroupInput,
  screeningIndicatorOptions,
} from "~/contracts/screening";
import { ComparisonOperator } from "~/server/domain/screening/enums/comparison-operator";
import { IndicatorCategory } from "~/server/domain/screening/enums/indicator-category";
import {
  type IndicatorField,
  IndicatorValueType,
} from "~/server/domain/screening/enums/indicator-field";
import { LogicalOperator } from "~/server/domain/screening/enums/logical-operator";
import {
  buildConditionSummary,
  buildGroupSubtitle,
  createDefaultCondition,
  indicatorMetadataMap,
  logicalOperatorLabelMap,
  operatorLabelMap,
} from "./screening-ui";

function availableOperatorsForField(
  field: IndicatorField,
): ComparisonOperator[] {
  const metadata = indicatorMetadataMap.get(field)!;

  if (metadata.category === IndicatorCategory.TIME_SERIES) {
    return [ComparisonOperator.GREATER_THAN, ComparisonOperator.LESS_THAN];
  }

  if (metadata.valueType === IndicatorValueType.TEXT) {
    return [
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.IN,
      ComparisonOperator.NOT_IN,
      ComparisonOperator.CONTAINS,
    ];
  }

  return [
    ComparisonOperator.GREATER_THAN,
    ComparisonOperator.LESS_THAN,
    ComparisonOperator.EQUAL,
    ComparisonOperator.NOT_EQUAL,
    ComparisonOperator.BETWEEN,
  ];
}

function canAddMoreChildren(group: FilterGroupInput): boolean {
  if (group.operator !== LogicalOperator.NOT) {
    return true;
  }

  return group.conditions.length + group.subGroups.length === 0;
}

export function FilterGroupEditor(props: {
  group: FilterGroupInput;
  isRoot?: boolean;
  onChange: (group: FilterGroupInput) => void;
  onRemove: () => void;
}) {
  const { group, isRoot = false, onChange, onRemove } = props;

  const apply = (updater: (group: FilterGroupInput) => FilterGroupInput) => {
    onChange(updater(group));
  };

  return (
    <section className="rounded-2xl border border-[#35526f]/35 bg-[#0f2238]/92 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#7fa8c4]">
            {isRoot ? "ROOT GROUP" : "SUB GROUP"}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#eef6ff]">
            {buildGroupSubtitle(group)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={group.operator}
            onChange={(event) =>
              apply((current) => ({
                ...current,
                operator: event.target.value as LogicalOperator,
              }))
            }
            className="rounded-full border border-[#e1eeff]/24 bg-[#0a1a2d] px-3 py-1.5 text-xs text-[#d7ebff] outline-none transition focus:border-[#4bc2ef]"
          >
            {Object.values(LogicalOperator).map((operator) => (
              <option key={operator} value={operator}>
                {logicalOperatorLabelMap[operator]}
              </option>
            ))}
          </select>
          {!isRoot ? (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full border border-[#ff8d9b]/30 bg-[#4b2331] px-3 py-1.5 text-xs text-[#ff9aaa] transition hover:border-[#ff8d9b]/55"
            >
              删除分组
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {group.conditions.map((condition, conditionIndex) => {
          const indicatorMeta = indicatorMetadataMap.get(condition.field)!;
          const operatorOptions = availableOperatorsForField(condition.field);

          return (
            <article
              key={`${group.groupId}-condition-${conditionIndex}`}
              className="rounded-2xl border border-[#2f475f]/60 bg-[#0b1b2e]/88 p-3"
            >
              <div className="grid gap-3 xl:grid-cols-[1.2fr_0.9fr_1fr_auto]">
                <label className="text-xs text-[#95b6d5]">
                  指标
                  <select
                    value={condition.field}
                    onChange={(event) =>
                      apply((current) => ({
                        ...current,
                        conditions: current.conditions.map((item, index) =>
                          index === conditionIndex
                            ? createDefaultCondition(
                                event.target.value as IndicatorField,
                              )
                            : item,
                        ),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                  >
                    {screeningIndicatorOptions.map((option) => (
                      <option key={option.field} value={option.field}>
                        {option.description}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-[#95b6d5]">
                  规则
                  <select
                    value={condition.operator}
                    onChange={(event) =>
                      apply((current) => ({
                        ...current,
                        conditions: current.conditions.map((item, index) =>
                          index === conditionIndex
                            ? {
                                ...item,
                                operator: event.target
                                  .value as ComparisonOperator,
                              }
                            : item,
                        ),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                  >
                    {operatorOptions.map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabelMap[operator]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="text-xs text-[#95b6d5]">
                  阈值
                  {condition.value.type === "numeric" ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        type="number"
                        value={condition.value.value}
                        onChange={(event) =>
                          apply((current) => ({
                            ...current,
                            conditions: current.conditions.map((item, index) =>
                              index === conditionIndex &&
                              item.value.type === "numeric"
                                ? {
                                    ...item,
                                    value: {
                                      ...item.value,
                                      value: Number(event.target.value),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                      />
                      {indicatorMeta.unit ? (
                        <span className="rounded-xl border border-[#e1eeff]/16 bg-[#10243a] px-3 py-2 text-[11px] text-[#7fa8c4]">
                          {indicatorMeta.unit}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {condition.value.type === "range" ? (
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        value={condition.value.min}
                        onChange={(event) =>
                          apply((current) => ({
                            ...current,
                            conditions: current.conditions.map((item, index) =>
                              index === conditionIndex &&
                              item.value.type === "range"
                                ? {
                                    ...item,
                                    value: {
                                      ...item.value,
                                      min: Number(event.target.value),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                        placeholder="最小值"
                      />
                      <input
                        type="number"
                        value={condition.value.max}
                        onChange={(event) =>
                          apply((current) => ({
                            ...current,
                            conditions: current.conditions.map((item, index) =>
                              index === conditionIndex &&
                              item.value.type === "range"
                                ? {
                                    ...item,
                                    value: {
                                      ...item.value,
                                      max: Number(event.target.value),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                        placeholder="最大值"
                      />
                    </div>
                  ) : null}
                  {condition.value.type === "text" ? (
                    <input
                      value={condition.value.value}
                      onChange={(event) =>
                        apply((current) => ({
                          ...current,
                          conditions: current.conditions.map((item, index) =>
                            index === conditionIndex &&
                            item.value.type === "text"
                              ? {
                                  ...item,
                                  value: {
                                    ...item.value,
                                    value: event.target.value,
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                      placeholder="输入文本"
                    />
                  ) : null}
                  {condition.value.type === "list" ? (
                    <input
                      value={condition.value.values.join(", ")}
                      onChange={(event) =>
                        apply((current) => ({
                          ...current,
                          conditions: current.conditions.map((item, index) =>
                            index === conditionIndex &&
                            item.value.type === "list"
                              ? {
                                  ...item,
                                  value: {
                                    ...item.value,
                                    values: event.target.value
                                      .split(/[,\n，]/)
                                      .map((value) => value.trim())
                                      .filter(Boolean),
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                      placeholder="逗号分隔多个值"
                    />
                  ) : null}
                  {condition.value.type === "timeSeries" ? (
                    <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_1fr]">
                      <div className="rounded-xl border border-[#e1eeff]/18 bg-[#10243a] px-3 py-2 text-[11px] text-[#89aac7]">
                        固定窗口：{condition.value.years} 年
                      </div>
                      <input
                        type="number"
                        value={condition.value.threshold ?? 0}
                        onChange={(event) =>
                          apply((current) => ({
                            ...current,
                            conditions: current.conditions.map((item, index) =>
                              index === conditionIndex &&
                              item.value.type === "timeSeries"
                                ? {
                                    ...item,
                                    value: {
                                      ...item.value,
                                      threshold: Number(event.target.value),
                                    },
                                  }
                                : item,
                            ),
                          }))
                        }
                        className="rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                        placeholder="阈值"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      apply((current) => ({
                        ...current,
                        conditions: current.conditions.filter(
                          (_item, index) => index !== conditionIndex,
                        ),
                      }))
                    }
                    className="rounded-full border border-[#ff8d9b]/28 bg-[#4b2331] px-3 py-2 text-xs text-[#ff9aaa] transition hover:border-[#ff8d9b]/55"
                  >
                    删除条件
                  </button>
                </div>
              </div>

              <p className="mt-2 text-[11px] leading-5 text-[#7395b3]">
                {buildConditionSummary(condition)}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canAddMoreChildren(group)}
          onClick={() =>
            apply((current) => ({
              ...current,
              conditions: [...current.conditions, createDefaultCondition()],
            }))
          }
          className="rounded-full border border-[#39b8e2]/28 bg-[#103247] px-3 py-1.5 text-xs text-[#8ddfff] transition hover:border-[#39b8e2]/55 disabled:cursor-not-allowed disabled:opacity-45"
        >
          新增条件
        </button>
        <button
          type="button"
          disabled={!canAddMoreChildren(group)}
          onClick={() =>
            apply((current) => ({
              ...current,
              subGroups: [
                ...current.subGroups,
                {
                  groupId: crypto.randomUUID(),
                  operator: LogicalOperator.AND,
                  conditions: [],
                  subGroups: [],
                },
              ],
            }))
          }
          className="rounded-full border border-[#5cd5b8]/28 bg-[#12382f] px-3 py-1.5 text-xs text-[#9cf3d9] transition hover:border-[#5cd5b8]/55 disabled:cursor-not-allowed disabled:opacity-45"
        >
          新增子分组
        </button>
      </div>

      {group.subGroups.length > 0 ? (
        <div className="mt-4 grid gap-3 border-t border-[#35526f]/35 pt-4">
          {group.subGroups.map((subGroup) => (
            <FilterGroupEditor
              key={subGroup.groupId}
              group={subGroup}
              onChange={(nextSubGroup) =>
                apply((current) => ({
                  ...current,
                  subGroups: current.subGroups.map((item) =>
                    item.groupId === nextSubGroup.groupId ? nextSubGroup : item,
                  ),
                }))
              }
              onRemove={() =>
                apply((current) => ({
                  ...current,
                  subGroups: current.subGroups.filter(
                    (item) => item.groupId !== subGroup.groupId,
                  ),
                }))
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
