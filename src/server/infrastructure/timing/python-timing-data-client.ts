import { env } from "~/env";
import type {
  MarketRegimeSnapshot,
  TimingBarsData,
  TimingSignalBatchData,
  TimingSignalData,
} from "~/server/domain/timing/types";
import {
  WORKFLOW_ERROR_CODES,
  WorkflowDomainError,
} from "~/server/domain/workflow/errors";

type GatewayResponse<T> = {
  data: T;
};

type GatewayErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type PythonTimingDataClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
};

export class PythonTimingDataClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: PythonTimingDataClientConfig) {
    this.baseUrl = (config?.baseUrl ?? env.PYTHON_SERVICE_URL).replace(
      /\/$/,
      "",
    );
    this.timeoutMs = config?.timeoutMs ?? 10_000;
  }

  async getBars(params: {
    stockCode: string;
    start?: string;
    end?: string;
    timeframe?: "DAILY";
    adjust?: string;
  }) {
    const search = new URLSearchParams();
    if (params.start) {
      search.set("start", params.start);
    }
    if (params.end) {
      search.set("end", params.end);
    }
    search.set("timeframe", params.timeframe ?? "DAILY");
    search.set("adjust", params.adjust ?? "qfq");

    return this.request<TimingBarsData>(
      `/api/v1/timing/stocks/${params.stockCode}/bars?${search.toString()}`,
    );
  }

  async getSignal(params: {
    stockCode: string;
    asOfDate?: string;
    lookbackDays?: number;
  }) {
    const search = new URLSearchParams();
    if (params.asOfDate) {
      search.set("asOfDate", params.asOfDate);
    }
    if (params.lookbackDays) {
      search.set("lookbackDays", String(params.lookbackDays));
    }

    const query = search.toString();
    return this.request<TimingSignalData>(
      `/api/v1/timing/stocks/${params.stockCode}/signals${query ? `?${query}` : ""}`,
    );
  }

  async getSignalsBatch(params: {
    stockCodes: string[];
    asOfDate?: string;
    lookbackDays?: number;
  }) {
    return this.request<TimingSignalBatchData>(
      "/api/v1/timing/stocks/signals/batch",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  }

  async getMarketRegimeSnapshot(params?: { asOfDate?: string }) {
    const search = new URLSearchParams();
    if (params?.asOfDate) {
      search.set("asOfDate", params.asOfDate);
    }

    const query = search.toString();
    return this.request<MarketRegimeSnapshot>(
      `/api/v1/timing/market/regime-snapshot${query ? `?${query}` : ""}`,
    );
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "未知错误");
        let errorMessage = errorText;

        try {
          const payload = JSON.parse(errorText) as GatewayErrorResponse;
          errorMessage = payload.error?.message ?? errorText;
        } catch {
          errorMessage = errorText;
        }

        throw new WorkflowDomainError(
          WORKFLOW_ERROR_CODES.TIMING_DATA_UNAVAILABLE,
          `Timing 数据服务异常(${response.status}): ${errorMessage}`,
        );
      }

      const payload = (await response.json()) as GatewayResponse<T>;
      return payload.data;
    } catch (error) {
      if (error instanceof WorkflowDomainError) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        throw new WorkflowDomainError(
          WORKFLOW_ERROR_CODES.TIMING_DATA_UNAVAILABLE,
          `Timing 数据服务请求超时 (${this.timeoutMs}ms)`,
        );
      }

      throw new WorkflowDomainError(
        WORKFLOW_ERROR_CODES.TIMING_DATA_UNAVAILABLE,
        `Timing 数据服务请求失败: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
