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
  const metadata = indicatorMetadataMap.get(field);

  if (!metadata) {
    return [
      ComparisonOperator.GREATER_THAN,
      ComparisonOperator.LESS_THAN,
      ComparisonOperator.EQUAL,
      ComparisonOperator.NOT_EQUAL,
      ComparisonOperator.BETWEEN,
    ];
  }

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

const inputClass = "app-input mt-2";
const selectClass = "app-select mt-2";
const labelClass = "text-xs text-[var(--app-text-muted)]";

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
    <section className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(11,15,20,0.78)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--app-text-soft)]">
            {isRoot ? "根分组" : "子分组"}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--app-text)]">
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
            className="app-select min-w-[140px]"
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
              className="app-button app-button-danger"
            >
              删除分组
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {group.conditions.map((condition, conditionIndex) => {
          const indicatorMeta = indicatorMetadataMap.get(condition.field);
          const operatorOptions = availableOperatorsForField(condition.field);

          if (!indicatorMeta) {
            return null;
          }

          return (
            <article
              key={`${group.groupId}-condition-${conditionIndex}`}
              className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(16,22,30,0.78)] p-4"
            >
              <div className="grid gap-3 xl:grid-cols-[1.2fr_0.9fr_1fr_auto]">
                <label className={labelClass}>
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
                    className={selectClass}
                  >
                    {screeningIndicatorOptions.map((option) => (
                      <option key={option.field} value={option.field}>
                        {option.description}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={labelClass}>
                  运算符
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
                    className={selectClass}
                  >
                    {operatorOptions.map((operator) => (
                      <option key={operator} value={operator}>
                        {operatorLabelMap[operator]}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <div className={labelClass}>
                    说明
                    <div className="mt-2 rounded-[10px] border border-[var(--app-border)] bg-[rgba(9,12,16,0.86)] px-3 py-2 text-xs leading-6 text-[var(--app-text-soft)]">
                      {indicatorMeta.description}
                      {indicatorMeta.unit
                        ? ` · 单位：${indicatorMeta.unit}`
                        : ""}
                    </div>
                  </div>
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
                    className="app-button app-button-danger"
                  >
                    删除条件
                  </button>
                </div>
              </div>

              <div className="mt-4">
                {condition.value.type === "numeric" ? (
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
                    className={inputClass}
                    placeholder="阈值"
                  />
                ) : null}

                {condition.value.type === "range" ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
                      className="app-input"
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
                      className="app-input"
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
                          index === conditionIndex && item.value.type === "text"
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
                    className={inputClass}
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
                          index === conditionIndex && item.value.type === "list"
                            ? {
                                ...item,
                                value: {
                                  ...item.value,
                                  values: event.target.value
                                    .split(/[\n,，]/)
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                                },
                              }
                            : item,
                        ),
                      }))
                    }
                    className={inputClass}
                    placeholder="逗号分隔多个值"
                  />
                ) : null}

                {condition.value.type === "timeSeries" ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[10px] border border-[var(--app-border)] bg-[rgba(9,12,16,0.86)] px-3 py-2 text-xs text-[var(--app-text-soft)]">
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
                      className="app-input"
                      placeholder="阈值"
                    />
                  </div>
                ) : null}
              </div>

              <p className="mt-4 text-[11px] leading-6 text-[var(--app-text-soft)]">
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
          className="app-button"
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
          className="app-button app-button-success"
        >
          新增子分组
        </button>
      </div>

      {group.subGroups.length > 0 ? (
        <div className="mt-4 grid gap-3 border-t border-[var(--app-border)] pt-4">
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
