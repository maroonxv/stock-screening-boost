import type { Prisma, PrismaClient } from "~/generated/prisma";
import type {
  TimingRecommendationDraft,
  TimingRecommendationReasoning,
  TimingRecommendationRecord,
  TimingRiskFlag,
} from "~/server/domain/timing/types";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

function mapRecord(record: {
  id: string;
  userId: string;
  workflowRunId: string | null;
  portfolioSnapshotId: string;
  watchListId: string;
  presetId: string | null;
  stockCode: string;
  stockName: string;
  action: string;
  priority: number;
  confidence: number;
  suggestedMinPct: number;
  suggestedMaxPct: number;
  riskBudgetPct: number;
  marketRegime: string;
  riskFlags: string[];
  reasoning: unknown;
  createdAt: Date;
  updatedAt: Date;
}): TimingRecommendationRecord {
  return {
    id: record.id,
    userId: record.userId,
    workflowRunId: record.workflowRunId,
    portfolioSnapshotId: record.portfolioSnapshotId,
    watchListId: record.watchListId,
    presetId: record.presetId,
    stockCode: record.stockCode,
    stockName: record.stockName,
    action: record.action as TimingRecommendationRecord["action"],
    priority: record.priority,
    confidence: record.confidence,
    suggestedMinPct: record.suggestedMinPct,
    suggestedMaxPct: record.suggestedMaxPct,
    riskBudgetPct: record.riskBudgetPct,
    marketRegime:
      record.marketRegime as TimingRecommendationRecord["marketRegime"],
    riskFlags: record.riskFlags as TimingRiskFlag[],
    reasoning: record.reasoning as TimingRecommendationReasoning,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export class PrismaTimingRecommendationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(params: { items: TimingRecommendationDraft[] }) {
    const records = await this.prisma.$transaction(
      params.items.map((item) =>
        this.prisma.timingRecommendation.create({
          data: {
            userId: item.userId,
            workflowRunId: item.workflowRunId,
            portfolioSnapshotId: item.portfolioSnapshotId,
            watchListId: item.watchListId,
            presetId: item.presetId,
            stockCode: item.stockCode,
            stockName: item.stockName,
            action: item.action,
            priority: item.priority,
            confidence: item.confidence,
            suggestedMinPct: item.suggestedMinPct,
            suggestedMaxPct: item.suggestedMaxPct,
            riskBudgetPct: item.riskBudgetPct,
            marketRegime: item.marketRegime,
            riskFlags: item.riskFlags,
            reasoning: toJson(item.reasoning),
          },
        }),
      ),
    );

    return records.map((record) => mapRecord(record));
  }

  async listForUser(params: {
    userId: string;
    limit: number;
    watchListId?: string;
    portfolioSnapshotId?: string;
    workflowRunId?: string;
  }) {
    const records = await this.prisma.timingRecommendation.findMany({
      where: {
        userId: params.userId,
        watchListId: params.watchListId,
        portfolioSnapshotId: params.portfolioSnapshotId,
        workflowRunId: params.workflowRunId,
      },
      take: params.limit,
      orderBy: [{ createdAt: "desc" }, { priority: "asc" }],
    });

    return records.map((record) => mapRecord(record));
  }
}
