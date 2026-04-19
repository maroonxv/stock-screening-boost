import type {
  MarketContextEnvelope,
  MarketContextRefreshSource,
  MarketContextSnapshot,
} from "~/contracts/market-context";
import {
  getShanghaiClock,
  hasReachedMarketContextAutoRefreshCutoff,
} from "~/server/application/intelligence/market-context-refresh-schedule";
import type {
  PrismaMarketContextSnapshotRepository,
  UpsertMarketContextSnapshotParams,
} from "~/server/infrastructure/intelligence/prisma-market-context-snapshot-repository";
import type { GetPythonMarketContextSnapshotOptions } from "~/server/infrastructure/intelligence/python-market-context-client";

type MarketContextRepository = Pick<
  PrismaMarketContextSnapshotRepository,
  "getByUserId" | "upsert"
>;

type MarketContextClient = {
  getSnapshot(
    options?: GetPythonMarketContextSnapshotOptions,
  ): Promise<MarketContextSnapshot>;
};

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toDateOrNull(value: string | null) {
  return value ? new Date(value) : null;
}

export class MarketContextService {
  constructor(
    private readonly deps: {
      repository: MarketContextRepository;
      client: MarketContextClient;
    },
  ) {}

  async getSnapshotForUser(userId: string, now = new Date()) {
    const existing = await this.deps.repository.getByUserId(userId);

    if (!existing) {
      return this.persistFreshSnapshot({
        userId,
        refreshSource: "INITIAL",
        forceRefresh: false,
        existing: null,
        now,
      });
    }

    if (
      !hasReachedMarketContextAutoRefreshCutoff(now) ||
      existing.refreshState.lastAutoRefreshDate === getShanghaiClock(now).date
    ) {
      return existing;
    }

    return this.persistFreshSnapshot({
      userId,
      refreshSource: "AUTO",
      forceRefresh: true,
      existing,
      now,
    });
  }

  async refreshSnapshotForUser(userId: string, now = new Date()) {
    const existing = await this.deps.repository.getByUserId(userId);

    return this.persistFreshSnapshot({
      userId,
      refreshSource: "MANUAL",
      forceRefresh: true,
      existing,
      now,
    });
  }

  private async persistFreshSnapshot(params: {
    userId: string;
    refreshSource: MarketContextRefreshSource;
    forceRefresh: boolean;
    existing: MarketContextEnvelope | null;
    now: Date;
  }) {
    const { userId, refreshSource, forceRefresh, existing, now } = params;
    const clock = getShanghaiClock(now);
    const nextAutoRefreshDate = hasReachedMarketContextAutoRefreshCutoff(now)
      ? clock.date
      : (existing?.refreshState.lastAutoRefreshDate ?? null);

    try {
      const snapshot = await this.deps.client.getSnapshot({ forceRefresh });

      return this.deps.repository.upsert({
        userId,
        snapshot,
        refreshSource,
        lastSuccessfulRefreshAt: now,
        lastRefreshAttemptAt: now,
        lastRefreshError: null,
        lastAutoRefreshDate: nextAutoRefreshDate,
      });
    } catch (error) {
      if (!existing) {
        throw error;
      }

      return this.deps.repository.upsert({
        userId,
        snapshot: existing.snapshot,
        refreshSource: existing.refreshState.source,
        lastSuccessfulRefreshAt: toDateOrNull(
          existing.refreshState.lastSuccessfulRefreshAt,
        ),
        lastRefreshAttemptAt: now,
        lastRefreshError: toErrorMessage(error),
        lastAutoRefreshDate: existing.refreshState.lastAutoRefreshDate,
      } satisfies UpsertMarketContextSnapshotParams);
    }
  }
}
