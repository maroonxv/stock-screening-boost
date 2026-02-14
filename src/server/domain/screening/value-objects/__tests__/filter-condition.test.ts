/**
 * FilterCondition 值对象单元测试
 *
 * 测试覆盖：
 * - 构造时的类型验证
 * - 构造时的运算符兼容性验证
 * - evaluate 方法的各种场景
 * - null 值处理
 * - 序列化/反序列化
 */

import { describe, it, expect } from "vitest";
import { FilterCondition } from "../filter-condition";
import { IndicatorField } from "../../enums/indicator-field";
import { ComparisonOperator } from "../../enums/comparison-operator";
import { Stock } from "../../entities/stock";
import { StockCode } from "../stock-code";
import { InvalidFilterConditionError } from "../../errors";
import type { IIndicatorCalculationService } from "../filter-condition";

// Mock 指标计算服务
class MockIndicatorCalculationService implements IIndicatorCalculationService {
  private mockValues: Map<string, number | string | null> = new Map();

  setMockValue(
    indicator: IndicatorField,
    stockCode: string,
    value: number | string | null
  ): void {
    this.mockValues.set(`${indicator}-${stockCode}`, value);
  }

  calculateIndicator(
    indicator: IndicatorField,
    stock: Stock
  ): number | string | null {
    const key = `${indicator}-${stock.code.value}`;
    return this.mockValues.get(key) ?? stock.getValue(indicator);
  }
}

describe("FilterCondition", () => {
  describe("构造验证", () => {
    describe("类型匹配验证 (Requirements: 2.2)", () => {
      it("应接受数值型指标 + numeric 值", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.ROE, ComparisonOperator.GREATER_THAN, {
            type: "numeric",
            value: 0.15,
          })
        ).not.toThrow();
      });

      it("应接受数值型指标 + range 值", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.PE, ComparisonOperator.BETWEEN, {
            type: "range",
            min: 10,
            max: 30,
          })
        ).not.toThrow();
      });

      it("应接受数值型指标 + timeSeries 值", () => {
        expect(() =>
          FilterCondition.create(
            IndicatorField.REVENUE_CAGR_3Y,
            ComparisonOperator.GREATER_THAN,
            {
              type: "timeSeries",
              years: 3,
            }
          )
        ).not.toThrow();
      });

      it("应接受文本型指标 + text 值", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.EQUAL, {
            type: "text",
            value: "白酒",
          })
        ).not.toThrow();
      });

      it("应接受文本型指标 + list 值", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.IN, {
            type: "list",
            values: ["白酒", "医药"],
          })
        ).not.toThrow();
      });

      it("应拒绝数值型指标 + text 值", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.ROE, ComparisonOperator.EQUAL, {
            type: "text",
            value: "高",
          })
        ).toThrow(InvalidFilterConditionError);
      });

      it("应拒绝文本型指标 + numeric 值", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.EQUAL, {
            type: "numeric",
            value: 100,
          })
        ).toThrow(InvalidFilterConditionError);
      });
    });

    describe("运算符兼容性验证 (Requirements: 2.3)", () => {
      it("GREATER_THAN 应仅适用于 numeric", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.ROE, ComparisonOperator.GREATER_THAN, {
            type: "numeric",
            value: 0.15,
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.GREATER_THAN, {
            type: "text",
            value: "白酒",
          })
        ).toThrow(InvalidFilterConditionError);
      });

      it("LESS_THAN 应仅适用于 numeric", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.PE, ComparisonOperator.LESS_THAN, {
            type: "numeric",
            value: 30,
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.LESS_THAN, {
            type: "list",
            values: ["白酒"],
          })
        ).toThrow(InvalidFilterConditionError);
      });

      it("EQUAL 应适用于 numeric 和 text", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.ROE, ComparisonOperator.EQUAL, {
            type: "numeric",
            value: 0.15,
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.EQUAL, {
            type: "text",
            value: "白酒",
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.EQUAL, {
            type: "list",
            values: ["白酒"],
          })
        ).toThrow(InvalidFilterConditionError);
      });

      it("IN/NOT_IN 应仅适用于 list", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.IN, {
            type: "list",
            values: ["白酒", "医药"],
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.IN, {
            type: "text",
            value: "白酒",
          })
        ).toThrow(InvalidFilterConditionError);
      });

      it("BETWEEN 应仅适用于 range", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.PE, ComparisonOperator.BETWEEN, {
            type: "range",
            min: 10,
            max: 30,
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.PE, ComparisonOperator.BETWEEN, {
            type: "numeric",
            value: 20,
          })
        ).toThrow(InvalidFilterConditionError);
      });

      it("CONTAINS 应仅适用于 text", () => {
        expect(() =>
          FilterCondition.create(IndicatorField.INDUSTRY, ComparisonOperator.CONTAINS, {
            type: "text",
            value: "酒",
          })
        ).not.toThrow();

        expect(() =>
          FilterCondition.create(IndicatorField.ROE, ComparisonOperator.CONTAINS, {
            type: "numeric",
            value: 0.15,
          })
        ).toThrow(InvalidFilterConditionError);
      });
    });
  });

  describe("evaluate 方法", () => {
    const calcService = new MockIndicatorCalculationService();

    const createTestStock = (code: string, roe?: number, industry?: string): Stock => {
      return new Stock({
        code: StockCode.create(code),
        name: "测试股票",
        industry: industry ?? "未知",
        sector: "主板",
        roe: roe ?? null,
      });
    };

    describe("null 值处理 (Requirements: 3.3)", () => {
      it("当指标值为 null 时应返回 false", () => {
        const condition = FilterCondition.create(
          IndicatorField.ROE,
          ComparisonOperator.GREATER_THAN,
          { type: "numeric", value: 0.15 }
        );

        const stock = createTestStock("600519", undefined); // ROE 为 null
        expect(condition.evaluate(stock, calcService)).toBe(false);
      });

      it("当计算服务返回 null 时应返回 false", () => {
        const condition = FilterCondition.create(
          IndicatorField.REVENUE_CAGR_3Y,
          ComparisonOperator.GREATER_THAN,
          { type: "numeric", value: 0.1 }
        );

        const stock = createTestStock("600519", 0.28);
        calcService.setMockValue(IndicatorField.REVENUE_CAGR_3Y, "600519", null);

        expect(condition.evaluate(stock, calcService)).toBe(false);
      });
    });

    describe("数值比较", () => {
      it("GREATER_THAN: 应正确比较大于", () => {
        const condition = FilterCondition.create(
          IndicatorField.ROE,
          ComparisonOperator.GREATER_THAN,
          { type: "numeric", value: 0.15 }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28), calcService)).toBe(true);
        expect(condition.evaluate(createTestStock("600519", 0.15), calcService)).toBe(false);
        expect(condition.evaluate(createTestStock("600519", 0.10), calcService)).toBe(false);
      });

      it("LESS_THAN: 应正确比较小于", () => {
        const condition = FilterCondition.create(
          IndicatorField.PE,
          ComparisonOperator.LESS_THAN,
          { type: "numeric", value: 30 }
        );

        const stock1 = new Stock({
          code: StockCode.create("600519"),
          name: "测试",
          industry: "白酒",
          sector: "主板",
          pe: 25,
        });

        const stock2 = new Stock({
          code: StockCode.create("600520"),
          name: "测试",
          industry: "白酒",
          sector: "主板",
          pe: 35,
        });

        expect(condition.evaluate(stock1, calcService)).toBe(true);
        expect(condition.evaluate(stock2, calcService)).toBe(false);
      });

      it("EQUAL: 应正确比较相等", () => {
        const condition = FilterCondition.create(
          IndicatorField.ROE,
          ComparisonOperator.EQUAL,
          { type: "numeric", value: 0.28 }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28), calcService)).toBe(true);
        expect(condition.evaluate(createTestStock("600519", 0.27), calcService)).toBe(false);
      });

      it("BETWEEN: 应正确比较区间", () => {
        const condition = FilterCondition.create(
          IndicatorField.PE,
          ComparisonOperator.BETWEEN,
          { type: "range", min: 10, max: 30 }
        );

        const stock1 = new Stock({
          code: StockCode.create("600519"),
          name: "测试",
          industry: "白酒",
          sector: "主板",
          pe: 20,
        });

        const stock2 = new Stock({
          code: StockCode.create("600520"),
          name: "测试",
          industry: "白酒",
          sector: "主板",
          pe: 10,
        });

        const stock3 = new Stock({
          code: StockCode.create("600521"),
          name: "测试",
          industry: "白酒",
          sector: "主板",
          pe: 30,
        });

        const stock4 = new Stock({
          code: StockCode.create("600522"),
          name: "测试",
          industry: "白酒",
          sector: "主板",
          pe: 35,
        });

        expect(condition.evaluate(stock1, calcService)).toBe(true);
        expect(condition.evaluate(stock2, calcService)).toBe(true); // 边界值
        expect(condition.evaluate(stock3, calcService)).toBe(true); // 边界值
        expect(condition.evaluate(stock4, calcService)).toBe(false);
      });
    });

    describe("文本比较", () => {
      it("EQUAL: 应正确比较文本相等", () => {
        const condition = FilterCondition.create(
          IndicatorField.INDUSTRY,
          ComparisonOperator.EQUAL,
          { type: "text", value: "白酒" }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28, "白酒"), calcService)).toBe(
          true
        );
        expect(condition.evaluate(createTestStock("600519", 0.28, "医药"), calcService)).toBe(
          false
        );
      });

      it("NOT_EQUAL: 应正确比较文本不等", () => {
        const condition = FilterCondition.create(
          IndicatorField.INDUSTRY,
          ComparisonOperator.NOT_EQUAL,
          { type: "text", value: "白酒" }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28, "医药"), calcService)).toBe(
          true
        );
        expect(condition.evaluate(createTestStock("600519", 0.28, "白酒"), calcService)).toBe(
          false
        );
      });

      it("IN: 应正确判断包含于列表", () => {
        const condition = FilterCondition.create(
          IndicatorField.INDUSTRY,
          ComparisonOperator.IN,
          { type: "list", values: ["白酒", "医药", "科技"] }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28, "白酒"), calcService)).toBe(
          true
        );
        expect(condition.evaluate(createTestStock("600519", 0.28, "医药"), calcService)).toBe(
          true
        );
        expect(condition.evaluate(createTestStock("600519", 0.28, "银行"), calcService)).toBe(
          false
        );
      });

      it("NOT_IN: 应正确判断不包含于列表", () => {
        const condition = FilterCondition.create(
          IndicatorField.INDUSTRY,
          ComparisonOperator.NOT_IN,
          { type: "list", values: ["白酒", "医药"] }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28, "科技"), calcService)).toBe(
          true
        );
        expect(condition.evaluate(createTestStock("600519", 0.28, "白酒"), calcService)).toBe(
          false
        );
      });

      it("CONTAINS: 应正确判断包含子串", () => {
        const condition = FilterCondition.create(
          IndicatorField.INDUSTRY,
          ComparisonOperator.CONTAINS,
          { type: "text", value: "酒" }
        );

        expect(condition.evaluate(createTestStock("600519", 0.28, "白酒"), calcService)).toBe(
          true
        );
        expect(
          condition.evaluate(createTestStock("600519", 0.28, "啤酒饮料"), calcService)
        ).toBe(true);
        expect(condition.evaluate(createTestStock("600519", 0.28, "医药"), calcService)).toBe(
          false
        );
      });
    });
  });

  describe("序列化 (Requirements: 2.6)", () => {
    it("应正确序列化和反序列化数值条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15, unit: "%" }
      );

      const dict = condition.toDict();
      const restored = FilterCondition.fromDict(dict);

      expect(restored.field).toBe(condition.field);
      expect(restored.operator).toBe(condition.operator);
      expect(restored.equals(condition)).toBe(true);
    });

    it("应正确序列化和反序列化文本条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.INDUSTRY,
        ComparisonOperator.EQUAL,
        { type: "text", value: "白酒" }
      );

      const dict = condition.toDict();
      const restored = FilterCondition.fromDict(dict);

      expect(restored.equals(condition)).toBe(true);
    });

    it("应正确序列化和反序列化列表条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.INDUSTRY,
        ComparisonOperator.IN,
        { type: "list", values: ["白酒", "医药", "科技"] }
      );

      const dict = condition.toDict();
      const restored = FilterCondition.fromDict(dict);

      expect(restored.equals(condition)).toBe(true);
    });

    it("应正确序列化和反序列化范围条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.PE,
        ComparisonOperator.BETWEEN,
        { type: "range", min: 10, max: 30 }
      );

      const dict = condition.toDict();
      const restored = FilterCondition.fromDict(dict);

      expect(restored.equals(condition)).toBe(true);
    });
  });

  describe("equals 方法", () => {
    it("相同内容的条件应相等", () => {
      const condition1 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15 }
      );

      const condition2 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15 }
      );

      expect(condition1.equals(condition2)).toBe(true);
    });

    it("不同字段的条件应不相等", () => {
      const condition1 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15 }
      );

      const condition2 = FilterCondition.create(
        IndicatorField.PE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15 }
      );

      expect(condition1.equals(condition2)).toBe(false);
    });

    it("不同运算符的条件应不相等", () => {
      const condition1 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15 }
      );

      const condition2 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.LESS_THAN,
        { type: "numeric", value: 0.15 }
      );

      expect(condition1.equals(condition2)).toBe(false);
    });

    it("不同值的条件应不相等", () => {
      const condition1 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15 }
      );

      const condition2 = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.20 }
      );

      expect(condition1.equals(condition2)).toBe(false);
    });
  });

  describe("toString 方法", () => {
    it("应正确格式化数值条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.ROE,
        ComparisonOperator.GREATER_THAN,
        { type: "numeric", value: 0.15, unit: "%" }
      );

      expect(condition.toString()).toBe("ROE GREATER_THAN 0.15%");
    });

    it("应正确格式化文本条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.INDUSTRY,
        ComparisonOperator.EQUAL,
        { type: "text", value: "白酒" }
      );

      expect(condition.toString()).toBe('INDUSTRY EQUAL "白酒"');
    });

    it("应正确格式化列表条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.INDUSTRY,
        ComparisonOperator.IN,
        { type: "list", values: ["白酒", "医药"] }
      );

      expect(condition.toString()).toBe("INDUSTRY IN [白酒, 医药]");
    });

    it("应正确格式化范围条件", () => {
      const condition = FilterCondition.create(
        IndicatorField.PE,
        ComparisonOperator.BETWEEN,
        { type: "range", min: 10, max: 30 }
      );

      expect(condition.toString()).toBe("PE BETWEEN [10, 30]");
    });
  });
});
