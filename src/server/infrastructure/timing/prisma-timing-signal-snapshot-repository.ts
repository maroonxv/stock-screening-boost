import type { Prisma, PrismaClient } from "~/generated/prisma";
import type {
  TimingRuleSummary,
  TimingSignalData,
  TimingSignalSnapshotRecord,
  TimingSourceType,
} from "~/server/domain/timing/types";

const toJson = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

function toDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function mapRecord(record: {
  id: string;
  userId: string;
  workflowRunId: string | null;
  stockCode: string;
  stockName: string;
  asOfDate: Date;
  sourceType: string;
  sourceId: string;
  timeframe: string;
  barsCount: number;
  indicators: unknown;
  signalSummary: unknown;
  createdAt: Date;
}): TimingSignalSnapshotRecord {
  return {
    id: record.id,
    userId: record.userId,
    workflowRunId: record.workflowRunId,
    stockCode: record.stockCode,
    stockName: record.stockName,
    asOfDate: record.asOfDate.toISOString().slice(0, 10),
    sourceType: record.sourceType as TimingSourceType,
    sourceId: record.sourceId,
    timeframe: record.timeframe as "DAILY",
    barsCount: record.barsCount,
    indicators: record.indicators as TimingSignalData["indicators"],
    signalSummary: record.signalSummary as TimingRuleSummary,
    createdAt: record.createdAt,
  };
}

export class PrismaTimingSignalSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createMany(params: {
    userId: string;
    workflowRunId?: string;
    sourceType: TimingSourceType;
    sourceId: string;
    items: TimingSignalData[];
  }) {
    const records = await this.prisma.$transaction(
      params.items.map((item) =>
        this.prisma.timingSignalSnapshot.create({
          data: {
            userId: params.userId,
            workflowRunId: params.workflowRunId,
            stockCode: item.stockCode,
            stockName: item.stockName,
            asOfDate: toDateOnly(item.asOfDate),
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            timeframe: "DAILY",
            barsCount: item.barsCount,
            indicators: toJson(item.indicators),
            signalSummary: toJson(item.ruleSummary),
          },
        }),
      ),
    );

    return records.map((record) => mapRecord(record));
  }
}
