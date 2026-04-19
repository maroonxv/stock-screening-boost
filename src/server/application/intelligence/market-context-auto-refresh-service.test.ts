import { describe, expect, it, vi } from "vitest";
import { MarketContextAutoRefreshService } from "~/server/application/intelligence/market-context-auto-refresh-service";

function buildSnapshot() {
  return {
    asOf: "2026-04-19T00:30:00+00:00",
    status: "complete" as const,
    regime: {
      overallTone: "risk_on" as const,
      growthTone: "expansion" as const,
      liquidityTone: "supportive" as const,
      riskTone: "risk_on" as const,
      summary: "macro constructive",
      drivers: [],
    },
    flow: {
      northboundNetAmount: 200,
      direction: "inflow" as const,
      summary: "northbound inflow",
    },
    hotThemes: [],
    downstreamHints: {
      workflows: {
        summary: "w",
        suggestedQuestion: null,
        suggestedDraftName: null,
      },
      companyResearch: {
        summary: "c",
        suggestedQuestion: null,
        suggestedDraftName: null,
      },
      screening: {
        summary: "s",
        suggestedQuestion: null,
        suggestedDraftName: null,
      },
      timing: {
        summary: "t",
        suggestedQuestion: null,
        suggestedDraftName: null,
      },
    },
    availability: {
      regime: { available: true, warning: null },
      flow: { available: true, warning: null },
      hotThemes: { available: true, warning: null },
    },
  };
}

describe("MarketContextAutoRefreshService", () => {
  it("does nothing before the 08:30 Shanghai cutoff", async () => {
    const listUsersPendingAutoRefresh = vi.fn();
    const service = new MarketContextAutoRefreshService({
      repository: {
        listUsersPendingAutoRefresh,
        upsert: vi.fn(),
      } as never,
      client: {
        getSnapshot: vi.fn(),
      } as never,
    });

    const result = await service.refreshPendingUsers(
      new Date("2026-04-19T00:20:00.000Z"),
    );

    expect(listUsersPendingAutoRefresh).not.toHaveBeenCalled();
    expect(result.ran).toBe(false);
  });

  it("refreshes pending users with a single upstream fetch and fan-out writes", async () => {
    const getSnapshot = vi.fn().mockResolvedValue(buildSnapshot());
    const upsert = vi.fn().mockResolvedValue(undefined);
    const service = new MarketContextAutoRefreshService({
      repository: {
        listUsersPendingAutoRefresh: vi
          .fn()
          .mockResolvedValue(["user_1", "user_2"]),
        upsert,
      } as never,
      client: {
        getSnapshot,
      } as never,
    });

    const result = await service.refreshPendingUsers(
      new Date("2026-04-19T00:35:00.000Z"),
    );

    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledWith({ forceRefresh: true });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(result.refreshedUserIds).toEqual(["user_1", "user_2"]);
  });

  it("keeps all users pending when the upstream refresh fails", async () => {
    const upsert = vi.fn();
    const service = new MarketContextAutoRefreshService({
      repository: {
        listUsersPendingAutoRefresh: vi.fn().mockResolvedValue(["user_1"]),
        upsert,
      } as never,
      client: {
        getSnapshot: vi.fn().mockRejectedValue(new Error("upstream down")),
      } as never,
    });

    const result = await service.refreshPendingUsers(
      new Date("2026-04-19T00:35:00.000Z"),
    );

    expect(upsert).not.toHaveBeenCalled();
    expect(result.failedUserIds).toEqual(["user_1"]);
  });

  it("leaves failed database writes pending for the next run", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("db write failed"));
    const service = new MarketContextAutoRefreshService({
      repository: {
        listUsersPendingAutoRefresh: vi
          .fn()
          .mockResolvedValue(["user_1", "user_2"]),
        upsert,
      } as never,
      client: {
        getSnapshot: vi.fn().mockResolvedValue(buildSnapshot()),
      } as never,
    });

    const result = await service.refreshPendingUsers(
      new Date("2026-04-19T00:35:00.000Z"),
    );

    expect(result.refreshedUserIds).toEqual(["user_1"]);
    expect(result.failedUserIds).toEqual(["user_2"]);
  });
});
