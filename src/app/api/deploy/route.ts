import { NextResponse } from "next/server";
import path from "node:path";
import { deploymentSchema } from "@/lib/deployment-schema";
import { generateCompose, generateEnv, generateKubernetes } from "@/lib/generators";
import { runCommand, saveDeployment, updateStatus } from "@/lib/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = deploymentSchema.safeParse(body.config);
  if (!parsed.success) return NextResponse.json({ error: "参数校验失败", issues: parsed.error.flatten() }, { status: 400 });

  const config = parsed.data;
  const execute = body.execute === true;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").toLowerCase();
  const id = `${config.name}--${stamp}`;
  const compose = generateCompose(config);
  const kubernetes = generateKubernetes(config);
  const dir = await saveDeployment(id, config, compose, kubernetes, generateEnv(config));

  if (!execute) return NextResponse.json({ id, state: "generated", message: "已生成配置，未执行部署" });

  if (config.target === "kubernetes" && config.enableApiKey) {
    const secret = await runCommand("kubectl", ["get", "secret", config.apiKeySecretName, "-o", "name"], 15_000);
    if (!secret.ok) {
      const detail = `未找到 Kubernetes Secret ${config.apiKeySecretName}（需包含 api-key 字段）`;
      await updateStatus(dir, "failed", detail);
      return NextResponse.json({ id, state: "failed", message: detail }, { status: 409 });
    }
  }

  const result = config.target === "docker"
    ? await runCommand("docker", ["compose", "--project-directory", dir, "-f", path.join(dir, "compose.yaml"), "up", "-d"], 120_000)
    : await runCommand("kubectl", ["apply", "-f", path.join(dir, "deployment.yaml")], 60_000);
  const state = result.ok ? (config.target === "docker" ? "running" : "applied") : "failed";
  await updateStatus(dir, state, result.ok ? result.stdout : result.stderr);
  return NextResponse.json({ id, state, message: result.ok ? "部署命令执行完成" : result.stderr }, { status: result.ok ? 200 : 502 });
}
