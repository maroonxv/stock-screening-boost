import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

describe("deploy python image", () => {
  it("installs Python dependencies from pyproject.toml and uv.lock", () => {
    const dockerfile = readFileSync(
      path.join(repoRoot, "deploy", "python", "Dockerfile.voice-base"),
      "utf8",
    );

    expect(dockerfile).toContain("COPY python_services/pyproject.toml");
    expect(dockerfile).toContain("COPY python_services/uv.lock");
    expect(dockerfile).toContain("uv sync --frozen --no-dev");
    expect(dockerfile).not.toContain(
      "pip install --default-timeout=1200 --no-cache-dir -r requirements.txt",
    );
    expect(dockerfile).not.toContain("requirements-refchecker.txt");
  });
});
