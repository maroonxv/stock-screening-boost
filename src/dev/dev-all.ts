import { spawn } from "node:child_process";
import * as net from "node:net";
import path from "node:path";

type ConsoleLike = Pick<Console, "log" | "info" | "error">;

type RunDevAllOptions = {
  console?: ConsoleLike;
  registerSignalHandlers?: boolean;
};

type ManagedProcess = {
  label: string;
  child: ReturnType<typeof spawn>;
};

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:password@postgres:5432/stock-screening-boost";
const DEFAULT_REDIS_URL = "redis://redis:6379";

export async function runDevAll(options: RunDevAllOptions = {}) {
  const output = options.console ?? console;
  const registerSignalHandlers = options.registerSignalHandlers ?? true;
  const managedProcesses: ManagedProcess[] = [];
  let shuttingDown = false;

  const cleanup = (signal?: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    if (signal) {
      output.info(`Received ${signal}, stopping development processes...`);
    }

    for (const managed of managedProcesses) {
      managed.child.kill(signal ?? "SIGTERM");
    }
  };

  if (registerSignalHandlers) {
    process.on("SIGINT", () => cleanup("SIGINT"));
    process.on("SIGTERM", () => cleanup("SIGTERM"));
  }

  await waitForService(
    "postgres",
    process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  );
  await waitForService("redis", process.env.REDIS_URL ?? DEFAULT_REDIS_URL);

  await runOneShot("npm", ["run", "db:push"], {
    label: "prisma",
    console: output,
  });

  const rootDir = path.resolve(import.meta.dirname, "../..");
  const pythonDir = path.join(rootDir, "python_services");

  managedProcesses.push(
    startManagedProcess("web", "npm", ["run", "dev"], {
      cwd: rootDir,
      console: output,
    }),
  );
  managedProcesses.push(
    startManagedProcess(
      "python-service",
      "uv",
      [
        "run",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
      ],
      {
        cwd: pythonDir,
        console: output,
      },
    ),
  );
  managedProcesses.push(
    startManagedProcess("workflow-worker", "npm", ["run", "worker:workflow"], {
      cwd: rootDir,
      console: output,
    }),
  );

  const exitCode = await waitForFirstExit(managedProcesses);
  cleanup();

  if (exitCode !== 0) {
    throw new Error(`Development process exited with code ${exitCode}.`);
  }

  output.info("Development processes exited cleanly.");
  return exitCode;
}

async function waitForService(name: string, targetUrl: string) {
  const { host, port } = getHostAndPort(targetUrl);

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timed out connecting to ${name} at ${host}:${port}`));
    }, 5_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      socket.destroy();
      const message =
        error instanceof Error ? error.message : "unknown connection error";
      reject(
        new Error(
          `Failed to connect to ${name} at ${host}:${port}: ${message}`,
        ),
      );
    });
  });
}

function getHostAndPort(targetUrl: string) {
  const parsed = new URL(targetUrl);
  const port =
    parsed.port === ""
      ? parsed.protocol === "redis:"
        ? 6379
        : parsed.protocol === "postgres:" || parsed.protocol === "postgresql:"
          ? 5432
          : 80
      : Number(parsed.port);

  return {
    host: parsed.hostname,
    port,
  };
}

function runOneShot(
  command: string,
  args: string[],
  options: { label: string; console: ConsoleLike; cwd?: string },
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: "inherit",
      shell: true,
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`${options.label} exited with code ${code ?? "unknown"}.`),
      );
    });
  });
}

function startManagedProcess(
  label: string,
  command: string,
  args: string[],
  options: { cwd?: string; console: ConsoleLike },
) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: process.env,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
  });

  child.stdout?.on("data", (chunk) => {
    writeLines(options.console.log, label, chunk);
  });
  child.stderr?.on("data", (chunk) => {
    writeLines(options.console.error, label, chunk);
  });

  return { label, child };
}

function waitForFirstExit(processes: ManagedProcess[]) {
  return new Promise<number>((resolve) => {
    for (const managed of processes) {
      managed.child.once("exit", (code) => {
        resolve(code ?? 1);
      });
    }
  });
}

function writeLines(
  sink: (message: string) => void,
  label: string,
  chunk: Buffer | string,
) {
  const text = chunk.toString();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed !== "") {
      sink(`[${label}] ${trimmed}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runDevAll().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(message);
    process.exit(1);
  });
}
