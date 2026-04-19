import { describe, expect, it } from "vitest";
import { marketContextEnvelopeSchema } from "~/contracts/market-context";

describe("market context contracts", () => {
  it("accepts a persisted market context envelope with refresh state", () => {
    expect(
      marketContextEnvelopeSchema.parse({
        snapshot: {
          asOf: "2026-04-18T00:00:00+00:00",
          status: "complete",
          regime: {
            overallTone: "risk_on",
            growthTone: "expansion",
            liquidityTone: "supportive",
            riskTone: "risk_on",
            summary: "macro constructive",
            drivers: ["PMI > 50"],
          },
          flow: {
            northboundNetAmount: 1762.62,
            direction: "inflow",
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
              suggestedDraftName: "AI focus",
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
        },
        refreshState: {
          source: "AUTO",
          lastSuccessfulRefreshAt: "2026-04-19T00:31:00.000Z",
          lastRefreshAttemptAt: "2026-04-19T00:31:00.000Z",
          lastRefreshError: null,
          lastAutoRefreshDate: "2026-04-19",
        },
      }),
    ).toMatchObject({
      refreshState: {
        source: "AUTO",
        lastAutoRefreshDate: "2026-04-19",
      },
    });
  });
});
