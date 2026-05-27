import { k8sAppsApi, k8sCoreApi } from '../k8s-client.js';
import * as k8s from '@kubernetes/client-node';

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
  const node: any = await k8sCoreApi.readNode({ name: 'nic' });
  const capacity = node.status!.capacity!;
  const allocatable = node.status!.allocatable!;

  // Get all deployments across namespaces
  const depList: any = await k8sAppsApi.listDeploymentForAllNamespaces();
  const deployments = depList.items.filter(
    (d) => !d.metadata!.namespace!.startsWith('kube-') &&
           !d.metadata!.namespace!.startsWith('volcano-') &&
           d.metadata!.namespace !== 'kubeflow'
  );

  const runningCount = deployments.filter(
    (d) => d.status!.readyReplicas === d.status!.replicas
  ).length;

  // Calculate vGPU allocated
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
  const depList: any = await k8sAppsApi.listDeploymentForAllNamespaces();
  const deployments = depList.items.filter(
    (d) => !d.metadata!.namespace!.startsWith('kube-') &&
           !d.metadata!.namespace!.startsWith('volcano-') &&
           d.metadata!.namespace !== 'kubeflow'
  );

  return deployments.map((d) => ({
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
  return result;
}

export async function deleteDeployment(name: string, namespace: string) {
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

  const services = (svcList.items || []).map((s: any) => ({
    name: s.metadata!.name,
    type: s.spec!.type,
    clusterIP: s.spec!.clusterIP,
    ports: (s.spec!.ports || []).map((p: any) => ({
      port: p.port,
      targetPort: p.targetPort,
      nodePort: p.nodePort,
    })),
  }));

  return {
    deployment: {
      name: dep.metadata!.name,
      namespace: dep.metadata!.namespace,
      image: dep.spec!.template.spec!.containers[0]?.image || '',
      replicas: dep.spec!.replicas || 0,
      readyReplicas: dep.status!.readyReplicas || 0,
      createdAt: dep.metadata!.creationTimestamp || '',
      labels: dep.metadata!.labels || {},
    },
    pods: (podList.items || []).map((p: any) => ({
      name: p.metadata!.name,
      status: p.status!.phase,
      nodeName: p.spec!.nodeName,
      startTime: p.status!.startTime,
      containers: (p.status!.containerStatuses || []).map((c: any) => ({
        name: c.name,
        ready: c.ready,
        restartCount: c.restartCount,
        image: c.image,
      })),
    })),
    services,
  };
}
