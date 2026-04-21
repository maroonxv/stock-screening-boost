import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

describe("dev workflow configuration", () => {
  it("exposes npm run dev:all and removes stale worker scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string | undefined>;
    };

    expect(packageJson.scripts["dev:all"]).toBe("tsx scripts/dev-all.ts");
    expect(packageJson.scripts["worker:workflow"]).toBeDefined();
    expect(packageJson.scripts["worker:screening"]).toBeUndefined();
    expect(packageJson.scripts["worker:market-context"]).toBeUndefined();
  });

  it("ships a compose-based dev container with workspace, postgres, and redis", () => {
    const devcontainerJsonPath = path.join(
      repoRoot,
      ".devcontainer",
      "devcontainer.json",
    );
    const composeYamlPath = path.join(
      repoRoot,
      ".devcontainer",
      "docker-compose.yml",
    );

    expect(existsSync(devcontainerJsonPath)).toBe(true);
    expect(existsSync(composeYamlPath)).toBe(true);

    const devcontainer = JSON.parse(
      readFileSync(devcontainerJsonPath, "utf8"),
    ) as {
      dockerComposeFile?: string | string[];
      service?: string;
      runServices?: string[];
      postCreateCommand?: string;
      customizations?: {
        vscode?: {
          settings?: Record<string, string | boolean | number>;
        };
      };
    };
    const composeYaml = readFileSync(composeYamlPath, "utf8");

    expect(devcontainer.service).toBe("workspace");
    expect(devcontainer.runServices).toEqual([
      "workspace",
      "postgres",
      "redis",
    ]);
    expect(devcontainer.postCreateCommand).toContain("npm ci");
    expect(devcontainer.postCreateCommand).toContain("uv sync --frozen --dev");
    expect(
      devcontainer.customizations?.vscode?.settings?.[
        "terminal.integrated.defaultProfile.linux"
      ],
    ).toBe("bash");
    expect(composeYaml).toContain("workspace:");
    expect(composeYaml).toContain("postgres:");
    expect(composeYaml).toContain("redis:");
    expect(composeYaml).toContain("/var/run/docker.sock:/var/run/docker.sock");
  });

  it("uses uv as the python dependency source of truth", () => {
    const pyprojectPath = path.join(
      repoRoot,
      "python_services",
      "pyproject.toml",
    );
    const uvLockPath = path.join(repoRoot, "python_services", "uv.lock");
    const pyproject = readFileSync(pyprojectPath, "utf8");

    expect(existsSync(pyprojectPath)).toBe(true);
    expect(existsSync(uvLockPath)).toBe(true);
    expect(pyproject).toContain("[project]");
    expect(pyproject).toContain("uvicorn[standard]");
    expect(pyproject).toContain("[dependency-groups]");
    expect(pyproject).toContain("dev = [");
    expect(pyproject).toContain("[project.optional-dependencies]");
    expect(pyproject).toContain("refchecker = [");
  });

  it("keeps dev env defaults aligned to the dev container network", () => {
    const envExample = readFileSync(
      path.join(repoRoot, ".env.example"),
      "utf8",
    );
    const deployEnvExample = readFileSync(
      path.join(repoRoot, "deploy", ".env.example"),
      "utf8",
    );
    const deployCompose = readFileSync(
      path.join(repoRoot, "deploy", "docker-compose.yml"),
      "utf8",
    );

    expect(envExample).toContain(
      'DATABASE_URL="postgresql://postgres:password@postgres:5432/stock-screening-boost"',
    );
    expect(envExample).toContain('REDIS_URL="redis://redis:6379"');
    expect(envExample).toContain('PYTHON_SERVICE_URL="http://127.0.0.1:8000"');
    expect(envExample).toContain(
      'PYTHON_INTELLIGENCE_SERVICE_URL="http://127.0.0.1:8000"',
    );
    expect(envExample).not.toContain("SCREENING_WORKER_POLL_INTERVAL_MS");
    expect(envExample).not.toContain("MARKET_CONTEXT_WORKER_POLL_INTERVAL_MS");
    expect(deployEnvExample).not.toContain("SCREENING_WORKER_POLL_INTERVAL_MS");
    expect(deployEnvExample).not.toContain(
      "MARKET_CONTEXT_WORKER_POLL_INTERVAL_MS",
    );
    expect(deployCompose).toContain("workflow-worker:");
    expect(deployCompose).not.toContain("screening-worker:");
    expect(deployCompose).not.toContain("market-context-worker:");
  });
});
