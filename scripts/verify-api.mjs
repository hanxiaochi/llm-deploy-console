import assert from "node:assert/strict";
import YAML from "yaml";

const baseUrl = process.env.CONSOLE_URL || "http://127.0.0.1:3107";
const baseConfig = {
  name: "api-verification",
  target: "docker",
  engine: "vllm",
  image: "vllm/vllm-openai:v0.10.1.1",
  modelSource: "huggingface",
  model: "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
  servedModelName: "deepseek-r1-1.5b",
  gpuCount: 1,
  tensorParallelSize: 1,
  quantization: "none",
  dtype: "float16",
  maxModelLen: 4096,
  gpuMemoryUtilization: 0.82,
  port: 8001,
  trustRemoteCode: false,
  enableApiKey: true,
  apiKey: "local-test-key-only",
  apiKeySecretName: "llm-api-key",
};

async function generate(config) {
  const response = await fetch(`${baseUrl}/api/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return { response, body: await response.json() };
}

const composeResult = await generate(baseConfig);
assert.equal(composeResult.response.status, 200);
assert.doesNotThrow(() => YAML.parse(composeResult.body.compose));
assert.match(composeResult.body.compose, /\$\{LLM_API_KEY\}/);
assert.doesNotMatch(composeResult.body.compose, /local-test-key-only/);

const kubernetesResult = await generate({ ...baseConfig, target: "kubernetes", apiKey: "" });
assert.equal(kubernetesResult.response.status, 200);
const documents = YAML.parseAllDocuments(kubernetesResult.body.kubernetes);
assert.equal(documents.length, 2);
assert.ok(documents.every((document) => document.errors.length === 0));
assert.match(kubernetesResult.body.kubernetes, /name: llm-api-key/);
assert.match(kubernetesResult.body.kubernetes, /\$\(LLM_API_KEY\)/);
assert.match(kubernetesResult.body.kubernetes, /port: 8001/);

const invalidResult = await generate({ ...baseConfig, tensorParallelSize: 2 });
assert.equal(invalidResult.response.status, 400);

console.log("API verification passed: Compose YAML, Kubernetes YAML, secret references, and validation.");
