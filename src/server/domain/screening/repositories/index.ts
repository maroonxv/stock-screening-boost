/**
 * Repository 接口统一导出
 *
 * 提供领域层所有仓储接口的统一入口。
 * 遵循依赖倒置原则：领域层定义接口，基础设施层提供实现。
 */

export type { IScreeningStrategyRepository } from "./screening-strategy-repository";
export type { IScreeningSessionRepository } from "./screening-session-repository";
export type { IWatchListRepository } from "./watch-list-repository";
export type { IMarketDataRepository } from "./market-data-repository";
export type {
  IHistoricalDataProvider,
  IndicatorDataPoint,
} from "./historical-data-provider";
