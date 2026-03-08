import { performance } from "node:perf_hooks";
import { env } from "~/env";
import { ScreeningSession } from "~/server/domain/screening/aggregates/screening-session";
import { NoCandidateStocksError } from "~/server/domain/screening/errors";
import type { IScreeningSessionRepository } from "~/server/domain/screening/repositories/screening-session-repository";
import type { IScreeningStrategyRepository } from "~/server/domain/screening/repositories/screening-strategy-repository";
import { IndicatorCalculationService } from "~/server/domain/screening/services/indicator-calculation-service";
import { ScoringService } from "~/server/domain/screening/services/scoring-service";
import { ScreeningResult } from "~/server/domain/screening/value-objects/screening-result";
import { PythonDataServiceClient } from "~/server/infrastructure/screening/python-data-service-client";

function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export type ScreeningExecutionServiceDependencies = {
  sessionRepository: IScreeningSessionRepository;
  strategyRepository: IScreeningStrategyRepository;
};

export class ScreeningExecutionService {
  private readonly sessionRepository: IScreeningSessionRepository;
  private readonly strategyRepository: IScreeningStrategyRepository;
  private readonly dataClient: PythonDataServiceClient;
  private readonly calcService: IndicatorCalculationService;
  private readonly scoringService: ScoringService;
  private readonly chunkSize = 120;

  constructor(dependencies: ScreeningExecutionServiceDependencies) {
    this.sessionRepository = dependencies.sessionRepository;
    this.strategyRepository = dependencies.strategyRepository;
    this.dataClient = new PythonDataServiceClient({
      baseUrl: env.PYTHON_SERVICE_URL,
    });
    this.calcService = new IndicatorCalculationService(this.dataClient);
    this.scoringService = new ScoringService();
  }

  async enqueueStrategyExecution(params: {
    strategyId: string;
    userId: string;
  }): Promise<ScreeningSession> {
    const strategy = await this.strategyRepository.findById(params.strategyId);
    if (!strategy) {
      throw new Error("策略不存在");
    }

    const session = ScreeningSession.createPending({
      strategyId: strategy.id,
      strategyName: strategy.name,
      userId: params.userId,
      filtersSnapshot: strategy.filters,
      scoringConfigSnapshot: strategy.scoringConfig,
    });

    await this.sessionRepository.save(session);
    return session;
  }

  async enqueueRetry(
    sessionId: string,
    userId: string,
  ): Promise<ScreeningSession> {
    const existing = await this.sessionRepository.findById(sessionId);
    if (!existing) {
      throw new Error("会话不存在");
    }

    if (existing.userId !== userId) {
      throw new Error("无权限重试此会话");
    }

    const retrySession = ScreeningSession.createPending({
      strategyId: existing.strategyId,
      strategyName: existing.strategyName,
      userId,
      filtersSnapshot: existing.filtersSnapshot,
      scoringConfigSnapshot: existing.scoringConfigSnapshot,
    });

    await this.sessionRepository.save(retrySession);
    return retrySession;
  }

  async requestCancellation(
    sessionId: string,
    userId: string,
  ): Promise<ScreeningSession> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error("会话不存在");
    }

    if (session.userId !== userId) {
      throw new Error("无权限取消此会话");
    }

    session.requestCancellation();
    await this.sessionRepository.save(session);
    return session;
  }

  async executeRecoverableRunningSession(): Promise<boolean> {
    const runningSessions =
      await this.sessionRepository.findRunningSessions(10);

    for (const session of runningSessions) {
      await this.executeSession(session);
      return true;
    }

    return false;
  }

  async executeNextPendingSession(): Promise<boolean> {
    const session = await this.sessionRepository.claimNextPendingSession();
    if (!session) {
      return false;
    }

    await this.executeSession(session);
    return true;
  }

  private async executeSession(session: ScreeningSession): Promise<void> {
    const startedAt = performance.now();

    try {
      session.markRunning("拉取候选股票列表");
      await this.sessionRepository.save(session);

      const stockCodes = await this.dataClient.getAllStockCodes();
      if (stockCodes.length === 0) {
        throw new NoCandidateStocksError();
      }

      session.updateProgress(8, `候选池就绪，共 ${stockCodes.length} 支股票`);
      await this.sessionRepository.save(session);

      const chunks = chunkArray(stockCodes, this.chunkSize);
      const matchedStocks = [];
      let scannedCount = 0;

      for (const [index, chunk] of chunks.entries()) {
        const latest = await this.sessionRepository.findById(session.id);
        if (!latest) {
          return;
        }

        if (latest.isCancellationRequested()) {
          latest.cancel("用户已取消任务");
          await this.sessionRepository.save(latest);
          return;
        }

        const stocks = await this.dataClient.getStocksByCodes(chunk);
        for (const stock of stocks) {
          if (
            await latest.filtersSnapshot.matchAsync(stock, this.calcService)
          ) {
            matchedStocks.push(stock);
          }
        }

        scannedCount += stocks.length;
        const screeningProgress = 8 + ((index + 1) / chunks.length) * 64;
        latest.updateProgress(
          screeningProgress,
          `筛选中：已扫描 ${scannedCount} / ${stockCodes.length} 支股票`,
        );
        await this.sessionRepository.save(latest);
      }

      const beforeScore = await this.sessionRepository.findById(session.id);
      if (!beforeScore) {
        return;
      }

      if (beforeScore.isCancellationRequested()) {
        beforeScore.cancel("用户已取消任务");
        await this.sessionRepository.save(beforeScore);
        return;
      }

      beforeScore.updateProgress(
        78,
        matchedStocks.length === 0
          ? "没有股票命中过滤条件，正在整理空结果"
          : `过滤完成，开始为 ${matchedStocks.length} 支股票评分`,
      );
      await this.sessionRepository.save(beforeScore);

      const scoredStocks = await this.scoringService.scoreStocks(
        matchedStocks,
        beforeScore.scoringConfigSnapshot,
        this.calcService,
      );

      const result = ScreeningResult.create(
        scoredStocks,
        scannedCount,
        performance.now() - startedAt,
      );

      beforeScore.updateProgress(96, "生成结果快照");
      beforeScore.complete(result);
      await this.sessionRepository.save(beforeScore);
    } catch (error) {
      const latest = await this.sessionRepository.findById(session.id);
      if (!latest) {
        return;
      }

      latest.fail(error instanceof Error ? error.message : "未知错误");
      await this.sessionRepository.save(latest);
    }
  }
}
