# AI Infrastructure Delivery Blueprint

## Purpose

This document defines a practical delivery model for private GPU infrastructure and local inference platforms in mainland China. It connects data-center readiness, hardware acceptance, the GPU software stack, cluster or container orchestration, model serving, observability, operational handover, and coordination with global engineering.

It is a service-delivery blueprint, not a claim that the public repository has already completed production acceptance on every hardware platform or customer site.

## Best fit

- An overseas AI company already has a mainland China customer but no complete local infrastructure team.
- An enterprise wants to deploy models inside its own data center, colocation facility, or private cloud.
- A project needs one China-based technical owner to coordinate the customer, IDC, OEM, GPU vendor, network and storage providers, and global engineering.
- A GPU environment exists but lacks repeatable deployment, monitoring, incident procedures, capacity evidence, or rollback controls.
- The customer wants a bounded pilot before committing to a larger cluster or permanent team.

## Delivery model

### Phase 1 Requirements and responsibility map

Collect and confirm:

- Business workload, model family, model size, context length, concurrency, latency and throughput targets.
- Training, fine-tuning, batch inference, online inference, or mixed workload.
- Hardware already purchased, approved vendors, procurement constraints, and expansion plan.
- Deployment location, network zones, identity, registry, storage, data flow, and remote-access policy.
- Required service hours, incident severity, change windows, release ownership, and acceptance authority.
- Responsibility matrix across the customer, global product team, local delivery team, IDC, and vendors.

**Outputs:** requirement baseline, assumptions, dependency list, risk register, RACI, and acceptance plan.

### Phase 2 IDC and site readiness

Review with the responsible facility and electrical specialists:

- Rack dimensions, weight, rail and service-clearance requirements.
- Per-rack power density, feed redundancy, PDU capacity, grounding, and power measurement.
- Cooling design, inlet temperature targets, hot/cold aisle arrangement, and high-temperature escalation.
- Fire protection, physical access, camera coverage, visitor workflow, and asset movement control.
- Carrier access, uplink diversity, management network, public/private addressing, DNS, NTP, and bastion access.
- Out-of-band management network for BMC, switch, storage, and power devices.
- Delivery route, staging area, serial-number inventory, spare parts, and vendor access procedure.

Facility conclusions that require licensed design, electrical sign-off, fire approval, structural review, or regulatory advice remain with qualified organisations.

**Outputs:** site-readiness checklist, open-item register, topology draft, installation sequence, and rollback or delay criteria.

### Phase 3 Hardware and fabric acceptance

- Record model, serial number, firmware, BIOS, BMC, NIC, HBA, GPU, switch, cable, and transceiver baselines.
- Confirm PCIe topology, NUMA placement, GPU visibility, NVLink or equivalent links, and expected peer-to-peer paths.
- Check GPU temperature, power, ECC counters, XID history, link state, memory, storage, and CPU health.
- Validate Ethernet or InfiniBand addressing, MTU, link aggregation, loss, latency, and RDMA configuration where required.
- Run an agreed burn-in and benchmark plan without treating a single synthetic score as application acceptance.
- Record failed components, vendor cases, replacement status, and retest evidence.

**Outputs:** asset baseline, firmware matrix, health report, burn-in evidence, vendor issue log, and signed hardware gate.

### Phase 4 Operating system and GPU software stack

- Pin the supported OS, kernel, firmware, driver, runtime, container toolkit, and inference-framework matrix.
- Install NVIDIA CUDA or the applicable domestic GPU stack such as CANN, DTK, or Neuware according to vendor support requirements.
- Validate container runtime, device exposure, time synchronization, DNS, package sources, registry access, and proxy boundaries.
- Establish immutable or repeatable node configuration, upgrade order, drain procedure, rollback package, and recovery media.
- Keep credentials and registry tokens in an approved secret system rather than images, scripts, or Git history.

**Outputs:** compatibility matrix, node build record, validation results, upgrade and rollback procedure, and known-issue register.

### Phase 5 Scheduling storage and platform integration

Select Kubernetes, Slurm, a vendor platform, or a bounded combination based on the actual workload rather than fashion.

- Define node labels, GPU resources, quotas, priority, preemption, reservations, and maintenance states.
- Integrate the image registry, model repository, shared storage, local cache, checkpoint path, and backup policy.
- Validate network policies, ingress, service discovery, authentication, RBAC, audit, and tenant boundaries.
- Confirm how jobs recover from node loss, pod restart, storage interruption, queue delay, and partial cluster maintenance.
- Preserve a manual or documented recovery path when the control plane is unavailable.

**Outputs:** platform configuration, scheduling policy, storage and network checks, access model, and recovery runbook.

### Phase 6 Model serving and performance baseline

- Deploy an agreed vLLM, Ollama, TensorRT-LLM, SGLang, or vendor-supported runtime after compatibility review.
- Record model source, checksum, precision, quantization, tensor or pipeline parallelism, context settings, batch controls, and memory limits.
- Measure time to first token, inter-token latency, tokens per second, P50/P95/P99 latency, request failures, GPU utilization, memory utilization, and queue depth.
- Test representative prompts and concurrency rather than relying only on a framework benchmark.
- Define version rollout, canary or blue-green strategy, health gates, rollback, and model-cache handling.

**Outputs:** deployment manifest, parameter record, performance baseline, capacity assumptions, release procedure, and rollback evidence.

### Phase 7 Observability incident response and handover

- Monitor host health, GPU temperature and power, ECC, XID, throttling, utilization, memory, PCIe or fabric links, storage, network, and service-level indicators.
- Define alert ownership, severity, escalation, vendor contacts, evidence collection, maintenance windows, and after-hours boundaries.
- Build dashboards for infrastructure, scheduler, model service, customer-facing latency, capacity, and change status.
- Run controlled failure and recovery exercises that are safe for the agreed environment.
- Deliver architecture, inventory, credentials handover procedure, SOPs, runbooks, known issues, training, and acceptance records.

**Outputs:** dashboards, alert matrix, incident SOP, recovery evidence, operations manual, knowledge transfer, and final acceptance record.

## Acceptance evidence

A production claim should be supported by environment-specific evidence such as:

- Signed inventory and firmware or software compatibility baseline.
- Repeatable node and platform health checks.
- Representative performance and capacity results with test conditions.
- Monitoring coverage and alert delivery evidence.
- Release, rollback, backup, restore, and failure-recovery records.
- Open-risk register with named owners and dates.
- Customer or authorised acceptance against written criteria.

Local previews, generated YAML, a successful build, or a single benchmark do not replace those gates.

## Engagement shapes

| Engagement | Typical scope | Main outcome |
| --- | --- | --- |
| AI infrastructure readiness assessment | Requirements, site, vendors, architecture, risks, acceptance | Written decision and phased delivery plan |
| Single-node or small-cluster pilot | One bounded environment and model-serving path | Reproducible deployment, baseline, runbook, and rollback |
| Private AI room delivery coordination | IDC, OEM, network, storage, GPU stack, platform and handover | One accountable technical coordination and acceptance path |
| Fractional China AI infrastructure lead | Customer issues, vendors, change review, incidents and global-team communication | Ongoing China-side technical ownership |

Every engagement requires named systems, access rules, working hours, exclusions, dependencies, deliverables, and acceptance criteria. Hardware, cloud, IDC, licences, travel, taxes, specialist work, and 24/7 coverage are quoted separately.

## Delivery team and boundaries

Han Xiaochi can lead requirements, operational design, Linux and platform coordination, monitoring, incident processes, documentation, customer communication, and acceptance management. Scoped full-stack engineers can extend internal-tool and integration delivery.

Deep electrical design, fire approval, structural engineering, legal or regulatory advice, specialised network-fabric design, and hardware-vendor certification remain with named qualified partners. Large production Kubernetes, Slurm, storage, or accelerator-specific architecture is staffed and disclosed according to the verified project scope.

## Relationship to this repository

The LLM Deploy Console can support the parameter-review, configuration-generation, execution-gate, local-record, and lifecycle portions of this blueprint. It does not automate facility engineering, procurement, firmware acceptance, network design, production identity, or customer approval. Those remain explicit delivery work packages with human ownership.
