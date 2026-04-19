import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MarketContextSection refresh UX", () => {
  it("wires refresh mutation state and persisted refresh metadata into the shared section", () => {
    const source = readFileSync(
      new URL("./market-context-section.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("api.marketContext.refreshSnapshot.useMutation");
    expect(source).toContain("snapshotQuery.data.snapshot");
    expect(source).toContain("snapshotQuery.data.refreshState");
    expect(source).toContain("lastSuccessfulRefreshAt");
    expect(source).toContain("lastRefreshError");
    expect(source).toContain("disabled={refreshMutation.isPending}");
  });
});
