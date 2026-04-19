import { beforeEach, describe, expect, it, vi } from "vitest";

const getSnapshotForUserMock = vi.fn();
const refreshSnapshotForUserMock = vi.fn();

vi.mock("~/server/api/trpc", () => {
  const procedureBuilder = {
    use: () => procedureBuilder,
    input(schema: unknown) {
      return {
        query: (handler: unknown) => ({ schema, handler }),
        mutation: (handler: unknown) => ({ schema, handler }),
      };
    },
    query: (handler: unknown) => ({ handler }),
    mutation: (handler: unknown) => ({ handler }),
  };

  return {
    createTRPCRouter: (router: Record<string, unknown>) => router,
    protectedProcedure: procedureBuilder,
  };
});

vi.mock("~/server/application/intelligence/market-context-service", () => ({
  MarketContextService: class MarketContextService {
    getSnapshotForUser = getSnapshotForUserMock;
    refreshSnapshotForUser = refreshSnapshotForUserMock;
  },
}));

describe("marketContextRouter", () => {
  beforeEach(() => {
    getSnapshotForUserMock.mockReset();
    refreshSnapshotForUserMock.mockReset();
  });

  it("returns the persisted market context envelope for the authenticated user", async () => {
    getSnapshotForUserMock.mockResolvedValue({
      snapshot: {
        asOf: "2026-04-18T00:00:00+00:00",
        status: "complete",
        regime: {
          overallTone: "risk_on",
          growthTone: "expansion",
          liquidityTone: "supportive",
          riskTone: "risk_on",
          summary: "鏅皵淇",
          drivers: ["PMI > 50"],
        },
        flow: {
          northboundNetAmount: 1762.62,
          direction: "inflow",
          summary: "鍖楀悜鍑€娴佸叆",
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
            suggestedDraftName: "AI draft",
          },
          timing: {
            summary: "timing summary",
            suggestedQuestion: null,
            suggestedDraftName: null,
          },
        },
        availability: {
          regime: { available: true },
          flow: { available: true },
          hotThemes: { available: true },
        },
      },
      refreshState: {
        source: "INITIAL",
        lastSuccessfulRefreshAt: "2026-04-19T00:31:00.000Z",
        lastRefreshAttemptAt: "2026-04-19T00:31:00.000Z",
        lastRefreshError: null,
        lastAutoRefreshDate: null,
      },
    });

    const { marketContextRouter } = await import(
      "~/server/api/routers/market-context"
    );
    const procedure = marketContextRouter.getSnapshot as unknown as {
      handler(args: {
        ctx: { session: { user: { id: string } } };
      }): Promise<unknown>;
    };

    await expect(
      procedure.handler({
        ctx: {
          session: { user: { id: "user_1" } },
        },
      }),
    ).resolves.toMatchObject({
      snapshot: {
        status: "complete",
      },
      refreshState: {
        source: "INITIAL",
      },
    });
    expect(getSnapshotForUserMock).toHaveBeenCalledTimes(1);
    expect(getSnapshotForUserMock).toHaveBeenCalledWith("user_1");
  });

  it("refreshes the persisted market context for the authenticated user", async () => {
    refreshSnapshotForUserMock.mockResolvedValue({
      snapshot: {
        asOf: "2026-04-19T00:35:00+00:00",
        status: "complete",
        regime: {
          overallTone: "risk_on",
          growthTone: "expansion",
          liquidityTone: "supportive",
          riskTone: "risk_on",
          summary: "updated",
          drivers: [],
        },
        flow: {
          northboundNetAmount: 100,
          direction: "inflow",
          summary: "updated flow",
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
          regime: { available: true },
          flow: { available: true },
          hotThemes: { available: true },
        },
      },
      refreshState: {
        source: "MANUAL",
        lastSuccessfulRefreshAt: "2026-04-19T00:35:00.000Z",
        lastRefreshAttemptAt: "2026-04-19T00:35:00.000Z",
        lastRefreshError: null,
        lastAutoRefreshDate: "2026-04-19",
      },
    });

    const { marketContextRouter } = await import(
      "~/server/api/routers/market-context"
    );
    const procedure = marketContextRouter.refreshSnapshot as unknown as {
      handler(args: {
        ctx: { session: { user: { id: string } } };
      }): Promise<unknown>;
    };

    await expect(
      procedure.handler({
        ctx: {
          session: { user: { id: "user_1" } },
        },
      }),
    ).resolves.toMatchObject({
      refreshState: {
        source: "MANUAL",
      },
    });
    expect(refreshSnapshotForUserMock).toHaveBeenCalledTimes(1);
    expect(refreshSnapshotForUserMock).toHaveBeenCalledWith("user_1");
  });
});
