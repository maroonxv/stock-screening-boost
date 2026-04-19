import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaMarketContextSnapshotRepository } from "~/server/infrastructure/intelligence/prisma-market-context-snapshot-repository";

type MockPrismaClient = {
  marketContextSnapshot: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

function buildRecord() {
  return {
    id: "snapshot_1",
    userId: "user_1",
    snapshotJson: {
      asOf: "2026-04-18T00:00:00+00:00",
      status: "complete",
      regime: {
        overallTone: "risk_on",
        growthTone: "expansion",
        liquidityTone: "supportive",
        riskTone: "risk_on",
        summary: "macro constructive",
        drivers: [],
      },
      flow: {
        northboundNetAmount: 1762.62,
        direction: "inflow",
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
    },
    snapshotAsOf: "2026-04-18T00:00:00+00:00",
    lastSuccessfulRefreshAt: new Date("2026-04-18T00:05:00.000Z"),
    lastRefreshAttemptAt: new Date("2026-04-18T00:05:00.000Z"),
    lastRefreshError: null,
    lastRefreshSource: "INITIAL",
    lastAutoRefreshDate: null,
    createdAt: new Date("2026-04-18T00:05:00.000Z"),
    updatedAt: new Date("2026-04-18T00:05:00.000Z"),
  };
}

describe("PrismaMarketContextSnapshotRepository", () => {
  let mockPrisma: MockPrismaClient;
  let repository: PrismaMarketContextSnapshotRepository;

  beforeEach(() => {
    mockPrisma = {
      marketContextSnapshot: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };
    repository = new PrismaMarketContextSnapshotRepository(
      mockPrisma as unknown as PrismaClient,
    );
  });

  it("maps a stored snapshot record into the envelope shape", async () => {
    mockPrisma.marketContextSnapshot.findUnique.mockResolvedValue(
      buildRecord(),
    );

    const result = await repository.getByUserId("user_1");

    expect(result?.snapshot.asOf).toBe("2026-04-18T00:00:00+00:00");
    expect(result?.refreshState.source).toBe("INITIAL");
  });

  it("queries users whose auto-refresh date is missing or stale", async () => {
    mockPrisma.marketContextSnapshot.findMany.mockResolvedValue([
      { userId: "user_1" },
      { userId: "user_2" },
    ]);

    const result = await repository.listUsersPendingAutoRefresh(
      "2026-04-19",
      50,
    );

    expect(mockPrisma.marketContextSnapshot.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { lastAutoRefreshDate: null },
          { lastAutoRefreshDate: { not: "2026-04-19" } },
        ],
      },
      select: {
        userId: true,
      },
      take: 50,
      orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    });
    expect(result).toEqual(["user_1", "user_2"]);
  });
});
