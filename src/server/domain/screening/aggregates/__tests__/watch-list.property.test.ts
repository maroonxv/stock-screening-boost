/**
 * WatchList 聚合根属性基测试
 *
 * Feature: stock-screening-platform
 * Property 10: WatchList 添加/移除/包含一致性
 *
 * **Validates: Requirements 5.2, 5.3, 5.4**
 */

import { describe, it } from "vitest";
import * as fc from "fast-check";
import { WatchList } from "../watch-list.js";
import { StockCode } from "../../value-objects/stock-code.js";
import { DuplicateStockError } from "../../errors.js";
import { arbStockCode } from "../../__tests__/generators.js";

/**
 * 定义操作类型
 */
type WatchListOperation =
  | { type: "add"; code: string; name: string }
  | { type: "remove"; code: string };

/**
 * 生成随机操作序列
 */
const arbOperationSequence = fc.array(
  fc.oneof(
    fc.record({
      type: fc.constant("add" as const),
      code: arbStockCode,
      name: fc.string({ minLength: 2, maxLength: 10 }),
    }),
    fc.record({
      type: fc.constant("remove" as const),
      code: arbStockCode,
    })
  ),
  { minLength: 1, maxLength: 20 }
);

describe("WatchList Property-Based Tests", () => {
  describe("Property 10: WatchList 添加/移除/包含一致性", () => {
    it("添加后 contains 应返回 true", () => {
      fc.assert(
        fc.property(arbStockCode, fc.string({ minLength: 2, maxLength: 10 }), (code, name) => {
          const watchList = WatchList.create({
            name: "测试列表",
            userId: "user-1",
          });

          const stockCode = StockCode.create(code);
          watchList.addStock(stockCode, name);

          // 验证：添加后 contains 返回 true
          return watchList.contains(stockCode);
        }),
        { numRuns: 100 }
      );
    });

    it("移除后 contains 应返回 false", () => {
      fc.assert(
        fc.property(arbStockCode, fc.string({ minLength: 2, maxLength: 10 }), (code, name) => {
          const watchList = WatchList.create({
            name: "测试列表",
            userId: "user-1",
          });

          const stockCode = StockCode.create(code);
          watchList.addStock(stockCode, name);
          watchList.removeStock(stockCode);

          // 验证：移除后 contains 返回 false
          return !watchList.contains(stockCode);
        }),
        { numRuns: 100 }
      );
    });

    it("重复添加相同股票应抛出 DuplicateStockError", () => {
      fc.assert(
        fc.property(arbStockCode, fc.string({ minLength: 2, maxLength: 10 }), (code, name) => {
          const watchList = WatchList.create({
            name: "测试列表",
            userId: "user-1",
          });

          const stockCode = StockCode.create(code);
          watchList.addStock(stockCode, name);

          // 验证：重复添加抛出 DuplicateStockError
          try {
            watchList.addStock(stockCode, name);
            return false; // 如果没有抛出异常，测试失败
          } catch (error) {
            return error instanceof DuplicateStockError;
          }
        }),
        { numRuns: 100 }
      );
    });

    it("随机操作序列应保持一致性", () => {
      fc.assert(
        fc.property(arbOperationSequence, (operations) => {
          const watchList = WatchList.create({
            name: "测试列表",
            userId: "user-1",
          });

          // 跟踪预期状态
          const expectedStocks = new Set<string>();

          for (const op of operations) {
            const stockCode = StockCode.create(op.code);

            if (op.type === "add") {
              const isAlreadyPresent = expectedStocks.has(op.code);

              if (isAlreadyPresent) {
                // 如果已存在，添加应抛出异常
                try {
                  watchList.addStock(stockCode, op.name);
                  return false; // 应该抛出异常但没有
                } catch (error) {
                  if (!(error instanceof DuplicateStockError)) {
                    return false; // 抛出了错误的异常类型
                  }
                }
              } else {
                // 如果不存在，添加应成功
                watchList.addStock(stockCode, op.name);
                expectedStocks.add(op.code);

                // 验证添加后 contains 返回 true
                if (!watchList.contains(stockCode)) {
                  return false;
                }
              }
            } else if (op.type === "remove") {
              const isPresent = expectedStocks.has(op.code);

              if (isPresent) {
                // 如果存在，移除应成功
                watchList.removeStock(stockCode);
                expectedStocks.delete(op.code);

                // 验证移除后 contains 返回 false
                if (watchList.contains(stockCode)) {
                  return false;
                }
              } else {
                // 如果不存在，移除应抛出异常（但我们跳过这个操作以简化测试）
                // 这里我们不执行移除操作，因为会抛出 StockNotFoundError
                continue;
              }
            }
          }

          // 最终验证：WatchList 的状态应与预期一致
          for (const code of expectedStocks) {
            if (!watchList.contains(StockCode.create(code))) {
              return false;
            }
          }

          // 验证 stocks 数量与预期一致
          return watchList.stocks.length === expectedStocks.size;
        }),
        { numRuns: 100 }
      );
    });

    it("添加-移除-再添加序列应保持一致性", () => {
      fc.assert(
        fc.property(arbStockCode, fc.string({ minLength: 2, maxLength: 10 }), (code, name) => {
          const watchList = WatchList.create({
            name: "测试列表",
            userId: "user-1",
          });

          const stockCode = StockCode.create(code);

          // 第一次添加
          watchList.addStock(stockCode, name);
          if (!watchList.contains(stockCode)) {
            return false;
          }

          // 移除
          watchList.removeStock(stockCode);
          if (watchList.contains(stockCode)) {
            return false;
          }

          // 再次添加（应该成功，因为已经移除了）
          watchList.addStock(stockCode, name);
          return watchList.contains(stockCode);
        }),
        { numRuns: 100 }
      );
    });

    it("多个不同股票的添加和移除应独立", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(arbStockCode, fc.string({ minLength: 2, maxLength: 10 })),
            { minLength: 2, maxLength: 10 }
          ),
          (stockPairs) => {
            // 去重：确保所有股票代码不同
            const uniqueStocks = Array.from(
              new Map(stockPairs.map(([code, name]) => [code, name])).entries()
            );

            if (uniqueStocks.length < 2) {
              return true; // 跳过重复的情况
            }

            const watchList = WatchList.create({
              name: "测试列表",
              userId: "user-1",
            });

            // 添加所有股票
            for (const [code, name] of uniqueStocks) {
              watchList.addStock(StockCode.create(code), name);
            }

            // 验证所有股票都存在
            for (const [code] of uniqueStocks) {
              if (!watchList.contains(StockCode.create(code))) {
                return false;
              }
            }

            // 移除第一个股票
            const [firstCode] = uniqueStocks[0]!;
            watchList.removeStock(StockCode.create(firstCode));

            // 验证第一个股票不存在
            if (watchList.contains(StockCode.create(firstCode))) {
              return false;
            }

            // 验证其他股票仍然存在
            for (let i = 1; i < uniqueStocks.length; i++) {
              const [code] = uniqueStocks[i]!;
              if (!watchList.contains(StockCode.create(code))) {
                return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
