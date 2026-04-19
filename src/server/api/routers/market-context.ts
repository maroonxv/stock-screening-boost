import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { MarketContextService } from "~/server/application/intelligence/market-context-service";
import { PrismaMarketContextSnapshotRepository } from "~/server/infrastructure/intelligence/prisma-market-context-snapshot-repository";
import { PythonMarketContextClient } from "~/server/infrastructure/intelligence/python-market-context-client";

export const marketContextRouter = createTRPCRouter({
  getSnapshot: protectedProcedure.query(async ({ ctx }) => {
    const service = new MarketContextService({
      repository: new PrismaMarketContextSnapshotRepository(ctx.db),
      client: new PythonMarketContextClient(),
    });

    return service.getSnapshotForUser(ctx.session.user.id);
  }),
  refreshSnapshot: protectedProcedure.mutation(async ({ ctx }) => {
    const service = new MarketContextService({
      repository: new PrismaMarketContextSnapshotRepository(ctx.db),
      client: new PythonMarketContextClient(),
    });

    return service.refreshSnapshotForUser(ctx.session.user.id);
  }),
});
