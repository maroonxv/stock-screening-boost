import { afterEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const spawnMock = vi.fn();
vi.mock("node:net", () => ({
  createConnection: (...args: unknown[]) => connectMock(...args),
}));

vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

describe("runDevAll", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("waits for infra, prepares prisma, and starts all dev processes", async () => {
    const logMock = vi.fn();
    const infoMock = vi.fn();
    const errorMock = vi.fn();

    const sockets = [createSocketStub(), createSocketStub()];
    connectMock.mockImplementation(() => {
      const socket = sockets.shift();
      if (!socket) {
        throw new Error("unexpected connection");
      }
      queueMicrotask(() => socket.handlers.connect?.());
      return socket.socket;
    });

    const prismaProcess = createChildProcessStub();
    const webProcess = createChildProcessStub();
    const pythonProcess = createChildProcessStub();
    const workflowProcess = createChildProcessStub();

    spawnMock
      .mockReturnValueOnce(prismaProcess.child)
      .mockReturnValueOnce(webProcess.child)
      .mockReturnValueOnce(pythonProcess.child)
      .mockReturnValueOnce(workflowProcess.child);

    const previousEnv = { ...process.env };
    process.env.DATABASE_URL =
      "postgresql://postgres:password@postgres:5432/stock-screening-boost";
    process.env.REDIS_URL = "redis://redis:6379";

    try {
      const { runDevAll } = await import("~/dev/dev-all");
      const runPromise = runDevAll({
        console: {
          log: logMock,
          info: infoMock,
          error: errorMock,
        },
        registerSignalHandlers: false,
      });

      await vi.waitFor(() => {
        expect(connectMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ host: "postgres", port: 5432 }),
        );
        expect(connectMock).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ host: "redis", port: 6379 }),
        );
      });

      expect(spawnMock).toHaveBeenNthCalledWith(
        1,
        "npm",
        ["run", "db:push"],
        expect.objectContaining({ stdio: "inherit" }),
      );

      prismaProcess.emitExit(0);
      await vi.waitFor(() => {
        expect(spawnMock).toHaveBeenNthCalledWith(
          2,
          "npm",
          ["run", "dev"],
          expect.objectContaining({ stdio: ["inherit", "pipe", "pipe"] }),
        );
      });
      expect(spawnMock).toHaveBeenNthCalledWith(
        3,
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
        expect.objectContaining({
          cwd: expect.stringContaining("python_services"),
        }),
      );
      expect(spawnMock).toHaveBeenNthCalledWith(
        4,
        "npm",
        ["run", "worker:workflow"],
        expect.any(Object),
      );

      webProcess.stdout.emit("data", Buffer.from("web ready\n"));
      pythonProcess.stderr.emit("data", Buffer.from("python warn\n"));
      workflowProcess.stdout.emit("data", Buffer.from("workflow tick\n"));

      webProcess.emitExit(0);
      await expect(runPromise).resolves.toBe(0);

      expect(logMock).toHaveBeenCalledWith("[web] web ready");
      expect(errorMock).toHaveBeenCalledWith("[python-service] python warn");
      expect(logMock).toHaveBeenCalledWith("[workflow-worker] workflow tick");
      expect(infoMock).toHaveBeenCalledWith(
        "Development processes exited cleanly.",
      );
    } finally {
      restoreProcessEnv(previousEnv);
    }
  });

  it("fails fast when postgres is unavailable", async () => {
    const logMock = vi.fn();
    const infoMock = vi.fn();
    const errorMock = vi.fn();

    connectMock.mockImplementation(() => {
      const socket = createSocketStub();
      queueMicrotask(() =>
        socket.handlers.error?.(new Error("connect ECONNREFUSED postgres")),
      );
      return socket.socket;
    });

    const previousEnv = { ...process.env };
    process.env.DATABASE_URL =
      "postgresql://postgres:password@postgres:5432/stock-screening-boost";
    process.env.REDIS_URL = "redis://redis:6379";

    try {
      const { runDevAll } = await import("~/dev/dev-all");

      await expect(
        runDevAll({
          console: {
            log: logMock,
            info: infoMock,
            error: errorMock,
          },
          registerSignalHandlers: false,
        }),
      ).rejects.toThrow("Failed to connect to postgres at postgres:5432");

      expect(spawnMock).not.toHaveBeenCalled();
    } finally {
      restoreProcessEnv(previousEnv);
    }
  });
});

function createSocketStub() {
  const handlers: Record<string, ((value?: unknown) => void) | undefined> = {};
  const socket = {
    once(event: string, handler: (value?: unknown) => void) {
      handlers[event] = handler;
      return socket;
    },
    on(event: string, handler: (value?: unknown) => void) {
      handlers[event] = handler;
      return socket;
    },
    destroy: vi.fn(),
  };

  return { socket, handlers };
}

function createChildProcessStub() {
  const handlers: Record<string, ((code: number | null) => void) | undefined> =
    {};
  const stdoutHandlers: Record<
    string,
    ((chunk: Buffer | string) => void) | undefined
  > = {};
  const stderrHandlers: Record<
    string,
    ((chunk: Buffer | string) => void) | undefined
  > = {};

  return {
    child: {
      pid: 123,
      stdout: {
        on(event: string, handler: (chunk: Buffer | string) => void) {
          stdoutHandlers[event] = handler;
          return this;
        },
        emit(event: string, chunk: Buffer | string) {
          stdoutHandlers[event]?.(chunk);
        },
      },
      stderr: {
        on(event: string, handler: (chunk: Buffer | string) => void) {
          stderrHandlers[event] = handler;
          return this;
        },
        emit(event: string, chunk: Buffer | string) {
          stderrHandlers[event]?.(chunk);
        },
      },
      on(event: string, handler: (code: number | null) => void) {
        handlers[event] = handler;
        return this;
      },
      once(event: string, handler: (code: number | null) => void) {
        handlers[event] = handler;
        return this;
      },
      kill: vi.fn(),
      emitExit(code: number | null) {
        handlers.exit?.(code);
      },
      emit(event: string, chunk: Buffer | string) {
        if (event === "data") {
          stdoutHandlers.data?.(chunk);
        }
      },
    },
    emitExit(code: number | null) {
      handlers.exit?.(code);
    },
    stdout: {
      emit(event: string, chunk: Buffer | string) {
        stdoutHandlers[event]?.(chunk);
      },
    },
    stderr: {
      emit(event: string, chunk: Buffer | string) {
        stderrHandlers[event]?.(chunk);
      },
    },
  };
}

function restoreProcessEnv(previousEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in previousEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
