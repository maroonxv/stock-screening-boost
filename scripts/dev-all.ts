import { runDevAll } from "~/dev/dev-all";

void runDevAll().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(message);
  process.exit(1);
});
