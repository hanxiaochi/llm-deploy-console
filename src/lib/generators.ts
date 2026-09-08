import YAML from "yaml";
import type { DeploymentConfig } from "./deployment-schema";

function modelArgument(config: DeploymentConfig) {
  return config.modelSource === "local" ? "/model" : config.model;
}

function vllmCommand(config: DeploymentConfig, target: "docker" | "kubernetes") {
  const command = [
    "--model", modelArgument(config),
    "--served-model-name", config.servedModelName,
    "--tensor-parallel-size", String(config.tensorParallelSize),
    "--dtype", config.dtype,
    "--max-model-len", String(config.maxModelLen),
    "--gpu-memory-utilization", String(config.gpuMemoryUtilization),
    "--host", "0.0.0.0",
    "--port", "8000",
  ];
  if (config.quantization !== "none") command.push("--quantization", config.quantization);
  if (config.trustRemoteCode) command.push("--trust-remote-code");
  if (config.enableApiKey) command.push("--api-key", target === "docker" ? "${LLM_API_KEY}" : "$(LLM_API_KEY)");
  return command;
}

export function generateCompose(config: DeploymentConfig) {
  const service = config.engine === "vllm"
    ? {
        image: config.image,
        container_name: config.name,
        restart: "unless-stopped",
        ipc: "host",
        shm_size: "32gb",
        gpus: "all",
        ports: [`127.0.0.1:${config.port}:8000`],
        volumes: config.modelSource === "local" ? [`${config.model}:/model:ro`] : undefined,
        environment: config.enableApiKey ? { LLM_API_KEY: "${LLM_API_KEY}" } : undefined,
        command: vllmCommand(config, "docker"),
        healthcheck: { test: ["CMD", "curl", "-fsS", "http://127.0.0.1:8000/health"], interval: "30s", timeout: "5s", retries: 5, start_period: "10m" },
      }
    : {
        image: config.image,
        container_name: config.name,
        restart: "unless-stopped",
        gpus: "all",
        ports: [`127.0.0.1:${config.port}:11434`],
        volumes: ["ollama-data:/root/.ollama"],
        environment: { OLLAMA_HOST: "0.0.0.0:11434" },
        healthcheck: { test: ["CMD", "ollama", "list"], interval: "30s", timeout: "5s", retries: 5, start_period: "2m" },
      };
  const document: Record<string, unknown> = { name: config.name, services: { inference: service } };
  if (config.engine === "ollama") document.volumes = { "ollama-data": {} };
  return YAML.stringify(document, { indent: 2, lineWidth: 0 });
}

export function generateKubernetes(config: DeploymentConfig) {
  const labels = { app: config.name, "app.kubernetes.io/component": "inference" };
  const containerPort = config.engine === "vllm" ? 8000 : 11434;
  const volumes: Array<Record<string, unknown>> = [];
  const volumeMounts: Array<Record<string, unknown>> = [];
  if (config.modelSource === "local" && config.engine === "vllm") {
    volumes.push({ name: "model", hostPath: { path: config.model, type: "Directory" } });
    volumeMounts.push({ name: "model", mountPath: "/model", readOnly: true });
  }
  const deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: config.name, labels },
    spec: {
      replicas: 1,
      strategy: { type: "Recreate" },
      selector: { matchLabels: { app: config.name } },
      template: {
        metadata: { labels },
        spec: {
          terminationGracePeriodSeconds: 120,
          containers: [{
            name: "inference",
            image: config.image,
            imagePullPolicy: "IfNotPresent",
            command: config.engine === "ollama" ? ["ollama", "serve"] : undefined,
            args: config.engine === "vllm" ? vllmCommand(config, "kubernetes") : undefined,
            ports: [{ name: "http", containerPort }],
            env: config.enableApiKey ? [{ name: "LLM_API_KEY", valueFrom: { secretKeyRef: { name: config.apiKeySecretName, key: "api-key" } } }] : undefined,
            resources: {
              requests: { cpu: "8", memory: "32Gi", "nvidia.com/gpu": config.gpuCount },
              limits: { cpu: "32", memory: "256Gi", "nvidia.com/gpu": config.gpuCount },
            },
            volumeMounts: volumeMounts.length ? volumeMounts : undefined,
            startupProbe: { httpGet: { path: config.engine === "vllm" ? "/health" : "/api/tags", port: "http" }, periodSeconds: 10, failureThreshold: 120 },
            readinessProbe: { httpGet: { path: config.engine === "vllm" ? "/health" : "/api/tags", port: "http" }, periodSeconds: 10, failureThreshold: 3 },
          }],
          volumes: volumes.length ? volumes : undefined,
          nodeSelector: { "accelerator.present": "true" },
          tolerations: [{ key: "nvidia.com/gpu", operator: "Exists", effect: "NoSchedule" }],
        },
      },
    },
  };
  const service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name: config.name, labels },
    spec: { type: "ClusterIP", selector: { app: config.name }, ports: [{ name: "http", port: config.port, targetPort: "http" }] },
  };
  return [deployment, service].map((item) => YAML.stringify(item, { indent: 2, lineWidth: 0 }).trim()).join("\n---\n") + "\n";
}

export function generateEnv(config: DeploymentConfig) {
  if (config.target !== "docker" || !config.enableApiKey) return "# No local secrets required for this deployment.\n";
  return `LLM_API_KEY=${config.apiKey}\n`;
}

export function estimateMemory(config: DeploymentConfig) {
  const assumedGpuMemory = config.gpuCount >= 8 ? 80 : 8;
  const total = config.gpuCount * assumedGpuMemory;
  return {
    totalGiB: total,
    reservedGiB: Math.round(total * (1 - config.gpuMemoryUtilization)),
    note: config.gpuCount >= 8 ? "按 A100 80GB 预估，请按实机修改" : "按 8GB 单卡预估，请按实机修改",
  };
}
