import { describe, expect, it, vi } from "vitest";
import { WorkflowDomainError } from "~/server/domain/workflow/errors";

async function loadClient() {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.DATABASE_URL ??= "https://example.com/db";
  process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
  process.env.PYTHON_SERVICE_URL ??= "http://127.0.0.1:8000";

  const module = await import(
    "~/server/infrastructure/timing/python-timing-data-client"
  );

  return module.PythonTimingDataClient;
}

describe("PythonTimingDataClient", () => {
  it("unwraps gateway response payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            stockCode: "600519",
            stockName: "贵州茅台",
            asOfDate: "2026-03-06",
            barsCount: 120,
            indicators: {
              close: 1500,
              macd: { dif: 1, dea: 0.8, histogram: 0.4 },
              rsi: { value: 61 },
              bollinger: {
                upper: 1520,
                middle: 1490,
                lower: 1460,
                closePosition: 0.68,
              },
              obv: { value: 1000, slope: 15 },
              ema20: 1480,
              ema60: 1420,
              atr14: 32,
              volumeRatio20: 1.24,
            },
            ruleSummary: {
              direction: "bullish",
              signalStrength: 76,
              warnings: [],
            },
          },
        }),
      }),
    );

    const PythonTimingDataClient = await loadClient();
    const client = new PythonTimingDataClient({
      baseUrl: "http://127.0.0.1:8000",
      timeoutMs: 500,
    });

    const payload = await client.getSignal({ stockCode: "600519" });

    expect(payload.stockCode).toBe("600519");
    expect(payload.ruleSummary.direction).toBe("bullish");
  });

  it("throws workflow domain error when gateway fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () =>
          JSON.stringify({
            error: {
              code: "bars_unavailable",
              message: "upstream down",
            },
          }),
      }),
    );

    const PythonTimingDataClient = await loadClient();
    const client = new PythonTimingDataClient({
      baseUrl: "http://127.0.0.1:8000",
      timeoutMs: 500,
    });

    await expect(
      client.getSignal({ stockCode: "600519" }),
    ).rejects.toBeInstanceOf(WorkflowDomainError);
  });

  it("unwraps market regime snapshot payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            asOfDate: "2026-03-06",
            indexes: [
              {
                code: "510300",
                name: "CSI 300 ETF",
                close: 4.1,
                changePct: 0.8,
                ema20: 4,
                ema60: 3.8,
                aboveEma20: true,
                aboveEma60: true,
                atrRatio: 0.021,
              },
            ],
            breadth: {
              totalCount: 10,
              advancingCount: 6,
              decliningCount: 3,
              flatCount: 1,
              positiveRatio: 0.6,
              medianChangePct: 0.8,
              aboveThreePctCount: 2,
              belowThreePctCount: 1,
              averageTurnoverRate: 1.2,
            },
            volatility: {
              highVolatilityCount: 1,
              highVolatilityRatio: 0.1,
              limitDownLikeCount: 0,
            },
            features: {
              benchmarkStrength: 72,
              breadthScore: 64,
              riskScore: 28,
            },
          },
        }),
      }),
    );

    const PythonTimingDataClient = await loadClient();
    const client = new PythonTimingDataClient({
      baseUrl: "http://127.0.0.1:8000",
      timeoutMs: 500,
    });

    const payload = await client.getMarketRegimeSnapshot();

    expect(payload.asOfDate).toBe("2026-03-06");
    expect(payload.indexes).toHaveLength(1);
    expect(payload.features.benchmarkStrength).toBe(72);
  });
});
