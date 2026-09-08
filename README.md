# LLM Deploy Console

A lightweight, local-first deployment console for GPU inference services. It turns reviewed form parameters into reproducible Docker Compose and Kubernetes manifests, then optionally executes a tightly scoped deployment command.

The project is designed as an operations tool, not a model downloader disguised as a dashboard. Preview-only mode is the default. Real deployment requires an explicit second confirmation and an available Docker Engine or Kubernetes client.

## Features

- Read-only preflight checks for Docker, NVIDIA GPUs, and kubectl
- Parameter presets for an 8 × A100 node, single-GPU validation, and Ollama POC
- vLLM and Ollama configuration
- GPU count, tensor parallelism, quantization, dtype, context, memory ratio, port, model source, and API key controls
- Deterministic Docker Compose and Kubernetes YAML generation through a YAML serializer
- Preview, copy, and download before execution
- Local deployment records, status, lifecycle actions, and log viewing
- Fixed command execution without passing form values through a shell
- Runtime data and secrets excluded from Git

## Safety model

The console does not install drivers, Docker, Kubernetes, CUDA, or Python packages. Preflight runs only fixed version and inventory commands. Configuration generation does not pull images or models and does not use the GPU.

Real deployment is disabled unless Docker is responsive or both kubectl and its target cluster are available. When enabled, the server invokes only these fixed command families:

```text
docker compose ... up|start|stop|restart|logs
kubectl apply -f <generated-manifest>
kubectl scale|rollout restart|logs deployment/<validated-name>
```

All form input is validated with Zod. YAML is generated from structured objects rather than shell strings. Deployment IDs are allowlisted before filesystem access. API keys are removed from the deployment metadata record; Docker secrets exist only in the ignored runtime `.env` file. Kubernetes deployments reference an existing Secret instead of serializing its value into YAML.

## Run locally

Requirements: Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run lint
npm run build
npm audit
```

## Production notes

The included images and resource values are reviewable defaults, not universal production recommendations. Before running a real workload, pin image digests and validate the exact model, quantization backend, GPU topology, driver/runtime matrix, storage path, API authentication, context length, concurrency, and rollback plan.

For Kubernetes, replace the sample CPU/memory values and node selector with cluster policy. When API authentication is enabled, create the referenced Secret with key `api-key` before applying the manifest; execution fails early when it is absent. Do not expose the inference port directly to an untrusted network.

## Architecture

```text
Browser UI
  -> validated API request
  -> structured Compose/Kubernetes generator
  -> preview and local deployment record
  -> explicit confirmation
  -> fixed Docker or kubectl command
```

Deployment records are written to `runtime/deployments/` and intentionally ignored by Git.

## Scope

This first version intentionally avoids user management, a database, remote SSH execution, background queues, model downloads, and cluster-wide administration. Those features should only be added with a real authentication, authorization, audit, and secret-management design.
