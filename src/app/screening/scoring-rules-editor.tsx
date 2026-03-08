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
    <section className="mt-6 rounded-2xl border border-[#35526f]/35 bg-[#0f2238]/92 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#eef6ff]">评分规则</h3>
          <p className="mt-1 text-xs text-[#7ca0bf]">
            指标权重会在提交前自动归一化，方向用于控制“值越大越好”还是“值越小越好”。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] ${
              Math.abs(weightSum - 1) <= 0.001
                ? "border border-[#4ce0af]/40 bg-[#12372f] text-[#9bfad6]"
                : "border border-[#f6bf64]/40 bg-[#4c3515] text-[#ffd697]"
            }`}
          >
            当前权重和: {weightSum.toFixed(4)}
          </span>
          <button
            type="button"
            onClick={onNormalize}
            className="rounded-full border border-[#39b8e2]/24 bg-[#103247] px-3 py-1.5 text-xs text-[#8ddfff] transition hover:border-[#39b8e2]/55"
          >
            自动归一化
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {rules.map((rule) => {
          const metadata = indicatorMetadataMap.get(rule.field)!;
          return (
            <article
              key={rule.id}
              className="grid gap-3 rounded-2xl border border-[#2f475f]/60 bg-[#0b1b2e]/88 p-3 lg:grid-cols-[1.2fr_0.7fr_0.8fr_auto]"
            >
              <label className="text-xs text-[#95b6d5]">
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
                  className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                >
                  {numericScoringFields.map((option) => (
                    <option key={option.field} value={option.field}>
                      {option.description}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-[#95b6d5]">
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
                  className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
                />
              </label>

              <label className="text-xs text-[#95b6d5]">
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
                  className="mt-1 w-full rounded-xl border border-[#e1eeff]/24 bg-[#091728] px-3 py-2 text-sm text-[#e4f1ff] outline-none transition focus:border-[#4bc2ef]"
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
                  className="rounded-full border border-[#ff8d9b]/28 bg-[#4b2331] px-3 py-2 text-xs text-[#ff9aaa] transition hover:border-[#ff8d9b]/55 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  删除
                </button>
              </div>

              <p className="text-[11px] text-[#7395b3] lg:col-span-4">
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
          className="rounded-full border border-[#39b8e2]/28 bg-[#103247] px-3 py-1.5 text-xs text-[#8ddfff] transition hover:border-[#39b8e2]/55"
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
          className="rounded-full border border-[#e1eeff]/24 bg-[#091728] px-3 py-1.5 text-xs text-[#d7ebff] outline-none transition focus:border-[#4bc2ef]"
        >
          <option value={NormalizationMethod.MIN_MAX}>MIN_MAX</option>
          <option value={NormalizationMethod.Z_SCORE}>Z_SCORE</option>
        </select>
      </div>
    </section>
  );
}
