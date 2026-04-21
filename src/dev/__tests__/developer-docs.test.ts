import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

describe("developer documentation", () => {
  it("promotes WSL + dev container as the default development flow", () => {
    const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

    expect(readme).toContain("WSL + Dev Container");
    expect(readme).toContain("npm run dev:all");
    expect(readme).not.toContain("worker:screening");
    expect(readme).not.toContain("screening-worker");
    expect(readme).not.toContain("worker:market-context");
  });

  it("describes deploy as release-style verification instead of the default dev loop", () => {
    const deployReadme = readFileSync(
      path.join(repoRoot, "deploy", "README.md"),
      "utf8",
    );

    expect(deployReadme).toContain("发布式验证");
    expect(deployReadme).toContain("deploy-main.ps1");
    expect(deployReadme).not.toContain("screening-worker");
    expect(deployReadme).not.toContain("market-context-worker");
  });

  it("documents uv-based Python development", () => {
    const pythonReadme = readFileSync(
      path.join(repoRoot, "python_services", "README.md"),
      "utf8",
    );

    expect(pythonReadme).toContain("uv sync --frozen --dev");
    expect(pythonReadme).toContain("uv run pytest");
    expect(pythonReadme).toContain("dev container");
    expect(pythonReadme).not.toContain("python -m venv");
    expect(pythonReadme).not.toContain("pip install -r requirements.txt");
  });
});
