import { Annotation, StateGraph } from "@langchain/langgraph";
import type {
  CandidateCredibilityResult,
  IntelligenceAgentService,
} from "~/server/application/intelligence/intelligence-agent-service";
import type {
  QuickResearchGraphState,
  QuickResearchNodeKey,
  WorkflowGraphState,
  WorkflowNodeKey,
} from "~/server/domain/workflow/types";
import {
  QUICK_RESEARCH_NODE_KEYS,
  QUICK_RESEARCH_TEMPLATE_CODE,
} from "~/server/domain/workflow/types";
import type { WorkflowGraphBuildInitialStateParams } from "~/server/infrastructure/workflow/langgraph/workflow-graph";
import { BaseWorkflowLangGraph } from "~/server/infrastructure/workflow/langgraph/workflow-graph-base";
import {
  addResumeStart,
  addSequentialEdges,
  addWorkflowNodes,
} from "~/server/infrastructure/workflow/langgraph/workflow-graph-builder";

const WorkflowState = Annotation.Root({
  runId: Annotation<string>,
  userId: Annotation<string>,
  query: Annotation<string>,
  progressPercent: Annotation<number>,
  resumeFromNodeKey: Annotation<WorkflowNodeKey | undefined>,
  currentNodeKey: Annotation<QuickResearchNodeKey | undefined>,
  intent: Annotation<string | undefined>,
  industryOverview: Annotation<string | undefined>,
  news: Annotation<QuickResearchGraphState["news"]>,
  heatAnalysis: Annotation<QuickResearchGraphState["heatAnalysis"]>,
  candidates: Annotation<QuickResearchGraphState["candidates"]>,
  credibility: Annotation<QuickResearchGraphState["credibility"]>,
  evidenceList: Annotation<QuickResearchGraphState["evidenceList"]>,
  competition: Annotation<string | undefined>,
  finalReport: Annotation<QuickResearchGraphState["finalReport"]>,
  errors: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

type NodeExecutor = (
  state: QuickResearchGraphState,
) => Promise<Partial<QuickResearchGraphState>>;

export class QuickResearchLangGraph extends BaseWorkflowLangGraph<
  QuickResearchGraphState,
  QuickResearchNodeKey
> {
  readonly templateCode = QUICK_RESEARCH_TEMPLATE_CODE;

  constructor(intelligenceService: IntelligenceAgentService) {
    const nodeExecutors: Record<QuickResearchNodeKey, NodeExecutor> = {
      agent1_industry_overview: async (state) => {
        const { overview, news } =
          await intelligenceService.generateIndustryOverview(state.query);

        return {
          intent: state.query,
          industryOverview: overview,
          news,
        };
      },
      agent2_market_heat: async (state) => {
        const heatAnalysis = await intelligenceService.analyzeMarketHeat(
          state.query,
          state.news,
        );

        return {
          news: heatAnalysis.news,
          heatAnalysis: {
            heatScore: heatAnalysis.heatScore,
            heatConclusion: heatAnalysis.heatConclusion,
          },
        };
      },
      agent3_candidate_screening: async (state) => {
        const heatScore = state.heatAnalysis?.heatScore ?? 50;
        const candidates = await intelligenceService.screenCandidates(
          state.query,
          heatScore,
        );

        return {
          candidates,
        };
      },
      agent4_credibility_batch: async (state) => {
        const candidates = state.candidates ?? [];
        const result: CandidateCredibilityResult =
          await intelligenceService.evaluateCredibility(
            state.query,
            candidates,
          );

        return {
          credibility: result.credibility,
          evidenceList: result.evidenceList,
        };
      },
      agent5_competition_summary: async (state) => {
        const competitionSummary =
          await intelligenceService.summarizeCompetition({
            query: state.query,
            candidates: state.candidates ?? [],
            credibility: state.credibility ?? [],
          });

        const confidenceAnalysis =
          await intelligenceService.analyzeQuickResearchOverall({
            query: state.query,
            overview: state.industryOverview ?? "No overview",
            heatConclusion:
              state.heatAnalysis?.heatConclusion ?? "No heat conclusion",
            candidates: state.candidates ?? [],
            credibility: state.credibility ?? [],
            competitionSummary,
            news: state.news ?? [],
            evidenceList: state.evidenceList ?? [],
          });

        const finalReport = intelligenceService.buildFinalReport({
          overview: state.industryOverview ?? "No overview",
          heatScore: state.heatAnalysis?.heatScore ?? 50,
          heatConclusion:
            state.heatAnalysis?.heatConclusion ?? "No heat conclusion",
          candidates: state.candidates ?? [],
          credibility: state.credibility ?? [],
          competitionSummary,
          confidenceAnalysis,
        });

        return {
          competition: competitionSummary,
          finalReport,
        };
      },
    };

    const graphBuilder = new StateGraph(WorkflowState) as StateGraph<
      unknown,
      QuickResearchGraphState,
      Partial<QuickResearchGraphState>,
      string
    >;
    addWorkflowNodes(graphBuilder, QUICK_RESEARCH_NODE_KEYS, nodeExecutors);
    addResumeStart(graphBuilder, QUICK_RESEARCH_NODE_KEYS);
    addSequentialEdges(graphBuilder, QUICK_RESEARCH_NODE_KEYS);

    super({
      graph: graphBuilder.compile(),
      nodeOrder: QUICK_RESEARCH_NODE_KEYS,
    });
  }

  buildInitialState(
    params: WorkflowGraphBuildInitialStateParams,
  ): QuickResearchGraphState {
    return {
      runId: params.runId,
      userId: params.userId,
      query: params.query,
      progressPercent: params.progressPercent,
      resumeFromNodeKey: undefined,
      currentNodeKey: undefined,
      errors: [],
    };
  }

  getNodeOutput(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const quickState = state as QuickResearchGraphState;

    if (nodeKey === "agent1_industry_overview") {
      return {
        intent: quickState.intent,
        industryOverview: quickState.industryOverview,
        newsCount: quickState.news?.length ?? 0,
      };
    }

    if (nodeKey === "agent2_market_heat") {
      return {
        heatAnalysis: quickState.heatAnalysis,
      };
    }

    if (nodeKey === "agent3_candidate_screening") {
      return {
        candidates: quickState.candidates,
      };
    }

    if (nodeKey === "agent4_credibility_batch") {
      return {
        credibility: quickState.credibility,
      };
    }

    return {
      competition: quickState.competition,
      finalReport: quickState.finalReport,
    };
  }

  getNodeEventPayload(nodeKey: WorkflowNodeKey, state: WorkflowGraphState) {
    const quickState = state as QuickResearchGraphState;

    if (nodeKey === "agent3_candidate_screening") {
      return {
        candidateCount: quickState.candidates?.length ?? 0,
      };
    }

    if (nodeKey === "agent4_credibility_batch") {
      return {
        credibilityCount: quickState.credibility?.length ?? 0,
      };
    }

    if (nodeKey === "agent5_competition_summary") {
      return {
        topPickCount: quickState.finalReport?.topPicks.length ?? 0,
        confidenceStatus:
          quickState.finalReport?.confidenceAnalysis?.status ?? "UNAVAILABLE",
      };
    }

    return {};
  }

  mergeNodeOutput(
    state: WorkflowGraphState,
    nodeKey: WorkflowNodeKey,
    output: Record<string, unknown>,
  ) {
    return {
      ...state,
      ...output,
      currentNodeKey: nodeKey,
      lastCompletedNodeKey: nodeKey,
    };
  }

  getRunResult(state: WorkflowGraphState): Record<string, unknown> {
    const quickState = state as QuickResearchGraphState;

    return (quickState.finalReport ?? {
      generatedAt: new Date().toISOString(),
    }) as Record<string, unknown>;
  }
}
