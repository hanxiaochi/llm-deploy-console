import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { DeploymentConfig } from "./deployment-schema";

const execFileAsync = promisify(execFile);
export const runtimeRoot = path.join(process.cwd(), "runtime", "deployments");

export async function runCommand(file: string, args: string[], timeout = 15_000) {
  try {
    const result = await execFileAsync(file, args, { timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    const value = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    return { ok: false, stdout: value.stdout?.trim() ?? "", stderr: value.stderr?.trim() || value.message };
  }
}

export async function ensureRuntimeRoot() {
  await fs.mkdir(runtimeRoot, { recursive: true });
}

export function safeDeploymentId(id: string) {
  if (!/^[a-z][a-z0-9-]*--\d{8}t\d{6}z$/.test(id)) throw new Error("非法部署记录 ID");
  return id;
}

export async function saveDeployment(id: string, config: DeploymentConfig, compose: string, kubernetes: string, env: string) {
  await ensureRuntimeRoot();
  const dir = path.join(runtimeRoot, safeDeploymentId(id));
  await fs.mkdir(dir, { recursive: false });
  await Promise.all([
    fs.writeFile(path.join(dir, "config.json"), JSON.stringify({ ...config, apiKey: "" }, null, 2), "utf8"),
    fs.writeFile(path.join(dir, "compose.yaml"), compose, "utf8"),
    fs.writeFile(path.join(dir, "deployment.yaml"), kubernetes, "utf8"),
    fs.writeFile(path.join(dir, ".env"), env, "utf8"),
    fs.writeFile(path.join(dir, "status.json"), JSON.stringify({ state: "generated", updatedAt: new Date().toISOString() }, null, 2), "utf8"),
  ]);
  return dir;
}

export async function updateStatus(dir: string, state: string, detail = "") {
  await fs.writeFile(path.join(dir, "status.json"), JSON.stringify({ state, detail, updatedAt: new Date().toISOString() }, null, 2), "utf8");
}
