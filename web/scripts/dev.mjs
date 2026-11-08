import { spawn } from "node:child_process";

const args = process.argv.slice(2).filter((argument) => argument !== "--strictPort");
for (let index = 0; index < args.length; index += 1) {
  if (args[index].startsWith("--host=")) {
    args[index] = "--hostname=0.0.0.0";
  } else if (args[index] === "--host") {
    args[index] = "--hostname";
    args[index + 1] = "0.0.0.0";
  }
}

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", ...args], {
  stdio: "inherit",
});
next.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}
