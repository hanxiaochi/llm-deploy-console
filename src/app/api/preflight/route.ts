import { NextResponse } from "next/server";
import { runCommand } from "@/lib/runtime";

export const runtime = "nodejs";

export async function GET() {
  const [docker, gpu, kubectl, cluster] = await Promise.all([
    runCommand("docker", ["version", "--format", "{{.Server.Version}}"]),
    runCommand("nvidia-smi", ["--query-gpu=index,name,memory.total,driver_version", "--format=csv,noheader"]),
    runCommand("kubectl", ["version", "--client=true", "--output=yaml"]),
    runCommand("kubectl", ["cluster-info", "--request-timeout=5s"], 8_000),
  ]);
  const gpuLines = gpu.ok ? gpu.stdout.split(/\r?\n/).filter(Boolean) : [];
  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    checks: [
      { id: "docker", label: "Docker Engine", ok: docker.ok, detail: docker.ok ? `Server ${docker.stdout}` : "未检测到可用的 Docker Engine" },
      { id: "gpu", label: "NVIDIA GPU", ok: gpu.ok, detail: gpu.ok ? `${gpuLines.length} 张 GPU · ${gpuLines[0]}` : "未检测到 nvidia-smi" },
      {
        id: "kubernetes",
        label: "Kubernetes 连接",
        ok: kubectl.ok && cluster.ok,
        detail: !kubectl.ok ? "kubectl 未安装或不在 PATH" : cluster.ok ? "客户端与集群连接正常" : "客户端可用，集群不可达",
      },
    ],
  });
}
