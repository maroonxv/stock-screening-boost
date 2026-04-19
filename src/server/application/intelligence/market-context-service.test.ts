import { describe, expect, it, vi } from "vitest";
import { MarketContextService } from "~/server/application/intelligence/market-context-service";

function buildSnapshot() {
  return {
    asOf: "2026-04-18T00:00:00+00:00",
    status: "complete" as const,
    regime: {
      overallTone: "risk_on" as const,
      growthTone: "expansion" as const,
      liquidityTone: "supportive" as const,
      riskTone: "risk_on" as const,
      summary: "macro constructive",
      drivers: ["PMI > 50"],
    },
    flow: {
      northboundNetAmount: 1762.62,
      direction: "inflow" as const,
      summary: "northbound inflow",
    },
    hotThemes: [],
    downstreamHints: {
      workflows: {
        summary: "workflow summary",
        suggestedQuestion: "question",
        suggestedDraftName: null,
      },
      companyResearch: {
        summary: "company summary",
        suggestedQuestion: null,
        suggestedDraftName: null,
      },
      screening: {
        summary: "screening summary",
        suggestedQuestion: null,
        suggestedDraftName: "AI pool",
      },
      timing: {
        summary: "timing summary",
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

function buildEnvelope(overrides?: Partial<Record<string, unknown>>) {
  const refreshState = {
    source: "INITIAL",
    lastSuccessfulRefreshAt: "2026-04-18T00:05:00.000Z",
    lastRefreshAttemptAt: "2026-04-18T00:05:00.000Z",
    lastRefreshError: null,
    lastAutoRefreshDate: null,
  };

  return {
    snapshot: buildSnapshot(),
    refreshState,
    ...overrides,
  };
}

describe("MarketContextService", () => {
  it("creates an initial persisted snapshot when the user has no record", async () => {
    const getByUserId = vi.fn().mockResolvedValue(null);
    const upsert = vi.fn().mockImplementation(async (params) =>
      buildEnvelope({
        snapshot: params.snapshot,
        refreshState: {
          source: params.refreshSource,
          lastSuccessfulRefreshAt: params.lastSuccessfulRefreshAt.toISOString(),
          lastRefreshAttemptAt: params.lastRefreshAttemptAt.toISOString(),
          lastRefreshError: params.lastRefreshError,
          lastAutoRefreshDate: params.lastAutoRefreshDate,
        },
      }),
    );
    const getSnapshot = vi.fn().mockResolvedValue(buildSnapshot());
    const service = new MarketContextService({
      repository: {
        getByUserId,
        upsert,
      } as never,
      client: {
        getSnapshot,
      } as never,
    });

    const result = await service.getSnapshotForUser(
      "user_1",
      new Date("2026-04-19T00:10:00.000Z"),
    );

    expect(getSnapshot).toHaveBeenCalledWith({ forceRefresh: false });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        refreshSource: "INITIAL",
      }),
    );
    expect(result.refreshState.source).toBe("INITIAL");
  });

  it("returns the persisted snapshot without auto-refresh before the 08:30 Shanghai cutoff", async () => {
    const existing = buildEnvelope();
    const getSnapshot = vi.fn();
    const service = new MarketContextService({
      repository: {
        getByUserId: vi.fn().mockResolvedValue(existing),
        upsert: vi.fn(),
      } as never,
      client: {
        getSnapshot,
      } as never,
    });

    const result = await service.getSnapshotForUser(
      "user_1",
      new Date("2026-04-19T00:20:00.000Z"),
    );

    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it("runs an access-compensation auto-refresh after 08:30 Shanghai when today's auto-refresh is missing", async () => {
    const existing = buildEnvelope();
    const upsert = vi.fn().mockImplementation(async (params) =>
      buildEnvelope({
        snapshot: params.snapshot,
        refreshState: {
          source: params.refreshSource,
          lastSuccessfulRefreshAt: params.lastSuccessfulRefreshAt.toISOString(),
          lastRefreshAttemptAt: params.lastRefreshAttemptAt.toISOString(),
          lastRefreshError: params.lastRefreshError,
          lastAutoRefreshDate: params.lastAutoRefreshDate,
        },
      }),
    );
    const getSnapshot = vi.fn().mockResolvedValue(buildSnapshot());
    const service = new MarketContextService({
      repository: {
        getByUserId: vi.fn().mockResolvedValue(existing),
        upsert,
      } as never,
      client: {
        getSnapshot,
      } as never,
    });

    const result = await service.getSnapshotForUser(
      "user_1",
      new Date("2026-04-19T00:35:00.000Z"),
    );

    expect(getSnapshot).toHaveBeenCalledWith({ forceRefresh: true });
    expect(result.refreshState.source).toBe("AUTO");
    expect(result.refreshState.lastAutoRefreshDate).toBe("2026-04-19");
  });

  it("keeps the old snapshot and records the failure when manual refresh cannot reach python", async () => {
    const existing = buildEnvelope();
    const upsert = vi.fn().mockImplementation(async (params) =>
      buildEnvelope({
        snapshot: params.snapshot,
        refreshState: {
          source: params.refreshSource,
          lastSuccessfulRefreshAt:
            params.lastSuccessfulRefreshAt?.toISOString() ??
            existing.refreshState.lastSuccessfulRefreshAt,
          lastRefreshAttemptAt: params.lastRefreshAttemptAt.toISOString(),
          lastRefreshError: params.lastRefreshError,
          lastAutoRefreshDate: params.lastAutoRefreshDate,
        },
      }),
    );
    const service = new MarketContextService({
      repository: {
        getByUserId: vi.fn().mockResolvedValue(existing),
        upsert,
      } as never,
      client: {
        getSnapshot: vi.fn().mockRejectedValue(new Error("upstream down")),
      } as never,
    });

    const result = await service.refreshSnapshotForUser(
      "user_1",
      new Date("2026-04-19T00:40:00.000Z"),
    );

    expect(result.snapshot.asOf).toBe(existing.snapshot.asOf);
    expect(result.refreshState.lastRefreshError).toContain("upstream down");
  });

  it("marks the day as auto-refreshed when a manual refresh succeeds after 08:30 Shanghai", async () => {
    const existing = buildEnvelope();
    const upsert = vi.fn().mockImplementation(async (params) =>
      buildEnvelope({
        snapshot: params.snapshot,
        refreshState: {
          source: params.refreshSource,
          lastSuccessfulRefreshAt: params.lastSuccessfulRefreshAt.toISOString(),
          lastRefreshAttemptAt: params.lastRefreshAttemptAt.toISOString(),
          lastRefreshError: params.lastRefreshError,
          lastAutoRefreshDate: params.lastAutoRefreshDate,
        },
      }),
    );
    const service = new MarketContextService({
      repository: {
        getByUserId: vi.fn().mockResolvedValue(existing),
        upsert,
      } as never,
      client: {
        getSnapshot: vi.fn().mockResolvedValue(buildSnapshot()),
      } as never,
    });

    const result = await service.refreshSnapshotForUser(
      "user_1",
      new Date("2026-04-19T00:35:00.000Z"),
    );

    expect(result.refreshState.source).toBe("MANUAL");
    expect(result.refreshState.lastAutoRefreshDate).toBe("2026-04-19");
  });
});
