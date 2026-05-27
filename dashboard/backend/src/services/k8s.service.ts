import { k8sAppsApi, k8sCoreApi } from '../k8s-client.js';

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
