import {
  WORKFLOW_ERROR_CODES,
  WorkflowDomainError,
} from "~/server/domain/workflow/errors";
import type { WorkflowGraphRunner } from "~/server/infrastructure/workflow/langgraph/workflow-graph";

export class WorkflowGraphRegistry {
  private readonly graphs: Map<string, WorkflowGraphRunner>;

  constructor(graphs: WorkflowGraphRunner[]) {
    this.graphs = new Map(graphs.map((graph) => [graph.templateCode, graph]));
  }

  get(templateCode: string): WorkflowGraphRunner {
    const graph = this.graphs.get(templateCode);

    if (!graph) {
      throw new WorkflowDomainError(
        WORKFLOW_ERROR_CODES.WORKFLOW_TEMPLATE_NOT_FOUND,
        `未注册的工作流模板: ${templateCode}`,
      );
    }

    return graph;
  }
}
