import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  MarketContextEnvelope,
  MarketContextRefreshSource,
  MarketContextSnapshot,
} from "~/contracts/market-context";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type MarketContextSnapshotRecord = {
  id: string;
  userId: string;
  snapshotJson: unknown;
  snapshotAsOf: string;
  lastSuccessfulRefreshAt: Date | null;
  lastRefreshAttemptAt: Date;
  lastRefreshError: string | null;
  lastRefreshSource: MarketContextRefreshSource;
  lastAutoRefreshDate: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapRecord(record: MarketContextSnapshotRecord): MarketContextEnvelope {
  return {
    snapshot: record.snapshotJson as MarketContextSnapshot,
    refreshState: {
      source: record.lastRefreshSource,
      lastSuccessfulRefreshAt:
        record.lastSuccessfulRefreshAt?.toISOString() ?? null,
      lastRefreshAttemptAt: record.lastRefreshAttemptAt.toISOString(),
      lastRefreshError: record.lastRefreshError,
      lastAutoRefreshDate: record.lastAutoRefreshDate,
    },
  };
}

export type UpsertMarketContextSnapshotParams = {
  userId: string;
  snapshot: MarketContextSnapshot;
  refreshSource: MarketContextRefreshSource;
  lastSuccessfulRefreshAt: Date | null;
  lastRefreshAttemptAt: Date;
  lastRefreshError: string | null;
  lastAutoRefreshDate: string | null;
};

export class PrismaMarketContextSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getByUserId(userId: string) {
    const record = await this.prisma.marketContextSnapshot.findUnique({
      where: { userId },
    });

    return record ? mapRecord(record as MarketContextSnapshotRecord) : null;
  }

  async upsert(params: UpsertMarketContextSnapshotParams) {
    const record = await this.prisma.marketContextSnapshot.upsert({
      where: {
        userId: params.userId,
      },
      create: {
        userId: params.userId,
        snapshotJson: toJson(params.snapshot),
        snapshotAsOf: params.snapshot.asOf,
        lastSuccessfulRefreshAt: params.lastSuccessfulRefreshAt,
        lastRefreshAttemptAt: params.lastRefreshAttemptAt,
        lastRefreshError: params.lastRefreshError,
        lastRefreshSource: params.refreshSource,
        lastAutoRefreshDate: params.lastAutoRefreshDate,
      },
      update: {
        snapshotJson: toJson(params.snapshot),
        snapshotAsOf: params.snapshot.asOf,
        lastSuccessfulRefreshAt: params.lastSuccessfulRefreshAt,
        lastRefreshAttemptAt: params.lastRefreshAttemptAt,
        lastRefreshError: params.lastRefreshError,
        lastRefreshSource: params.refreshSource,
        lastAutoRefreshDate: params.lastAutoRefreshDate,
      },
    });

    return mapRecord(record as MarketContextSnapshotRecord);
  }

  async listUsersPendingAutoRefresh(shanghaiDate: string, limit = 100) {
    const records = await this.prisma.marketContextSnapshot.findMany({
      where: {
        OR: [
          { lastAutoRefreshDate: null },
          { lastAutoRefreshDate: { not: shanghaiDate } },
        ],
      },
      select: {
        userId: true,
      },
      take: limit,
      orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }],
    });

    return records.map((record) => record.userId);
  }
}
