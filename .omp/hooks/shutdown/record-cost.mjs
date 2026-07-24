import { execSync } from "node:child_process";

export default function (pi) {
  pi.on("session_shutdown", async () => {
    try {
      execSync("node scripts/session-info.mjs", {
        cwd: pi.cwd,
        stdio: "pipe",
      });
    } catch {
      // Fail silently — don't block shutdown
    }
  });
}
