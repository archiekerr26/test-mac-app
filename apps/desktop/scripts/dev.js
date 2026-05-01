#!/usr/bin/env node
// Spawns the Vite dev server, waits for it to be ready, compiles the
// Electron main/preload, then launches Electron pointing at the dev URL.
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");

const VITE_URL = "http://localhost:5173";

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http
        .get(url, () => resolve())
        .on("error", () => {
          if (Date.now() - start > timeoutMs) return reject(new Error("Vite did not start in time"));
          setTimeout(tick, 250);
        });
      req.end();
    };
    tick();
  });
}

const vite = spawn("npx", ["vite"], { stdio: "inherit", shell: true });
process.on("SIGINT", () => {
  vite.kill();
  process.exit(0);
});

(async () => {
  try {
    await waitForServer(VITE_URL);

    const compile = spawnSync("npx", ["tsc", "-p", "tsconfig.electron.json"], {
      stdio: "inherit",
      shell: true,
    });
    if (compile.status !== 0) {
      vite.kill();
      process.exit(compile.status ?? 1);
    }

    const electron = spawn("npx", ["electron", "."], { stdio: "inherit", shell: true });
    electron.on("exit", (code) => {
      vite.kill();
      process.exit(code ?? 0);
    });
  } catch (err) {
    console.error(err);
    vite.kill();
    process.exit(1);
  }
})();
