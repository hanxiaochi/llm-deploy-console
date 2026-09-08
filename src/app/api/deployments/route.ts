import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ensureRuntimeRoot, runCommand, runtimeRoot, safeDeploymentId, updateStatus } from "@/lib/runtime";

export const runtime = "nodejs";

async function listDeployments() {
  await ensureRuntimeRoot();
  const entries = await fs.readdir(runtimeRoot, { withFileTypes: true });
  const rows = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      const [config, status] = await Promise.all([
        fs.readFile(path.join(runtimeRoot, entry.name, "config.json"), "utf8"),
        fs.readFile(path.join(runtimeRoot, entry.name, "status.json"), "utf8"),
      ]);
      return { id: entry.name, config: JSON.parse(config), status: JSON.parse(status) };
    } catch {
      return null;
    }
  }));
  return rows.filter(Boolean).sort((a, b) => (a!.id < b!.id ? 1 : -1));
}

export async function GET() {
  return NextResponse.json({ deployments: await listDeployments() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const id = safeDeploymentId(String(body.id ?? ""));
  const action = String(body.action ?? "");
  if (!["start", "stop", "restart", "logs"].includes(action)) return NextResponse.json({ error: "不支持的操作" }, { status: 400 });

  const dir = path.join(runtimeRoot, id);
  const config = JSON.parse(await fs.readFile(path.join(dir, "config.json"), "utf8")) as { target: "docker" | "kubernetes"; name: string };
  if (config.target === "kubernetes") {
    const args = action === "logs"
      ? ["logs", `deployment/${config.name}`, "--tail=120"]
      : action === "restart"
        ? ["rollout", "restart", `deployment/${config.name}`]
        : ["scale", `deployment/${config.name}`, `--replicas=${action === "stop" ? 0 : 1}`];
    const result = await runCommand("kubectl", args, action === "logs" ? 20_000 : 60_000);
    if (action !== "logs") {
      const state = action === "stop" ? "stopped" : action === "restart" ? "restarting" : "running";
      await updateStatus(dir, result.ok ? state : "failed", result.ok ? result.stdout : result.stderr);
    }
    return NextResponse.json({ ok: result.ok, output: result.ok ? result.stdout : result.stderr }, { status: result.ok ? 200 : 502 });
  }

  const composeFile = path.join(dir, "compose.yaml");
  await fs.access(composeFile);
  const args = action === "logs"
    ? ["compose", "--project-directory", dir, "-f", composeFile, "logs", "--tail", "120", "--no-color"]
    : ["compose", "--project-directory", dir, "-f", composeFile, action === "start" ? "up" : action, ...(action === "start" ? ["-d"] : [])];
  const result = await runCommand("docker", args, action === "logs" ? 20_000 : 60_000);
  if (action !== "logs") await updateStatus(dir, result.ok ? (action === "stop" ? "stopped" : "running") : "failed", result.ok ? result.stdout : result.stderr);
  return NextResponse.json({ ok: result.ok, output: result.ok ? result.stdout : result.stderr }, { status: result.ok ? 200 : 502 });
}
