import { randomUUID } from "node:crypto";
import { env } from "~/env";
import { MarketContextAutoRefreshService } from "~/server/application/intelligence/market-context-auto-refresh-service";
import { db } from "~/server/db";
import { PythonMarketContextClient } from "~/server/infrastructure/intelligence/python-market-context-client";
import { PrismaMarketContextSnapshotRepository } from "~/server/infrastructure/intelligence/prisma-market-context-snapshot-repository";

const service = new MarketContextAutoRefreshService({
  repository: new PrismaMarketContextSnapshotRepository(db),
  client: new PythonMarketContextClient(),
});

const workerId =
  process.env.MARKET_CONTEXT_WORKER_ID ??
  `market-context-worker-${randomUUID()}`;
const pollIntervalMs = env.MARKET_CONTEXT_WORKER_POLL_INTERVAL_MS;

let shuttingDown = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info(`[market-context-worker] receive ${signal}, shutting down...`);

  await db.$disconnect();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

async function main() {
  console.info(`[market-context-worker] started: ${workerId}`);

  while (!shuttingDown) {
    try {
      const summary = await service.refreshPendingUsers(new Date());
      if (
        summary.candidateUserIds.length > 0 ||
        summary.failedUserIds.length > 0
      ) {
        console.info(
          `[market-context-worker] date=${summary.shanghaiDate} candidates=${summary.candidateUserIds.length} refreshed=${summary.refreshedUserIds.length} failed=${summary.failedUserIds.length}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(`[market-context-worker] loop error: ${message}`);
    }

    await sleep(pollIntervalMs);
  }
}

void main();
