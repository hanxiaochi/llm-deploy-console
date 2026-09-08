import { z } from "zod";

export const deploymentSchema = z
  .object({
    name: z.string().min(2).max(40).regex(/^[a-z][a-z0-9-]*$/, "仅支持小写字母、数字和连字符，且必须以字母开头"),
    target: z.enum(["docker", "kubernetes"]),
    engine: z.enum(["vllm", "ollama"]),
    image: z.string().min(3).max(180),
    modelSource: z.enum(["huggingface", "local"]),
    model: z.string().min(1).max(260),
    servedModelName: z.string().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/, "服务模型名格式不正确"),
    gpuCount: z.number().int().min(1).max(16),
    tensorParallelSize: z.number().int().min(1).max(16),
    quantization: z.enum(["none", "awq", "gptq", "bitsandbytes"]),
    dtype: z.enum(["auto", "bfloat16", "float16"]),
    maxModelLen: z.number().int().min(512).max(262144),
    gpuMemoryUtilization: z.number().min(0.1).max(0.98),
    port: z.number().int().min(1024).max(65535),
    trustRemoteCode: z.boolean(),
    enableApiKey: z.boolean(),
    apiKey: z.string().max(180),
    apiKeySecretName: z.string().max(63),
  })
  .superRefine((value, ctx) => {
    if (value.tensorParallelSize > value.gpuCount) {
      ctx.addIssue({ code: "custom", path: ["tensorParallelSize"], message: "张量并行数不能大于 GPU 数量" });
    }
    if (value.enableApiKey && value.target === "docker" && value.apiKey.length < 12) {
      ctx.addIssue({ code: "custom", path: ["apiKey"], message: "API Key 至少需要 12 个字符" });
    }
    if (value.enableApiKey && value.target === "kubernetes" && !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value.apiKeySecretName)) {
      ctx.addIssue({ code: "custom", path: ["apiKeySecretName"], message: "请输入有效的 Kubernetes Secret 名称" });
    }
    if (value.enableApiKey && value.engine === "ollama") {
      ctx.addIssue({ code: "custom", path: ["enableApiKey"], message: "Ollama 原生服务不提供 API Key 校验，请通过网关接入认证" });
    }
  });

export type DeploymentConfig = z.infer<typeof deploymentSchema>;

export const defaultConfig: DeploymentConfig = {
  name: "deepseek-a100",
  target: "docker",
  engine: "vllm",
  image: "vllm/vllm-openai:v0.10.1.1",
  modelSource: "huggingface",
  model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
  servedModelName: "deepseek-r1",
  gpuCount: 8,
  tensorParallelSize: 8,
  quantization: "none",
  dtype: "bfloat16",
  maxModelLen: 32768,
  gpuMemoryUtilization: 0.9,
  port: 8000,
  trustRemoteCode: false,
  enableApiKey: false,
  apiKey: "",
  apiKeySecretName: "llm-api-key",
};

export const presets: Array<{ id: string; label: string; description: string; config: DeploymentConfig }> = [
  { id: "a100-8", label: "8 × A100", description: "八卡推理节点，参数需按模型实测", config: defaultConfig },
  {
    id: "single-gpu",
    label: "单卡验证",
    description: "适合 8GB 以上显存的开发环境",
    config: {
      ...defaultConfig,
      name: "deepseek-dev",
      model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
      servedModelName: "deepseek-r1-1.5b",
      gpuCount: 1,
      tensorParallelSize: 1,
      quantization: "none",
      maxModelLen: 4096,
      gpuMemoryUtilization: 0.82,
      port: 8001,
    },
  },
  {
    id: "ollama",
    label: "Ollama POC",
    description: "轻量验证，默认不自动下载模型",
    config: {
      ...defaultConfig,
      name: "ollama-poc",
      engine: "ollama",
      image: "ollama/ollama:0.11.10",
      model: "deepseek-r1:7b",
      servedModelName: "deepseek-r1-7b",
      gpuCount: 1,
      tensorParallelSize: 1,
      quantization: "none",
      dtype: "auto",
      maxModelLen: 4096,
      gpuMemoryUtilization: 0.8,
      port: 11434,
    },
  },
];
