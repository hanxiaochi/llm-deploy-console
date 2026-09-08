import { NextResponse } from "next/server";
import { deploymentSchema } from "@/lib/deployment-schema";
import { estimateMemory, generateCompose, generateKubernetes } from "@/lib/generators";

export async function POST(request: Request) {
  const result = deploymentSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: "参数校验失败", issues: result.error.flatten() }, { status: 400 });
  return NextResponse.json({ compose: generateCompose(result.data), kubernetes: generateKubernetes(result.data), estimate: estimateMemory(result.data) });
}
