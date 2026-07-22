import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync("bun", ["--env-file=.env.test", "run", "test:seed:agent"], {
    cwd: "../server",
    stdio: "inherit",
    shell: true,
  });
}
