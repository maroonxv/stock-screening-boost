import { describe, expect, it } from "vitest";
import { FilterGroup } from "../../entities/filter-group";
import { ComparisonOperator } from "../../enums/comparison-operator";
import { IndicatorField } from "../../enums/indicator-field";
import { LogicalOperator } from "../../enums/logical-operator";
import { ScreeningSessionStatus } from "../../enums/screening-session-status";
import { FilterCondition } from "../../value-objects/filter-condition";
import { ScoredStock } from "../../value-objects/scored-stock";
import {
  NormalizationMethod,
  ScoringConfig,
} from "../../value-objects/scoring-config";
import { ScreeningResult } from "../../value-objects/screening-result";
import { StockCode } from "../../value-objects/stock-code";
import { ScreeningSession } from "../screening-session";

function createScoredStock(
  code: string,
  name: string,
  score: number,
): ScoredStock {
  return ScoredStock.create(
    StockCode.create(code),
    name,
    score,
    new Map([[IndicatorField.PE, score]]),
    new Map([[IndicatorField.PE, score * 0.5]]),
    [],
  );
}

function createTestFilterGroup(): FilterGroup {
  return FilterGroup.create(
    LogicalOperator.AND,
    [
      FilterCondition.create(IndicatorField.PE, ComparisonOperator.LESS_THAN, {
        type: "numeric",
        value: 30,
      }),
    ],
    [],
  );
}

function createTestScoringConfig(): ScoringConfig {
  return ScoringConfig.create(
    new Map([[IndicatorField.PE, 1]]),
    NormalizationMethod.MIN_MAX,
  );
}

describe("ScreeningSession", () => {
  it("createPending 应创建排队中的会话", () => {
    const session = ScreeningSession.createPending({
      strategyId: "strategy-1",
      strategyName: "低估值策略",
      userId: "user-1",
      filtersSnapshot: createTestFilterGroup(),
      scoringConfigSnapshot: createTestScoringConfig(),
    });

    expect(session.status).toBe(ScreeningSessionStatus.PENDING);
    expect(session.progressPercent).toBe(0);
    expect(session.countMatched()).toBe(0);
  });

  it("complete 后应写入结果快照", () => {
    const session = ScreeningSession.createPending({
      strategyId: "strategy-1",
      strategyName: "低估值策略",
      userId: "user-1",
      filtersSnapshot: createTestFilterGroup(),
      scoringConfigSnapshot: createTestScoringConfig(),
    });

    session.markRunning("执行中");
    session.complete(
      ScreeningResult.create(
        [
          createScoredStock("600519", "贵州茅台", 0.91),
          createScoredStock("000858", "五粮液", 0.88),
        ],
        200,
        1500,
      ),
    );

    expect(session.status).toBe(ScreeningSessionStatus.SUCCEEDED);
    expect(session.countMatched()).toBe(2);
    expect(session.progressPercent).toBe(100);
  });

  it("序列化往返后保留状态字段", () => {
    const session = ScreeningSession.createPending({
      strategyId: "strategy-1",
      strategyName: "低估值策略",
      userId: "user-1",
      filtersSnapshot: createTestFilterGroup(),
      scoringConfigSnapshot: createTestScoringConfig(),
    });
    session.markRunning("执行中");
    session.updateProgress(42, "扫描候选股票");

    const restored = ScreeningSession.fromDict(session.toDict());
    expect(restored.status).toBe(ScreeningSessionStatus.RUNNING);
    expect(restored.progressPercent).toBe(42);
    expect(restored.currentStep).toBe("扫描候选股票");
  });
});
