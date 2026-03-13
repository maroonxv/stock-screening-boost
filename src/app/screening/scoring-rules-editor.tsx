"use client";

import { screeningIndicatorOptions } from "~/contracts/screening";
import {
  IndicatorField,
  IndicatorValueType,
} from "~/server/domain/screening/enums/indicator-field";
import {
  NormalizationMethod,
  ScoringDirection,
} from "~/server/domain/screening/value-objects/scoring-config";
import type { ScoringRuleDraft } from "./screening-ui";
import { indicatorMetadataMap } from "./screening-ui";

const numericScoringFields = screeningIndicatorOptions.filter(
  (option) =>
    indicatorMetadataMap.get(option.field)?.valueType ===
    IndicatorValueType.NUMERIC,
);

export function ScoringRulesEditor(props: {
  rules: ScoringRuleDraft[];
  normalizationMethod: NormalizationMethod;
  onRulesChange: (rules: ScoringRuleDraft[]) => void;
  onNormalizationMethodChange: (method: NormalizationMethod) => void;
  onNormalize: () => void;
  weightSum: number;
}) {
  const {
    rules,
    normalizationMethod,
    onRulesChange,
    onNormalizationMethodChange,
    onNormalize,
    weightSum,
  } = props;

  return (
    <section className="rounded-[12px] border border-[var(--app-border)] bg-[rgba(13,18,25,0.72)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-[var(--app-text)]">
            评分规则
          </h3>
          <p className="mt-1 text-xs leading-6 text-[var(--app-text-soft)]">
            指标权重会在提交前自动归一化，方向决定“值越大越好”还是“值越小越好”。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-[8px] border px-3 py-1 text-[11px] ${
              Math.abs(weightSum - 1) <= 0.001
                ? "border-[rgba(120,211,173,0.34)] bg-[rgba(26,68,54,0.2)] text-[var(--app-success)]"
                : "border-[rgba(226,181,111,0.34)] bg-[rgba(86,60,23,0.2)] text-[var(--app-warning)]"
            }`}
          >
            当前权重和：{weightSum.toFixed(4)}
          </span>
          <button type="button" onClick={onNormalize} className="app-button">
            自动归一化
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {rules.map((rule) => {
          const metadata = indicatorMetadataMap.get(rule.field);

          if (!metadata) {
            return null;
          }

          return (
            <article
              key={rule.id}
              className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(10,14,18,0.82)] p-4 lg:grid-cols-[1.2fr_0.7fr_0.8fr_auto]"
            >
              <label className="text-xs text-[var(--app-text-muted)]">
                指标
                <select
                  value={rule.field}
                  onChange={(event) =>
                    onRulesChange(
                      rules.map((item) =>
                        item.id === rule.id
                          ? {
                              ...item,
                              field: event.target.value as IndicatorField,
                            }
                          : item,
                      ),
                    )
                  }
                  className="app-select mt-2"
                >
                  {numericScoringFields.map((option) => (
                    <option key={option.field} value={option.field}>
                      {option.description}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-[var(--app-text-muted)]">
                权重
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={rule.weight}
                  onChange={(event) =>
                    onRulesChange(
                      rules.map((item) =>
                        item.id === rule.id
                          ? {
                              ...item,
                              weight: Number(event.target.value),
                            }
                          : item,
                      ),
                    )
                  }
                  className="app-input mt-2"
                />
              </label>

              <label className="text-xs text-[var(--app-text-muted)]">
                方向
                <select
                  value={rule.direction}
                  onChange={(event) =>
                    onRulesChange(
                      rules.map((item) =>
                        item.id === rule.id
                          ? {
                              ...item,
                              direction: event.target.value as ScoringDirection,
                            }
                          : item,
                      ),
                    )
                  }
                  className="app-select mt-2"
                >
                  <option value={ScoringDirection.ASC}>值越大越好</option>
                  <option value={ScoringDirection.DESC}>值越小越好</option>
                </select>
              </label>

              <div className="flex items-end justify-end">
                <button
                  type="button"
                  disabled={rules.length <= 1}
                  onClick={() =>
                    onRulesChange(rules.filter((item) => item.id !== rule.id))
                  }
                  className="app-button app-button-danger"
                >
                  删除
                </button>
              </div>

              <p className="text-[11px] leading-6 text-[var(--app-text-soft)] lg:col-span-4">
                {metadata.description}
                {metadata.unit ? ` · 单位：${metadata.unit}` : ""}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onRulesChange([
              ...rules,
              {
                id: crypto.randomUUID(),
                field: IndicatorField.PE,
                weight: 0.1,
                direction: ScoringDirection.DESC,
              },
            ])
          }
          className="app-button app-button-success"
        >
          新增评分指标
        </button>
        <select
          value={normalizationMethod}
          onChange={(event) =>
            onNormalizationMethodChange(
              event.target.value as NormalizationMethod,
            )
          }
          className="app-select max-w-[180px]"
        >
          <option value={NormalizationMethod.MIN_MAX}>最小-最大归一化</option>
          <option value={NormalizationMethod.Z_SCORE}>Z 分数归一化</option>
        </select>
      </div>
    </section>
  );
}
