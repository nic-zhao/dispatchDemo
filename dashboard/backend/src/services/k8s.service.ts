import { k8sAppsApi, k8sCoreApi, k8sCustomApi } from '../k8s-client.js';
import * as k8s from '@kubernetes/client-node';

/** Kubeflow training job CRD types to discover */
const KF_JOB_TYPES = [
  { plural: 'pytorchjobs', label: 'PyTorchJob' },
  { plural: 'tfjobs', label: 'TFJob' },
  { plural: 'mpijobs', label: 'MPIJob' },
  { plural: 'paddlejobs', label: 'PaddleJob' },
  { plural: 'mxjobs', label: 'MXJob' },
  { plural: 'xgboostjobs', label: 'XGBoostJob' },
] as const;

export interface CreateDeploymentParams {
  name: string;
  namespace: string;
  image: string;
  command?: string[];
  args?: string[];
  vgpuNumber: number;
  vgpuMemory: number;
  vgpuCores: number;
  cpu?: string;
  memory?: string;
  ports?: number[];
  env?: Record<string, string>;
  volumes?: { name: string; mountPath: string; hostPath: string }[];
}

export interface ResourceOverview {
  gpu: { used: number; total: number };
  cpu: { used: string; total: string };
  memory: { used: string; total: string };
  runningDeployments: number;
}

export async function getNodeResources(): Promise<ResourceOverview> {
  // Dynamically list nodes instead of hardcoding a name
  const nodeList: any = await k8sCoreApi.listNode();
  const node = nodeList.items[0];
  if (!node) {
    throw new Error('No nodes found in the cluster');
  }
  const capacity = node.status!.capacity!;
  const allocatable = node.status!.allocatable!;

  // Get all deployments across namespaces
  const depList: any = await k8sAppsApi.listDeploymentForAllNamespaces();
  const deployments = depList.items.filter(
    (d: any) => !d.metadata!.namespace!.startsWith('kube-') &&
           !d.metadata!.namespace!.startsWith('volcano-') &&
           d.metadata!.namespace !== 'kubeflow'
  );

  const runningCount = deployments.filter(
    (d: any) => d.status!.readyReplicas === d.status!.replicas
  ).length;

  // Calculate vGPU allocated from Deployments
  let vgpuUsed = 0;
  for (const dep of deployments) {
    const containers = dep.spec!.template.spec!.containers || [];
    for (const c of containers) {
      const limits = c.resources?.limits || {};
      if (limits['volcano.sh/vgpu-number']) {
        const replicas = dep.spec!.replicas || 1;
        vgpuUsed += parseInt(limits['volcano.sh/vgpu-number']) * replicas;
      }
    }
  }

  // Also count vGPU from Kubeflow training jobs
  for (const jt of KF_JOB_TYPES) {
    try {
      const res: any = await k8sCustomApi.listClusterCustomObject({
        group: 'kubeflow.org',
        version: 'v1',
        plural: jt.plural,
      });
      const items = (res.items || []).filter(
        (item: any) => !isSystemNamespace(item.metadata?.namespace),
      );
      for (const job of items) {
        vgpuUsed += calcJobVgpu(job);
      }
    } catch {
      // CRD may not be registered, skip silently
    }
  }

  return {
    gpu: {
      used: vgpuUsed,
      total: parseInt(capacity['volcano.sh/vgpu-number'] || '0'),
    },
    cpu: {
      used: allocatable['cpu'] || '0',
      total: capacity['cpu'] || '0',
    },
    memory: {
      used: allocatable['memory'] || '0',
      total: capacity['memory'] || '0',
    },
    runningDeployments: runningCount,
  };
}

export async function getRunningDeployments() {
  // 1. Fetch K8s Deployments
  const depList: any = await k8sAppsApi.listDeploymentForAllNamespaces();
  const deployments = depList.items.filter(
    (d: any) => !isSystemNamespace(d.metadata!.namespace!),
  );

  const result = deployments.map((d: any) => ({
    kind: 'Deployment' as const,
    name: d.metadata!.name!,
    namespace: d.metadata!.namespace!,
    image: d.spec!.template.spec!.containers[0]?.image || '',
    replicas: d.spec!.replicas || 0,
    readyReplicas: d.status!.readyReplicas || 0,
    createdAt: d.metadata!.creationTimestamp || '',
    vgpu: parseInt(
      d.spec!.template.spec!.containers[0]?.resources?.limits?.['volcano.sh/vgpu-number'] || '0'
    ),
  }));

  // 2. Fetch Kubeflow training jobs (PyTorchJob, TFJob, MPIJob, etc.)
  for (const jt of KF_JOB_TYPES) {
    try {
      const res: any = await k8sCustomApi.listClusterCustomObject({
        group: 'kubeflow.org',
        version: 'v1',
        plural: jt.plural,
      });
      const items = (res.items || []).filter(
        (item: any) => !isSystemNamespace(item.metadata?.namespace),
      );
      for (const job of items) {
        const status = parseJobStatus(job);
        const vgpu = calcJobVgpu(job);
        const image = extractJobImage(job);
        result.push({
          kind: jt.label,
          name: job.metadata.name,
          namespace: job.metadata.namespace,
          image,
          replicas: status.totalReplicas,
          readyReplicas: status.readyReplicas,
          createdAt: job.metadata.creationTimestamp || '',
          vgpu,
        });
      }
    } catch {
      // CRD may not be registered, skip silently
    }
  }

  return result;
}

export async function createDeployment(params: CreateDeploymentParams) {
  const {
    name, namespace, image, command, args,
    vgpuNumber, vgpuMemory, vgpuCores,
    cpu, memory, ports, env, volumes,
  } = params;

  const container: any = {
    name,
    image,
    resources: {
      limits: {
        'volcano.sh/vgpu-number': String(vgpuNumber),
        'volcano.sh/vgpu-memory': String(vgpuMemory),
        'volcano.sh/vgpu-cores': String(vgpuCores),
      } as Record<string, string>,
    },
  };

  if (cpu) container.resources.limits['cpu'] = cpu;
  if (memory) container.resources.limits['memory'] = memory;
  if (command) container.command = command;
  if (args) container.args = args;

  if (ports && ports.length > 0) {
    container.ports = ports.map((p) => ({ containerPort: p }));
  }

  if (env && Object.keys(env).length > 0) {
    container.env = Object.entries(env).map(([key, value]) => ({ name: key, value }));
  }

  const volumeMounts: { name: string; mountPath: string }[] = [];
  const volumeDefs: { name: string; hostPath: { path: string; type: string } }[] = [];

  if (volumes && volumes.length > 0) {
    for (const v of volumes) {
      volumeMounts.push({ name: v.name, mountPath: v.mountPath });
      volumeDefs.push({ name: v.name, hostPath: { path: v.hostPath, type: 'DirectoryOrCreate' as const } });
    }
    container.volumeMounts = volumeMounts;
  }

  const deployment: k8s.V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name, namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          schedulerName: 'volcano',
          containers: [container],
          ...(volumeDefs.length > 0 ? { volumes: volumeDefs } : {}),
        },
      },
    },
  };

  const result: any = await k8sAppsApi.createNamespacedDeployment({ namespace, body: deployment });

  // Auto-create NodePort Service for each port
  if (ports && ports.length > 0) {
    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: `${name}-svc`, namespace, labels: { app: name } },
      spec: {
        type: 'NodePort',
        selector: { app: name },
        ports: ports.map((port) => ({ port, targetPort: port, protocol: 'TCP' })),
      },
    };
    try {
      await k8sCoreApi.createNamespacedService({ namespace, body: service });
    } catch {
      // Service may already exist, ignore
    }
  }

  return result;
}

export async function deleteDeployment(name: string, namespace: string) {
  // Delete associated Service first
  try {
    await k8sCoreApi.deleteNamespacedService({ name: `${name}-svc`, namespace });
  } catch {
    // Service may not exist, ignore
  }
  const result: any = await k8sAppsApi.deleteNamespacedDeployment({ name, namespace });
  return result;
}

export async function scaleDeployment(name: string, namespace: string, replicas: number) {
  const dep: any = await k8sAppsApi.readNamespacedDeployment({ name, namespace });
  dep.spec!.replicas = replicas;
  const result: any = await k8sAppsApi.replaceNamespacedDeployment({ name, namespace, body: dep });
  return result;
}

export async function getDeploymentDetail(name: string, namespace: string) {
  const dep: any = await k8sAppsApi.readNamespacedDeployment({ name, namespace });

  const podList: any = await k8sCoreApi.listNamespacedPod({
    namespace,
    labelSelector: `app=${name}`,
  });

  const svcList: any = await k8sCoreApi.listNamespacedService({
    namespace,
    labelSelector: `app=${name}`,
  });

  const endpoints = (svcList.items || []).map((s: any) => {
    const nodePort = s.spec?.type === 'NodePort' ? s.spec.ports?.[0]?.nodePort : null;
    const port = s.spec?.ports?.[0]?.port || 0;
    return {
      name: s.metadata!.name,
      type: s.spec?.type || '',
      port,
      nodePort,
      url: nodePort ? `http://<node-ip>:${nodePort}` : null,
    };
  });

  return {
    kind: 'Deployment',
    name: dep.metadata!.name,
    namespace: dep.metadata!.namespace,
    image: dep.spec!.template.spec!.containers[0]?.image || '',
    replicas: dep.spec!.replicas || 0,
    readyReplicas: dep.status!.readyReplicas || 0,
    createdAt: dep.metadata!.creationTimestamp || '',
    vgpu: parseInt(
      dep.spec!.template.spec!.containers[0]?.resources?.limits?.['volcano.sh/vgpu-number'] || '0'
    ),
    vgpuMemory: parseInt(
      dep.spec!.template.spec!.containers[0]?.resources?.limits?.['volcano.sh/vgpu-memory'] || '0'
    ),
    pods: (podList.items || []).map((p: any) => ({
      name: p.metadata!.name,
      status: p.status!.phase,
      restarts: p.status!.containerStatuses?.[0]?.restartCount || 0,
      ip: p.status!.podIP || '',
    })),
    endpoints,
  };
}

// ── Pods ────────────────────────────────────────────────────────────

export async function getAllPods() {
  const podList: any = await k8sCoreApi.listPodForAllNamespaces();
  const pods = podList.items.filter(
    (p: any) => !isSystemNamespace(p.metadata!.namespace!),
  );

  return pods.map((p: any) => {
    const owner = resolveOwner(p);

    return {
      name: p.metadata!.name,
      namespace: p.metadata!.namespace,
      status: p.status!.phase,
      restarts: p.status!.containerStatuses?.[0]?.restartCount || 0,
      ip: p.status!.podIP || '',
      image: p.spec!.containers[0]?.image || '',
      node: p.spec!.nodeName || '',
      createdAt: p.metadata!.creationTimestamp || '',
      owner: owner
        ? `${owner.kind}/${owner.name}`
        : '-',
    };
  });
}

export async function getPodDetail(name: string, namespace: string) {
  const p: any = await k8sCoreApi.readNamespacedPod({ name, namespace });
  const owner = resolveOwner(p);

  const containers = (p.spec!.containers || []).map((c: any) => ({
    name: c.name,
    image: c.image,
  }));

  const conditions = (p.status?.conditions || []).map((c: any) => ({
    type: c.type,
    status: c.status,
    reason: c.reason || '',
    message: c.message || '',
  }));

  return {
    name: p.metadata!.name,
    namespace: p.metadata!.namespace,
    status: p.status!.phase,
    restarts: p.status!.containerStatuses?.[0]?.restartCount || 0,
    ip: p.status!.podIP || '',
    node: p.spec!.nodeName || '',
    createdAt: p.metadata!.creationTimestamp || '',
    owner: owner
      ? `${owner.kind}/${owner.name}`
      : '-',
    containers,
    conditions,
    labels: p.metadata!.labels || {},
  };
}

export async function deletePod(name: string, namespace: string) {
  const result: any = await k8sCoreApi.deleteNamespacedPod({ name, namespace });
  return result;
}

function resolveOwner(pod: any): { kind: string; name: string } | null {
  const refs = pod.metadata?.ownerReferences;
  if (!refs || refs.length === 0) return null;

  const direct = refs[0];
  if (direct.kind === 'ReplicaSet') {
    const rsName = direct.name;
    const deploymentName = rsName.replace(/-[\w]+$/, '');
    return { kind: 'Deployment', name: deploymentName };
  }

  return { kind: direct.kind, name: direct.name };
}

// ── Helpers for Kubeflow training jobs ──────────────────────────────

function isSystemNamespace(ns: string): boolean {
  return ns.startsWith('kube-') ||
         ns.startsWith('volcano-') ||
         ns === 'kubeflow';
}

/** Sum vGPU across all replica specs of a training job */
function calcJobVgpu(job: any): number {
  let total = 0;
  const specs = job.spec?.pytorchReplicaSpecs ||
                job.spec?.tfReplicaSpecs ||
                job.spec?.mpiReplicaSpecs ||
                job.spec?.paddleReplicaSpecs ||
                job.spec?.mxReplicaSpecs ||
                job.spec?.xgboostReplicaSpecs ||
                {};
  for (const replicaSpec of Object.values(specs) as any[]) {
    const replicas = replicaSpec.replicas || 1;
    const containers = replicaSpec.template?.spec?.containers || [];
    for (const c of containers) {
      const vgpu = c.resources?.limits?.['volcano.sh/vgpu-number'];
      if (vgpu) {
        total += parseInt(vgpu) * replicas;
      }
    }
  }
  return total;
}

/** Extract the first container image from a training job */
function extractJobImage(job: any): string {
  const specs = job.spec?.pytorchReplicaSpecs ||
                job.spec?.tfReplicaSpecs ||
                job.spec?.mpiReplicaSpecs ||
                job.spec?.paddleReplicaSpecs ||
                job.spec?.mxReplicaSpecs ||
                job.spec?.xgboostReplicaSpecs ||
                {};
  for (const replicaSpec of Object.values(specs) as any[]) {
    const container = replicaSpec.template?.spec?.containers?.[0];
    if (container?.image) return container.image;
  }
  return '';
}

/** Parse training job status into total/ready replica counts */
function parseJobStatus(job: any): { totalReplicas: number; readyReplicas: number } {
  const conditions = job.status?.conditions || [];
  const lastCond = conditions[conditions.length - 1];

  // Count total replicas from spec
  const specs = job.spec?.pytorchReplicaSpecs ||
                job.spec?.tfReplicaSpecs ||
                job.spec?.mpiReplicaSpecs ||
                job.spec?.paddleReplicaSpecs ||
                job.spec?.mxReplicaSpecs ||
                job.spec?.xgboostReplicaSpecs ||
                {};
  let totalReplicas = 0;
  for (const replicaSpec of Object.values(specs) as any[]) {
    totalReplicas += replicaSpec.replicas || 1;
  }

  // Determine ready count from status
  let readyReplicas = 0;
  if (lastCond?.type === 'Succeeded' && lastCond?.status === 'True') {
    readyReplicas = totalReplicas; // Job completed successfully
  } else if (lastCond?.type === 'Failed' && lastCond?.status === 'True') {
    readyReplicas = 0;
  } else if (lastCond?.type === 'Running' && lastCond?.status === 'True') {
    readyReplicas = totalReplicas; // All replicas running
  } else if (job.status?.replicaStatuses) {
    // Fallback: count active replicas from status
    for (const rs of Object.values(job.status.replicaStatuses) as any[]) {
      readyReplicas += rs?.active || 0;
    }
  }

  return { totalReplicas, readyReplicas };
}
