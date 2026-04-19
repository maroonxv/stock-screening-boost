import type { MarketContextSnapshot } from "~/contracts/market-context";
import {
  getShanghaiClock,
  hasReachedMarketContextAutoRefreshCutoff,
} from "~/server/application/intelligence/market-context-refresh-schedule";
import type { PrismaMarketContextSnapshotRepository } from "~/server/infrastructure/intelligence/prisma-market-context-snapshot-repository";
import type { GetPythonMarketContextSnapshotOptions } from "~/server/infrastructure/intelligence/python-market-context-client";

type MarketContextAutoRefreshRepository = Pick<
  PrismaMarketContextSnapshotRepository,
  "listUsersPendingAutoRefresh" | "upsert"
>;

type MarketContextClient = {
  getSnapshot(
    options?: GetPythonMarketContextSnapshotOptions,
  ): Promise<MarketContextSnapshot>;
};

export class MarketContextAutoRefreshService {
  constructor(
    private readonly deps: {
      repository: MarketContextAutoRefreshRepository;
      client: MarketContextClient;
    },
  ) {}

  async refreshPendingUsers(now = new Date(), limit = 100) {
    const clock = getShanghaiClock(now);

    if (!hasReachedMarketContextAutoRefreshCutoff(now)) {
      return {
        ran: false,
        shanghaiDate: clock.date,
        candidateUserIds: [] as string[],
        refreshedUserIds: [] as string[],
        failedUserIds: [] as string[],
      };
    }

    const candidateUserIds =
      await this.deps.repository.listUsersPendingAutoRefresh(clock.date, limit);
    if (candidateUserIds.length === 0) {
      return {
        ran: true,
        shanghaiDate: clock.date,
        candidateUserIds,
        refreshedUserIds: [] as string[],
        failedUserIds: [] as string[],
      };
    }

    let snapshot: MarketContextSnapshot;
    try {
      snapshot = await this.deps.client.getSnapshot({ forceRefresh: true });
    } catch {
      return {
        ran: true,
        shanghaiDate: clock.date,
        candidateUserIds,
        refreshedUserIds: [] as string[],
        failedUserIds: candidateUserIds,
      };
    }

    const writes = await Promise.allSettled(
      candidateUserIds.map(async (userId) => {
        await this.deps.repository.upsert({
          userId,
          snapshot,
          refreshSource: "AUTO",
          lastSuccessfulRefreshAt: now,
          lastRefreshAttemptAt: now,
          lastRefreshError: null,
          lastAutoRefreshDate: clock.date,
        });

        return userId;
      }),
    );

    const refreshedUserIds = writes.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    const failedUserIds = writes.flatMap((result, index) =>
      result.status === "rejected" ? [candidateUserIds[index] ?? ""] : [],
    );

    return {
      ran: true,
      shanghaiDate: clock.date,
      candidateUserIds,
      refreshedUserIds,
      failedUserIds,
    };
  }
}
