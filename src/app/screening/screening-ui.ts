import type {
  CustomFormulaSpec,
  IndicatorCatalogItem,
  IndicatorCategory,
  WorkspaceFilterRule,
  WorkspaceResult,
} from "~/contracts/screening";

export const annualPresetOptions = ["1Y", "3Y", "5Y"] as const;
export const quarterlyPresetOptions = ["4Q", "8Q", "12Q"] as const;

export type ResultColumn = {
  key: string;
  metricId: string;
  label: string;
  period: string | null;
};

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "未获取";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function groupCatalogItems(params: {
  categories: IndicatorCategory[];
  items: IndicatorCatalogItem[];
}) {
  const itemMap = new Map<string, IndicatorCatalogItem[]>();

  for (const item of params.items) {
    const group = itemMap.get(item.categoryId) ?? [];
    group.push(item);
    itemMap.set(item.categoryId, group);
  }

  return params.categories.map((category) => ({
    ...category,
    items: (itemMap.get(category.id) ?? []).sort((left, right) =>
      left.name.localeCompare(right.name, "zh-CN"),
    ),
  }));
}

export function buildMetricNameMap(params: {
  catalogItems: IndicatorCatalogItem[];
  formulas: CustomFormulaSpec[];
  result: WorkspaceResult | null;
}) {
  const map = new Map<string, string>();

  for (const item of params.catalogItems) {
    map.set(item.id, item.name);
  }

  for (const formula of params.formulas) {
    map.set(formula.id, formula.name);
  }

  if (params.result) {
    for (const meta of params.result.indicatorMeta) {
      map.set(meta.id, meta.name);
    }
  }

  return map;
}

export function getLatestMetricValue(
  result: WorkspaceResult | null,
  stockCode: string,
  metricId: string,
) {
  if (!result) {
    return null;
  }

  const row = result.latestSnapshotRows.find(
    (item) => item.stockCode === stockCode,
  );
  return row?.metrics[metricId]?.value ?? null;
}

function compareValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
) {
  if (left === null || left === undefined) {
    return right === null || right === undefined ? 0 : 1;
  }

  if (right === null || right === undefined) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), "zh-CN");
}

function matchesFilter(
  candidateValue: string | number | null | undefined,
  filter: WorkspaceFilterRule,
) {
  if (candidateValue === null || candidateValue === undefined) {
    return false;
  }

  if (filter.valueType === "NUMBER") {
    const candidate = Number(candidateValue);
    const ruleValue = Number(filter.value);

    if (!Number.isFinite(candidate) || !Number.isFinite(ruleValue)) {
      return false;
    }

    switch (filter.operator) {
      case ">":
        return candidate > ruleValue;
      case ">=":
        return candidate >= ruleValue;
      case "<":
        return candidate < ruleValue;
      case "<=":
        return candidate <= ruleValue;
      case "=":
        return candidate === ruleValue;
      case "!=":
        return candidate !== ruleValue;
      default:
        return false;
    }
  }

  const candidate = String(candidateValue);
  const ruleValue = String(filter.value);
  switch (filter.operator) {
    case "=":
      return candidate === ruleValue;
    case "!=":
      return candidate !== ruleValue;
    default:
      return false;
  }
}

export function buildVisibleResultRows(params: {
  result: WorkspaceResult | null;
  filterRules: WorkspaceFilterRule[];
  sortState:
    | {
        metricId: string;
        direction: "asc" | "desc";
      }
    | null
    | undefined;
}): WorkspaceResult["latestSnapshotRows"] {
  if (!params.result) {
    return [];
  }

  const filtered = params.result.latestSnapshotRows.filter((row) =>
    params.filterRules.every((filter) =>
      matchesFilter(row.metrics[filter.metricId]?.value, filter),
    ),
  );

  if (!params.sortState) {
    return filtered;
  }

  const { metricId, direction } = params.sortState;
  return [...filtered].sort((left, right) => {
    const compared = compareValues(
      left.metrics[metricId]?.value,
      right.metrics[metricId]?.value,
    );
    return direction === "asc" ? compared : -compared;
  });
}

export function buildResultColumns(
  result: WorkspaceResult | null,
): ResultColumn[] {
  if (!result) {
    return [];
  }

  return result.indicatorMeta.flatMap<ResultColumn>((meta) => {
    if (meta.periodScope === "latest_only") {
      return [
        {
          key: `${meta.id}:latest`,
          metricId: meta.id,
          label: `${meta.name} 最新`,
          period: null,
        },
      ];
    }

    return result.periods.map((period) => ({
      key: `${meta.id}:${period}`,
      metricId: meta.id,
      label: `${meta.name} ${period}`,
      period,
    }));
  });
}
