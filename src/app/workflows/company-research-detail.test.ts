import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildCompanyResearchDetailModel,
  CompanyResearchDetailPanels,
  CompanyResearchPausedFallbackPanel,
} from "~/app/workflows/company-research-detail";
import type { CompanyResearchResultDto } from "~/server/domain/workflow/types";

function createCompanyResearchResult(): CompanyResearchResultDto {
  return {
    brief: {
      companyName: "示例公司",
      stockCode: "600000",
      officialWebsite: "https://example.com",
      researchGoal: "验证利润兑现",
      focusConcepts: ["算力", "数据中心"],
      keyQuestions: ["增长是否兑现"],
    },
    conceptInsights: [
      {
        concept: "算力",
        whyItMatters: "需求增长驱动资本开支",
        companyFit: "公司已有机柜与客户资源",
        monetizationPath: "通过高毛利机柜与运维服务变现",
        maturity: "成长加速",
      },
    ],
    deepQuestions: [
      {
        question: "增长是否兑现",
        whyImportant: "决定估值扩张是否可持续",
        targetMetric: "订单与利润率",
        dataHint: "看订单增速与季度利润率变化",
      },
    ],
    findings: [
      {
        question: "增长是否兑现",
        answer: "订单增长已经开始传导到利润率。",
        confidence: "high",
        evidenceUrls: ["https://example.com/report"],
        referenceIds: ["ref-1"],
        gaps: ["还需要跟踪后续季度持续性"],
      },
    ],
    evidence: [
      {
        referenceId: "ref-1",
        title: "2026Q1 投资者交流纪要",
        sourceName: "示例公司 IR",
        url: "https://example.com/report",
        sourceType: "official",
        sourceTier: "first_party",
        collectorKey: "official_sources",
        isFirstParty: true,
        snippet: "公司表示订单质量持续改善。",
        extractedFact: "订单质量持续改善且利润率环比提升。",
        relevance: "直接回答增长兑现问题",
        publishedAt: "2026-03-12",
      },
    ],
    references: [
      {
        id: "ref-1",
        title: "2026Q1 投资者交流纪要",
        sourceName: "示例公司 IR",
        snippet: "公司表示订单质量持续改善。",
        extractedFact: "订单质量持续改善且利润率环比提升。",
        url: "https://example.com/report",
        publishedAt: "2026-03-12",
        credibilityScore: 95,
        sourceType: "official",
        sourceTier: "first_party",
        collectorKey: "official_sources",
        isFirstParty: true,
      },
    ],
    verdict: {
      stance: "优先研究",
      summary: "订单与利润率已经出现正向验证。",
      bullPoints: ["利润率改善已被管理层确认"],
      bearPoints: ["验证周期仍然较短"],
      nextChecks: ["跟踪下一个季度利润率"],
    },
    collectionSummary: {
      collectors: [
        {
          collectorKey: "official_sources",
          label: "官网与投资者关系",
          rawCount: 3,
          curatedCount: 2,
          referenceCount: 1,
          firstPartyCount: 1,
          configured: true,
          notes: [],
        },
      ],
      totalRawCount: 6,
      totalCuratedCount: 3,
      totalReferenceCount: 1,
      totalFirstPartyCount: 1,
      notes: [],
    },
    crawler: {
      provider: "tavily",
      configured: true,
      queries: [],
      notes: [],
    },
    confidenceAnalysis: {
      status: "COMPLETE",
      finalScore: 88,
      level: "high",
      claimCount: 1,
      supportedCount: 1,
      insufficientCount: 0,
      contradictedCount: 0,
      abstainCount: 0,
      supportRate: 1,
      insufficientRate: 0,
      contradictionRate: 0,
      abstainRate: 0,
      evidenceCoverageScore: 91,
      freshnessScore: 86,
      sourceDiversityScore: 74,
      notes: ["一手信源占比较高"],
      claims: [],
    },
    generatedAt: "2026-03-12T08:00:00.000Z",
  };
}

describe("company-research-detail", () => {
  it("builds a structured company research detail model", () => {
    const model = buildCompanyResearchDetailModel({
      status: "SUCCEEDED",
      result: createCompanyResearchResult(),
    });

    expect(model?.kind).toBe("detail");
    if (!model || model.kind !== "detail") {
      throw new Error("expected detail model");
    }

    expect(model.backgroundItems.map((item) => item.label)).toEqual(
      expect.arrayContaining(["公司名称", "研究目标", "关注概念", "状态"]),
    );
    expect(model.questionCards).toHaveLength(1);
    expect(model.questionCards[0]?.referencePreview).toHaveLength(1);
    expect(
      model.referenceFilters.some(
        (item) => item.id === "official" && item.count === 1,
      ),
    ).toBe(true);
  });

  it("renders the summary tab with the new four-tab navigation", () => {
    const model = buildCompanyResearchDetailModel({
      status: "SUCCEEDED",
      result: createCompanyResearchResult(),
    });

    if (!model || model.kind !== "detail") {
      throw new Error("expected detail model");
    }

    const markup = renderToStaticMarkup(
      React.createElement(CompanyResearchDetailPanels, {
        model,
        activeTabId: "summary",
      }),
    );

    expect(markup).toContain("投资结论");
    expect(markup).toContain("业务与概念");
    expect(markup).toContain("关键问题");
    expect(markup).toContain("引用与来源");
    expect(markup).toContain("利润率改善已被管理层确认");
    expect(markup).toContain("一手信源占比较高");
  });

  it("renders the concepts tab with concept cards", () => {
    const model = buildCompanyResearchDetailModel({
      status: "SUCCEEDED",
      result: createCompanyResearchResult(),
    });

    if (!model || model.kind !== "detail") {
      throw new Error("expected detail model");
    }

    const markup = renderToStaticMarkup(
      React.createElement(CompanyResearchDetailPanels, {
        model,
        activeTabId: "concepts",
      }),
    );

    expect(markup).toContain("需求增长驱动资本开支");
    expect(markup).toContain("公司已有机柜与客户资源");
    expect(markup).toContain("成长加速");
  });

  it("renders the questions tab with expandable question details and citation preview", () => {
    const model = buildCompanyResearchDetailModel({
      status: "SUCCEEDED",
      result: createCompanyResearchResult(),
    });

    if (!model || model.kind !== "detail") {
      throw new Error("expected detail model");
    }

    const markup = renderToStaticMarkup(
      React.createElement(CompanyResearchDetailPanels, {
        model,
        activeTabId: "questions",
      }),
    );

    expect(markup).toContain("增长是否兑现");
    expect(markup).toContain("订单增长已经开始传导到利润率。");
    expect(markup).toContain("2026Q1 投资者交流纪要");
    expect(markup).toContain("还需要跟踪后续季度持续性");
  });

  it("renders the references tab with coverage metrics and citation cards", () => {
    const model = buildCompanyResearchDetailModel({
      status: "SUCCEEDED",
      result: createCompanyResearchResult(),
    });

    if (!model || model.kind !== "detail") {
      throw new Error("expected detail model");
    }

    const markup = renderToStaticMarkup(
      React.createElement(CompanyResearchDetailPanels, {
        model,
        activeTabId: "references",
      }),
    );

    expect(markup).toContain("原始证据");
    expect(markup).toContain("官网与投资者关系");
    expect(markup).toContain("2026Q1 投资者交流纪要");
    expect(markup).toContain("公司表示订单质量持续改善。");
  });

  it("builds and renders a paused fallback model when no structured result exists", () => {
    const model = buildCompanyResearchDetailModel({
      status: "PAUSED",
      input: {
        companyName: "示例公司",
        stockCode: "600000",
        focusConcepts: ["算力"],
        researchPreferences: {
          researchGoal: "验证利润兑现",
        },
      },
      result: {
        qualityFlags: ["source_coverage_low"],
        missingRequirements: ["补充官网信源"],
      },
      currentNodeKey: "collect_company_evidence",
    });

    expect(model?.kind).toBe("paused_fallback");
    if (!model || model.kind !== "paused_fallback") {
      throw new Error("expected paused fallback model");
    }

    const markup = renderToStaticMarkup(
      React.createElement(CompanyResearchPausedFallbackPanel, {
        model,
      }),
    );

    expect(markup).toContain("已暂停");
    expect(markup).toContain("补充官网信源");
    expect(markup).toContain("source_coverage_low");
    expect(markup).toContain("示例公司");
  });
});
