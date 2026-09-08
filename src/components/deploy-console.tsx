"use client";

import {
  Activity,
  Boxes,
  Check,
  ChevronRight,
  Clipboard,
  Code2,
  Download,
  FileCode2,
  Gauge,
  HardDrive,
  KeyRound,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Square,
  Terminal,
  TriangleAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultConfig, presets, type DeploymentConfig } from "@/lib/deployment-schema";

type CheckResult = { id: string; label: string; ok: boolean; detail: string };
type Preview = { compose: string; kubernetes: string; estimate: { totalGiB: number; reservedGiB: number; note: string } };
type DeploymentRow = {
  id: string;
  config: DeploymentConfig;
  status: { state: string; detail?: string; updatedAt: string };
};

const selectOptions = {
  quantization: [
    ["none", "不指定"],
    ["awq", "AWQ"],
    ["gptq", "GPTQ"],
    ["bitsandbytes", "BitsAndBytes"],
  ],
  dtype: [["auto", "Auto"], ["bfloat16", "BF16"], ["float16", "FP16"]],
} as const;

function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (value: number) => void; min: number; max: number; step?: number }) {
  return <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />;
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`status-dot ${ok ? "ok" : "warn"}`} aria-hidden="true" />;
}

export function DeployConsole() {
  const [config, setConfig] = useState<DeploymentConfig>(defaultConfig);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewTab, setPreviewTab] = useState<"compose" | "kubernetes">("compose");
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [logs, setLogs] = useState("");

  const update = <K extends keyof DeploymentConfig>(key: K, value: DeploymentConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));

  const loadDeployments = useCallback(async () => {
    const response = await fetch("/api/deployments");
    if (response.ok) setDeployments((await response.json()).deployments);
  }, []);

  const runPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const response = await fetch("/api/preflight");
      setChecks((await response.json()).checks);
    } finally {
      setPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runPreflight();
      void loadDeployments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDeployments, runPreflight]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          setPreviewError(data.issues?.formErrors?.[0] || Object.values(data.issues?.fieldErrors ?? {}).flat()[0] || data.error);
          setPreview(null);
          return;
        }
        setPreviewError("");
        setPreview(data);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setPreviewError("无法生成部署配置");
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [config]);

  const activePreview = previewTab === "compose" ? preview?.compose : preview?.kubernetes;
  const dockerReady = checks.find((item) => item.id === "docker")?.ok;
  const kubernetesReady = checks.find((item) => item.id === "kubernetes")?.ok;
  const executionReady = config.target === "docker" ? dockerReady : kubernetesReady;

  const commandSummary = useMemo(() => {
    if (config.engine === "ollama") return `${config.model} · Ollama · ${config.gpuCount} GPU`;
    return `${config.servedModelName} · TP ${config.tensorParallelSize} · ${config.dtype.toUpperCase()}`;
  }, [config]);

  async function copyPreview() {
    if (!activePreview) return;
    await navigator.clipboard.writeText(activePreview);
    setNotice("配置已复制到剪贴板");
  }

  function downloadPreview() {
    if (!activePreview) return;
    const blob = new Blob([activePreview], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = previewTab === "compose" ? "compose.yaml" : "deployment.yaml";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function createDeployment(execute: boolean) {
    setDeployLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, execute }),
      });
      const data = await response.json();
      setNotice(response.ok ? data.message : `操作失败：${data.message || data.error}`);
      setConfirmDeploy(false);
      await loadDeployments();
    } finally {
      setDeployLoading(false);
    }
  }

  async function deploymentAction(id: string, action: "start" | "stop" | "restart" | "logs") {
    setNotice("");
    const response = await fetch("/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await response.json();
    if (action === "logs") setLogs(data.output || "暂无日志");
    else setNotice(response.ok ? `${action} 操作完成` : `操作失败：${data.output || data.error}`);
    await loadDeployments();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Boxes size={20} /></span><span><strong>LLM Deploy</strong><small>Operations Console</small></span></div>
        <nav aria-label="主导航">
          <button className="nav-item active" title="部署工作台"><Gauge size={18} /><span>部署工作台</span></button>
          <button className="nav-item" title="运行实例"><Activity size={18} /><span>运行实例</span></button>
          <button className="nav-item" title="配置记录"><FileCode2 size={18} /><span>配置记录</span></button>
        </nav>
        <div className="sidebar-foot">
          <ShieldCheck size={17} />
          <span><strong>本地控制</strong><small>默认仅生成配置</small></span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">算力平台 / 推理服务</p><h1>模型部署工作台</h1></div>
          <div className="top-actions">
            <span className="environment"><StatusDot ok={Boolean(executionReady)} />{executionReady ? "执行环境就绪" : "预览模式"}</span>
            <button className="icon-button" onClick={runPreflight} title="重新检测环境" aria-label="重新检测环境"><RefreshCw size={17} className={preflightLoading ? "spin" : ""} /></button>
          </div>
        </header>

        <div className="content">
          {notice && <div className="notice"><Check size={17} /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="关闭"><X size={16} /></button></div>}

          <section className="preflight-strip" aria-label="环境预检">
            <div className="section-lead"><span className="step-number">01</span><div><h2>环境预检</h2><p>只读取版本与硬件状态，不安装或修改系统组件</p></div></div>
            <div className="check-list">
              {(checks.length ? checks : [
                { id: "docker", label: "Docker Engine", ok: false, detail: "检测中" },
                { id: "gpu", label: "NVIDIA GPU", ok: false, detail: "检测中" },
                { id: "kubernetes", label: "Kubernetes 连接", ok: false, detail: "检测中" },
              ]).map((item) => (
                <div className="check-item" key={item.id}><StatusDot ok={item.ok} /><div><strong>{item.label}</strong><span>{item.detail}</span></div></div>
              ))}
            </div>
          </section>

          <div className="main-grid">
            <section className="configuration-panel">
              <div className="section-heading"><span className="step-number">02</span><div><h2>部署参数</h2><p>选择模板后仍可逐项修改</p></div></div>

              <div className="preset-row">
                {presets.map((preset) => (
                  <button key={preset.id} className={config.name === preset.config.name ? "preset active" : "preset"} onClick={() => setConfig({ ...preset.config })}>
                    <Server size={18} /><span><strong>{preset.label}</strong><small>{preset.description}</small></span><ChevronRight size={16} />
                  </button>
                ))}
              </div>

              <div className="form-section">
                <h3>运行目标</h3>
                <div className="segmented">
                  <button className={config.target === "docker" ? "active" : ""} onClick={() => update("target", "docker")}><HardDrive size={16} />Docker Compose</button>
                  <button className={config.target === "kubernetes" ? "active" : ""} onClick={() => update("target", "kubernetes")}><Boxes size={16} />Kubernetes</button>
                </div>
                <div className="field-grid three">
                  <label><span>部署名称</span><input value={config.name} onChange={(e) => update("name", e.target.value)} /></label>
                  <label><span>推理引擎</span><select value={config.engine} onChange={(e) => setConfig((current) => ({ ...current, engine: e.target.value as DeploymentConfig["engine"], enableApiKey: e.target.value === "ollama" ? false : current.enableApiKey }))}><option value="vllm">vLLM</option><option value="ollama">Ollama</option></select></label>
                  <label><span>服务端口</span><NumberInput value={config.port} onChange={(v) => update("port", v)} min={1024} max={65535} /></label>
                </div>
              </div>

              <div className="form-section">
                <h3>模型与镜像</h3>
                <div className="field-grid two">
                  <label><span>镜像（固定版本）</span><input value={config.image} onChange={(e) => update("image", e.target.value)} /></label>
                  <label><span>模型来源</span><select value={config.modelSource} onChange={(e) => update("modelSource", e.target.value as DeploymentConfig["modelSource"])}><option value="huggingface">Hugging Face / 仓库 ID</option><option value="local">本地只读目录</option></select></label>
                  <label><span>{config.modelSource === "local" ? "模型目录" : "模型仓库 ID"}</span><input value={config.model} onChange={(e) => update("model", e.target.value)} /></label>
                  <label><span>服务模型名称</span><input value={config.servedModelName} onChange={(e) => update("servedModelName", e.target.value)} /></label>
                </div>
              </div>

              <div className="form-section">
                <h3>GPU 与推理</h3>
                <div className="field-grid four">
                  <label><span>GPU 数量</span><NumberInput value={config.gpuCount} onChange={(v) => update("gpuCount", v)} min={1} max={16} /></label>
                  <label><span>张量并行</span><NumberInput value={config.tensorParallelSize} onChange={(v) => update("tensorParallelSize", v)} min={1} max={16} /></label>
                  <label><span>量化格式</span><select value={config.quantization} onChange={(e) => update("quantization", e.target.value as DeploymentConfig["quantization"])}>{selectOptions.quantization.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
                  <label><span>计算精度</span><select value={config.dtype} onChange={(e) => update("dtype", e.target.value as DeploymentConfig["dtype"])}>{selectOptions.dtype.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
                  <label><span>最大上下文</span><NumberInput value={config.maxModelLen} onChange={(v) => update("maxModelLen", v)} min={512} max={262144} step={512} /></label>
                  <label className="wide"><span>GPU 显存利用上限 <b>{Math.round(config.gpuMemoryUtilization * 100)}%</b></span><input type="range" min="0.1" max="0.98" step="0.01" value={config.gpuMemoryUtilization} onChange={(e) => update("gpuMemoryUtilization", Number(e.target.value))} /></label>
                </div>
              </div>

              <div className="form-section compact">
                <h3>安全选项</h3>
                <div className="toggle-list">
                  <label className="toggle-row"><span><strong>允许模型远程代码</strong><small>仅在已审核模型仓库时开启</small></span><input type="checkbox" checked={config.trustRemoteCode} onChange={(e) => update("trustRemoteCode", e.target.checked)} /></label>
                  {config.engine === "vllm" && <label className="toggle-row"><span><strong>启用 API Key</strong><small>{config.target === "docker" ? "密钥仅写入本地运行目录" : "引用集群内已有 Secret"}</small></span><input type="checkbox" checked={config.enableApiKey} onChange={(e) => update("enableApiKey", e.target.checked)} /></label>}
                </div>
                {config.enableApiKey && config.target === "docker" && <label className="secret-field"><KeyRound size={16} /><input type="password" placeholder="API Key，至少 12 个字符" value={config.apiKey} onChange={(e) => update("apiKey", e.target.value)} /></label>}
                {config.enableApiKey && config.target === "kubernetes" && <label className="secret-field"><KeyRound size={16} /><input placeholder="预先创建的 Secret 名称" value={config.apiKeySecretName} onChange={(e) => update("apiKeySecretName", e.target.value)} /></label>}
              </div>
            </section>

            <aside className="summary-panel">
              <div className="section-heading"><span className="step-number">03</span><div><h2>执行摘要</h2><p>部署前最后确认</p></div></div>
              <div className="summary-visual">
                <div className="gpu-stack">{Array.from({ length: Math.min(config.gpuCount, 8) }).map((_, i) => <span key={i}>{i}</span>)}</div>
                <strong>{config.gpuCount} × GPU</strong><small>{commandSummary}</small>
              </div>
              <dl className="summary-list">
                <div><dt>目标</dt><dd>{config.target === "docker" ? "Docker Compose" : "Kubernetes"}</dd></div>
                <div><dt>模型</dt><dd>{config.model}</dd></div>
                <div><dt>上下文</dt><dd>{config.maxModelLen.toLocaleString()} tokens</dd></div>
                <div><dt>显存预留</dt><dd>{preview?.estimate.reservedGiB ?? "-"} GiB</dd></div>
                <div><dt>监听</dt><dd>{config.target === "docker" ? `127.0.0.1:${config.port}` : `ClusterIP:${config.port}`}</dd></div>
              </dl>
              <div className="estimate-note"><TriangleAlert size={16} /><span>{preview?.estimate.note || "等待参数校验"}</span></div>
              {previewError && <div className="validation-error"><TriangleAlert size={16} />{previewError}</div>}
              <div className="deploy-actions">
                <button className="secondary-button" disabled={!preview} onClick={() => createDeployment(false)}><FileCode2 size={17} />仅生成配置</button>
                <button className="primary-button" disabled={!preview || !executionReady} onClick={() => setConfirmDeploy(true)}><Play size={17} />执行部署</button>
              </div>
              {!executionReady && <p className="blocked-note">执行按钮已锁定：{config.target === "docker" ? "当前电脑缺少可用的 Docker Engine" : "kubectl 不可用或 Kubernetes 集群不可达"}，配置生成不受影响。</p>}
            </aside>
          </div>

          <section className="config-preview">
            <div className="preview-header">
              <div><span className="step-number">04</span><div><h2>配置预览</h2><p>由结构化参数生成，可下载后进入变更评审</p></div></div>
              <div className="preview-tools">
                <div className="tabs"><button className={previewTab === "compose" ? "active" : ""} onClick={() => setPreviewTab("compose")}>Compose</button><button className={previewTab === "kubernetes" ? "active" : ""} onClick={() => setPreviewTab("kubernetes")}>Kubernetes</button></div>
                <button className="icon-button" title="复制配置" onClick={copyPreview}><Clipboard size={16} /></button>
                <button className="icon-button" title="下载配置" onClick={downloadPreview}><Download size={16} /></button>
              </div>
            </div>
            <pre><code>{activePreview || previewError || "正在生成配置..."}</code></pre>
          </section>

          <section className="deployment-history">
            <div className="preview-header"><div><span className="step-number">05</span><div><h2>部署记录</h2><p>记录配置生成与受控执行结果</p></div></div><button className="icon-button" title="刷新记录" onClick={loadDeployments}><RefreshCw size={16} /></button></div>
            {deployments.length === 0 ? <div className="empty-state"><Terminal size={22} /><span>还没有部署记录，先生成一份配置。</span></div> : (
              <div className="table-wrap"><table><thead><tr><th>名称</th><th>引擎</th><th>目标</th><th>状态</th><th>更新时间</th><th aria-label="操作" /></tr></thead><tbody>{deployments.slice(0, 8).map((row) => (
                <tr key={row.id}><td><strong>{row.config.name}</strong><small>{row.config.servedModelName}</small></td><td>{row.config.engine}</td><td>{row.config.target}</td><td><span className={`state ${row.status.state}`}>{row.status.state}</span></td><td>{new Date(row.status.updatedAt).toLocaleString("zh-CN")}</td><td><div className="row-actions"><button title="启动" onClick={() => deploymentAction(row.id, "start")}><Play size={15} /></button><button title="停止" onClick={() => deploymentAction(row.id, "stop")}><Square size={15} /></button><button title="重启" onClick={() => deploymentAction(row.id, "restart")}><RotateCcw size={15} /></button><button title="日志" onClick={() => deploymentAction(row.id, "logs")}><Code2 size={15} /></button></div></td></tr>
              ))}</tbody></table></div>
            )}
          </section>

          {logs && <section className="log-panel"><div><h2>实例日志</h2><button onClick={() => setLogs("")}><X size={16} /></button></div><pre>{logs}</pre></section>}
        </div>
      </section>

      {confirmDeploy && <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmDeploy(false)}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(e) => e.stopPropagation()}><div className="modal-icon"><TriangleAlert size={22} /></div><h2 id="confirm-title">确认执行真实部署</h2><p>这将调用本机的 {config.target === "docker" ? "Docker Compose" : "kubectl"}。可能拉取大体积镜像或模型并占用 GPU。请确认目标环境和参数已经过评审。</p><label className="confirm-line"><span>部署对象</span><strong>{config.name}</strong></label><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmDeploy(false)}>取消</button><button className="danger-button" disabled={deployLoading} onClick={() => createDeployment(true)}>{deployLoading ? "执行中..." : "确认执行"}</button></div></section></div>}
    </main>
  );
}
