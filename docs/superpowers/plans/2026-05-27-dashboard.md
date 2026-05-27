# AI 算力租赁 Dashboard Demo 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个对接真实 K3S 集群的 Dashboard Demo，演示 AI 算力弹性部署能力。

**Architecture:** React + Vite 前端通过 Express BFF 后端聚合 K3S + Volcano API。BFF 层处理 K8s API 调用、数据转换、日志流代理。前端使用 shadcn/ui 组件库，HuggingFace 简洁风格。

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Express, @kubernetes/client-node

---

## File Structure

```
dashboard/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── components.json                  # shadcn/ui config
│   ├── src/
│   │   ├── main.tsx                     # 入口
│   │   ├── App.tsx                      # 路由 + 布局
│   │   ├── lib/
│   │   │   └── utils.ts                # shadcn cn() 工具
│   │   ├── api/
│   │   │   └── client.ts               # fetch 封装
│   │   ├── components/
│   │   │   ├── ui/                      # shadcn/ui 组件
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx          # 左侧导航
│   │   │   │   └── AppLayout.tsx        # 整体布局壳
│   │   │   ├── ResourceCard.tsx         # 资源概览卡片
│   │   │   ├── StatusBadge.tsx          # 状态标签
│   │   │   └── LogViewer.tsx            # 日志流查看器
│   │   └── pages/
│   │       ├── OverviewPage.tsx         # 概览
│   │       ├── DeploymentsPage.tsx      # 弹性部署列表
│   │       ├── DeploymentDetailPage.tsx  # 部署详情
│   │       ├── CreateDeploymentModal.tsx # 创建部署弹窗
│   │       ├── ImagesPage.tsx           # 镜像仓库
│   │       └── ResourcesPage.tsx        # 集群资源
│   └── public/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                     # Express 入口
│   │   ├── k8s-client.ts               # K8s API 客户端初始化
│   │   ├── routes/
│   │   │   ├── overview.ts
│   │   │   ├── deployments.ts
│   │   │   ├── images.ts
│   │   │   └── resources.ts
│   │   └── services/
│   │       ├── k8s.service.ts           # K8s API 调用封装
│   │       └── images.service.ts        # 镜像列表（本地+社区）
│   └── data/
│       └── community-images.json        # 社区镜像预置数据
└── README.md
```

---

### Task 1: 项目脚手架 — 后端

**Files:**
- Create: `dashboard/backend/package.json`
- Create: `dashboard/backend/tsconfig.json`
- Create: `dashboard/backend/src/index.ts`
- Create: `dashboard/backend/src/k8s-client.ts`

- [ ] **Step 1: 创建后端目录并初始化**

```bash
mkdir -p dashboard/backend/src
cd dashboard/backend
cat > package.json << 'PKGJSON'
{
  "name": "dashboard-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@kubernetes/client-node": "^1.0.0",
    "cors": "^2.8.5",
    "express": "^4.21.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
PKGJSON
npm install
```

- [ ] **Step 2: 创建 tsconfig.json**

```bash
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
TSCONFIG
```

- [ ] **Step 3: 创建 K8s 客户端初始化**

```typescript
// dashboard/backend/src/k8s-client.ts
import * as k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

export const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
export const k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
export const k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
export const kcConfig = kc;
```

- [ ] **Step 4: 创建 Express 入口（含 CORS 和健康检查）**

```typescript
// dashboard/backend/src/index.ts
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`BFF server running on http://localhost:${PORT}`);
});

export default app;
```

- [ ] **Step 5: 验证后端启动**

```bash
cd dashboard/backend
npx tsx src/index.ts &
sleep 2
curl http://localhost:3001/api/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 6: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/backend/
git commit -m "feat: scaffold backend with Express + K8s client"
```

---

### Task 2: 后端 — Overview API

**Files:**
- Create: `dashboard/backend/src/services/k8s.service.ts`
- Create: `dashboard/backend/src/routes/overview.ts`
- Modify: `dashboard/backend/src/index.ts`

- [ ] **Step 1: 创建 K8s 服务层 — 节点资源查询**

```typescript
// dashboard/backend/src/services/k8s.service.ts
import { k8sAppsApi, k8sCoreApi } from '../k8s-client.js';

export interface ResourceOverview {
  gpu: { used: number; total: number };
  cpu: { used: string; total: string };
  memory: { used: string; total: string };
  runningDeployments: number;
}

export async function getNodeResources(): Promise<ResourceOverview> {
  const nodeRes = await k8sCoreApi.readNode('nic');
  const node = nodeRes.body;
  const capacity = node.status!.capacity!;
  const allocatable = node.status!.allocatable!;

  // 获取所有 namespace 的 deployments
  const depRes = await k8sAppsApi.listDeploymentForAllNamespaces();
  const deployments = depRes.body.items.filter(
    (d) => !d.metadata!.namespace!.startsWith('kube-') &&
           !d.metadata!.namespace!.startsWith('volcano-') &&
           d.metadata!.namespace !== 'kubeflow'
  );

  const runningCount = deployments.filter(
    (d) => d.status!.readyReplicas === d.status!.replicas
  ).length;

  // 计算 vGPU 已分配
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
  const depRes = await k8sAppsApi.listDeploymentForAllNamespaces();
  const deployments = depRes.body.items.filter(
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
```

- [ ] **Step 2: 创建 Overview 路由**

```typescript
// dashboard/backend/src/routes/overview.ts
import { Router } from 'express';
import { getNodeResources, getRunningDeployments } from '../services/k8s.service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [resources, deployments] = await Promise.all([
      getNodeResources(),
      getRunningDeployments(),
    ]);
    res.json({ resources, deployments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 3: 注册路由到 Express 入口**

在 `dashboard/backend/src/index.ts` 中添加路由导入和注册：

```typescript
// 在 import 区域添加
import overviewRouter from './routes/overview.js';

// 在 app.get('/api/health'...) 之后添加
app.use('/api/overview', overviewRouter);
```

- [ ] **Step 4: 验证 Overview API**

```bash
cd dashboard/backend
npx tsx src/index.ts &
sleep 2
curl http://localhost:3001/api/overview | python3 -m json.tool
# Expected: JSON with resources (gpu/cpu/memory) and deployments array
kill %1
```

- [ ] **Step 5: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/backend/
git commit -m "feat: add overview API with node resources and deployment list"
```

---

### Task 3: 后端 — Deployments API (CRUD + 日志流)

**Files:**
- Create: `dashboard/backend/src/routes/deployments.ts`
- Modify: `dashboard/backend/src/services/k8s.service.ts`
- Modify: `dashboard/backend/src/index.ts`

- [ ] **Step 1: 扩展 K8s 服务层 — Deployment CRUD**

在 `dashboard/backend/src/services/k8s.service.ts` 末尾追加：

```typescript
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

export async function createDeployment(params: CreateDeploymentParams) {
  const containerPorts = (params.ports || []).map((p) => ({
    containerPort: p,
  }));

  const envVars = Object.entries(params.env || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const volumeMounts = (params.volumes || []).map((v) => ({
    name: v.name,
    mountPath: v.mountPath,
  }));

  const volumes = (params.volumes || []).map((v) => ({
    name: v.name,
    hostPath: { path: v.hostPath, type: 'DirectoryOrCreate' as const },
  }));

  const body: k8s.V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: params.name, namespace: params.namespace },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: params.name } },
      template: {
        metadata: { labels: { app: params.name } },
        spec: {
          schedulerName: 'volcano',
          containers: [
            {
              name: params.name,
              image: params.image,
              command: params.command,
              args: params.args,
              ports: containerPorts,
              env: envVars.length > 0 ? envVars : undefined,
              resources: {
                limits: {
                  'volcano.sh/vgpu-number': String(params.vgpuNumber),
                  'volcano.sh/vgpu-memory': String(params.vgpuMemory),
                  'volcano.sh/vgpu-cores': String(params.vgpuCores),
                  ...(params.cpu ? { cpu: params.cpu } : {}),
                  ...(params.memory ? { memory: params.memory } : {}),
                },
              },
              volumeMounts: volumeMounts.length > 0 ? volumeMounts : undefined,
            },
          ],
          volumes: volumes.length > 0 ? volumes : undefined,
        },
      },
    },
  };

  const res = await k8sAppsApi.createNamespacedDeployment(params.namespace, body);
  return res.body;
}

export async function deleteDeployment(name: string, namespace: string) {
  await k8sAppsApi.deleteNamespacedDeployment(name, namespace);
}

export async function scaleDeployment(name: string, namespace: string, replicas: number) {
  const res = await k8sAppsApi.readNamespacedDeployment(name, namespace);
  const dep = res.body;
  dep.spec!.replicas = replicas;
  const updateRes = await k8sAppsApi.replaceNamespacedDeployment(name, namespace, dep);
  return updateRes.body;
}

export async function getDeploymentDetail(name: string, namespace: string) {
  const [depRes, podsRes, svcRes] = await Promise.all([
    k8sAppsApi.readNamespacedDeployment(name, namespace),
    k8sCoreApi.listNamespacedPod(
      namespace, undefined, undefined, undefined, undefined,
      `app=${name}`
    ),
    k8sCoreApi.listNamespacedService(
      namespace, undefined, undefined, undefined, undefined,
      `app=${name}`
    ),
  ]);

  const dep = depRes.body;
  const pods = podsRes.body.items.map((p) => ({
    name: p.metadata!.name!,
    status: p.status!.phase!,
    restarts: p.status!.containerStatuses?.[0]?.restartCount || 0,
    ip: p.status!.podIP || '',
  }));

  const endpoints = svcRes.body.items.map((s) => {
    const nodePort = s.spec?.type === 'NodePort' ? s.spec.ports?.[0]?.nodePort : null;
    const port = s.spec?.ports?.[0]?.port || 0;
    return {
      name: s.metadata!.name!,
      type: s.spec?.type || '',
      port,
      nodePort,
      url: nodePort ? `http://<node-ip>:${nodePort}` : null,
    };
  });

  return {
    name: dep.metadata!.name!,
    namespace: dep.metadata!.namespace!,
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
    pods,
    endpoints,
  };
}
```

需要在文件顶部添加 import：
```typescript
import * as k8s from '@kubernetes/client-node';
```

- [ ] **Step 2: 创建 Deployments 路由（含 SSE 日志流）**

```typescript
// dashboard/backend/src/routes/deployments.ts
import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import {
  getRunningDeployments,
  createDeployment,
  deleteDeployment,
  scaleDeployment,
  getDeploymentDetail,
} from '../services/k8s.service.js';

const router = Router();

// 列表
router.get('/', async (_req, res: Response) => {
  try {
    const deployments = await getRunningDeployments();
    res.json(deployments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建
router.post('/', async (req: Request, res: Response) => {
  try {
    const dep = await createDeployment(req.body);
    res.json(dep);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 详情
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const namespace = req.query.namespace as string || 'default';
    const detail = await getDeploymentDetail(req.params.name, namespace);
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 扩缩容
router.put('/:name', async (req: Request, res: Response) => {
  try {
    const { namespace, replicas } = req.body;
    const dep = await scaleDeployment(req.params.name, namespace || 'default', replicas);
    res.json(dep);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除
router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const namespace = req.query.namespace as string || 'default';
    await deleteDeployment(req.params.name, namespace);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 日志流 (SSE)
router.get('/:name/logs', async (req: Request, res: Response) => {
  const namespace = req.query.namespace as string || 'default';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const proc = exec(
    `k3s kubectl logs -f deployment/${req.params.name} -n ${namespace}`,
    { maxBuffer: 10 * 1024 * 1024 }
  );

  proc.stdout?.on('data', (data: string) => {
    res.write(`data: ${JSON.stringify({ log: data })}\n\n`);
  });

  proc.stderr?.on('data', (data: string) => {
    res.write(`data: ${JSON.stringify({ log: data })}\n\n`);
  });

  proc.on('close', () => {
    res.write(`data: ${JSON.stringify({ log: '[stream ended]' })}\n\n`);
    res.end();
  });

  req.on('close', () => {
    proc.kill();
  });
});

export default router;
```

- [ ] **Step 3: 注册路由到 Express 入口**

在 `dashboard/backend/src/index.ts` 中添加：

```typescript
import deploymentsRouter from './routes/deployments.js';

app.use('/api/deployments', deploymentsRouter);
```

- [ ] **Step 4: 验证 Deployments API**

```bash
cd dashboard/backend
npx tsx src/index.ts &
sleep 2
curl http://localhost:3001/api/deployments | python3 -m json.tool
# Expected: JSON array of deployments
kill %1
```

- [ ] **Step 5: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/backend/
git commit -m "feat: add deployments CRUD API and SSE log streaming"
```

---

### Task 4: 后端 — Images API + Resources API

**Files:**
- Create: `dashboard/backend/src/services/images.service.ts`
- Create: `dashboard/backend/src/data/community-images.json`
- Create: `dashboard/backend/src/routes/images.ts`
- Create: `dashboard/backend/src/routes/resources.ts`
- Modify: `dashboard/backend/src/index.ts`

- [ ] **Step 1: 创建社区镜像预置数据**

```json
// dashboard/backend/src/data/community-images.json
[
  {
    "name": "pytorch/pytorch",
    "tags": ["2.4.0-cuda12.4-cudnn9-runtime", "latest"],
    "description": "PyTorch 深度学习框架",
    "recommendedResources": { "vgpuNumber": 1, "vgpuMemory": 4096, "vgpuCores": 50, "cpu": "4", "memory": "8Gi" },
    "command": ["python"],
    "category": "framework"
  },
  {
    "name": "tensorflow/serving",
    "tags": ["latest-gpu"],
    "description": "TensorFlow 模型推理服务",
    "recommendedResources": { "vgpuNumber": 1, "vgpuMemory": 4096, "vgpuCores": 50, "cpu": "4", "memory": "8Gi" },
    "command": ["tensorflow_model_server"],
    "args": ["--port=9000"],
    "category": "serving"
  },
  {
    "name": "ollama/ollama",
    "tags": ["latest"],
    "description": "Ollama 本地大模型运行时",
    "recommendedResources": { "vgpuNumber": 1, "vgpuMemory": 4096, "vgpuCores": 60, "cpu": "4", "memory": "8Gi" },
    "command": ["ollama", "serve"],
    "category": "runtime"
  },
  {
    "name": "mistral/vllm",
    "tags": ["latest"],
    "description": "Mistral 官方 vLLM 推理镜像",
    "recommendedResources": { "vgpuNumber": 1, "vgpuMemory": 4096, "vgpuCores": 80, "cpu": "4", "memory": "8Gi" },
    "command": ["python3", "-m", "vllm.entrypoints.openai.api_server"],
    "args": ["--model", "mistralai/Mistral-7B-Instruct-v0.3", "--port", "8000"],
    "category": "serving"
  },
  {
    "name": "huggingface/text-generation-inference",
    "tags": ["latest"],
    "description": "HuggingFace TGI 推理服务",
    "recommendedResources": { "vgpuNumber": 1, "vgpuMemory": 4096, "vgpuCores": 80, "cpu": "4", "memory": "8Gi" },
    "command": ["text-generation-launcher"],
    "args": ["--model-id", "bigscience/bloom-560m", "--port", "8080"],
    "category": "serving"
  },
  {
    "name": "nginx",
    "tags": ["latest"],
    "description": "Nginx Web 服务器",
    "recommendedResources": { "vgpuNumber": 0, "vgpuMemory": 0, "vgpuCores": 0, "cpu": "1", "memory": "512Mi" },
    "command": ["nginx", "-g", "daemon off;"],
    "ports": [80],
    "category": "utility"
  }
]
```

- [ ] **Step 2: 创建镜像服务层**

```typescript
// dashboard/backend/src/services/images.service.ts
import { exec } from 'child_process';
import communityImages from '../data/community-images.json' assert { type: 'json' };

export interface LocalImage {
  name: string;
  tag: string;
  size: string;
  available: true;
}

export interface CommunityImage {
  name: string;
  tags: string[];
  description: string;
  recommendedResources: {
    vgpuNumber: number;
    vgpuMemory: number;
    vgpuCores: number;
    cpu: string;
    memory: string;
  };
  command?: string[];
  args?: string[];
  ports?: number[];
  category: string;
  available: false;
}

export async function getLocalImages(): Promise<LocalImage[]> {
  return new Promise((resolve, reject) => {
    exec('k3s crictl images -o json', { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const images: LocalImage[] = (data.images || [])
          .filter((img: any) => img.repoTags && img.repoTags.length > 0)
          .map((img: any) => {
            const [name, tag] = img.repoTags[0].split(':');
            return {
              name,
              tag: tag || 'latest',
              size: formatBytes(parseInt(img.size) || 0),
              available: true as const,
            };
          });
        resolve(images);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

export function getCommunityImages(): CommunityImage[] {
  return communityImages.map((img) => ({ ...img, available: false as const }));
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
```

- [ ] **Step 3: 创建 Images 路由**

```typescript
// dashboard/backend/src/routes/images.ts
import { Router } from 'express';
import { getLocalImages, getCommunityImages } from '../services/images.service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [local, community] = await Promise.all([
      getLocalImages(),
      Promise.resolve(getCommunityImages()),
    ]);
    res.json({ local, community });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 4: 创建 Resources 路由**

```typescript
// dashboard/backend/src/routes/resources.ts
import { Router } from 'express';
import { k8sCoreApi, k8sCustomApi } from '../k8s-client.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    // 节点信息
    const nodeRes = await k8sCoreApi.readNode('nic');
    const node = nodeRes.body;
    const capacity = node.status!.capacity!;
    const allocatable = node.status!.allocatable!;

    // Volcano 队列
    let queues: any[] = [];
    try {
      const queueRes = await k8sCustomApi.listClusterCustomObject(
        'scheduling.volcano.sh', 'v1beta1', 'queues'
      );
      queues = (queueRes.body as any).items || [];
    } catch {
      // Volcano 队列 API 可能不可用，忽略
    }

    res.json({
      node: {
        name: node.metadata!.name!,
        status: node.status!.conditions!.find((c) => c.type === 'Ready')!.status === 'True'
          ? 'Ready' : 'NotReady',
        capacity: {
          cpu: capacity['cpu'],
          memory: capacity['memory'],
          vgpuNumber: capacity['volcano.sh/vgpu-number'] || '0',
          vgpuMemory: capacity['volcano.sh/vgpu-memory'] || '0',
          vgpuCores: capacity['volcano.sh/vgpu-cores'] || '0',
        },
        allocatable: {
          cpu: allocatable['cpu'],
          memory: allocatable['memory'],
          vgpuNumber: allocatable['volcano.sh/vgpu-number'] || '0',
          vgpuMemory: allocatable['volcano.sh/vgpu-memory'] || '0',
          vgpuCores: allocatable['volcano.sh/vgpu-cores'] || '0',
        },
      },
      queues: queues.map((q: any) => ({
        name: q.metadata.name,
        weight: q.spec?.weight || 0,
        state: q.status?.state || 'Unknown',
        allocated: q.status?.allocated || {},
        pendingPods: q.status?.pendingPods || 0,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 5: 注册路由到 Express 入口**

在 `dashboard/backend/src/index.ts` 中添加：

```typescript
import imagesRouter from './routes/images.js';
import resourcesRouter from './routes/resources.js';

app.use('/api/images', imagesRouter);
app.use('/api/resources', resourcesRouter);
```

- [ ] **Step 6: 验证所有 API**

```bash
cd dashboard/backend
npx tsx src/index.ts &
sleep 2
curl http://localhost:3001/api/images | python3 -m json.tool
curl http://localhost:3001/api/resources | python3 -m json.tool
# Expected: images returns {local: [...], community: [...]}, resources returns node + queues
kill %1
```

- [ ] **Step 7: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/backend/
git commit -m "feat: add images and resources API routes"
```

---

### Task 5: 前端脚手架 — React + Vite + shadcn/ui

**Files:**
- Create: `dashboard/frontend/` (via scaffolding commands)
- Create: `dashboard/frontend/src/main.tsx`
- Create: `dashboard/frontend/src/App.tsx`
- Create: `dashboard/frontend/src/lib/utils.ts`
- Create: `dashboard/frontend/src/api/client.ts`

- [ ] **Step 1: 用 Vite 创建 React + TS 项目**

```bash
cd /home/nic/claude/ops/dashboard
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

- [ ] **Step 2: 安装 Tailwind CSS + 依赖**

```bash
cd /home/nic/claude/ops/dashboard/frontend
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom
```

- [ ] **Step 3: 配置 Tailwind**

替换 `dashboard/frontend/vite.config.ts`：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

替换 `dashboard/frontend/src/index.css`：

```css
@import "tailwindcss";
```

- [ ] **Step 4: 初始化 shadcn/ui**

```bash
cd /home/nic/claude/ops/dashboard/frontend
npx shadcn@latest init -d
```

- [ ] **Step 5: 添加需要的 shadcn 组件**

```bash
cd /home/nic/claude/ops/dashboard/frontend
npx shadcn@latest add button card badge input label select slider dialog scroll-area separator tabs table sheet -y
```

- [ ] **Step 6: 创建 API 客户端封装**

```typescript
// dashboard/frontend/src/api/client.ts
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getOverview: () => request<any>('/overview'),
  getDeployments: () => request<any[]>('/deployments'),
  createDeployment: (data: any) => request<any>('/deployments', { method: 'POST', body: JSON.stringify(data) }),
  getDeployment: (name: string, ns?: string) => request<any>(`/deployments/${name}${ns ? `?namespace=${ns}` : ''}`),
  scaleDeployment: (name: string, data: any) => request<any>(`/deployments/${name}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeployment: (name: string, ns?: string) => request<any>(`/deployments/${name}${ns ? `?namespace=${ns}` : ''}`, { method: 'DELETE' }),
  getImages: () => request<{ local: any[]; community: any[] }>('/images'),
  getResources: () => request<any>('/resources'),
  getLogStreamUrl: (name: string, ns?: string) => `${BASE}/deployments/${name}/logs${ns ? `?namespace=${ns}` : ''}`,
};
```

- [ ] **Step 7: 验证前端启动**

```bash
cd /home/nic/claude/ops/dashboard/frontend
npm run dev &
sleep 3
curl -s http://localhost:5173 | head -20
# Expected: HTML with React root div
kill %1
```

- [ ] **Step 8: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: scaffold frontend with React + Vite + shadcn/ui"
```

---

### Task 6: 前端 — 布局 + 路由 + 导航

**Files:**
- Create: `dashboard/frontend/src/components/layout/Sidebar.tsx`
- Create: `dashboard/frontend/src/components/layout/AppLayout.tsx`
- Modify: `dashboard/frontend/src/App.tsx`
- Modify: `dashboard/frontend/src/main.tsx`

- [ ] **Step 1: 创建侧边栏**

```tsx
// dashboard/frontend/src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Rocket, Package, Server } from 'lucide-react';

const navItems = [
  { to: '/', label: '概览', icon: LayoutDashboard },
  { to: '/deployments', label: '弹性部署', icon: Rocket },
  { to: '/images', label: '镜像仓库', icon: Package },
  { to: '/resources', label: '集群资源', icon: Server },
];

export function Sidebar() {
  return (
    <aside className="w-56 border-r bg-muted/30 flex flex-col h-screen">
      <div className="p-4 border-b">
        <h1 className="text-lg font-semibold">算力平台</h1>
        <p className="text-xs text-muted-foreground">AI Dashboard Demo</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: 创建布局壳**

```tsx
// dashboard/frontend/src/components/layout/AppLayout.tsx
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: 配置路由**

替换 `dashboard/frontend/src/App.tsx`：

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { OverviewPage } from './pages/OverviewPage';
import { DeploymentsPage } from './pages/DeploymentsPage';
import { DeploymentDetailPage } from './pages/DeploymentDetailPage';
import { ImagesPage } from './pages/ImagesPage';
import { ResourcesPage } from './pages/ResourcesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/deployments" element={<DeploymentsPage />} />
          <Route path="/deployments/:name" element={<DeploymentDetailPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: 创建占位页面**

```tsx
// dashboard/frontend/src/pages/OverviewPage.tsx
export function OverviewPage() {
  return <h2 className="text-2xl font-semibold">概览</h2>;
}
```

```tsx
// dashboard/frontend/src/pages/DeploymentsPage.tsx
export function DeploymentsPage() {
  return <h2 className="text-2xl font-semibold">弹性部署</h2>;
}
```

```tsx
// dashboard/frontend/src/pages/DeploymentDetailPage.tsx
export function DeploymentDetailPage() {
  return <h2 className="text-2xl font-semibold">部署详情</h2>;
}
```

```tsx
// dashboard/frontend/src/pages/ImagesPage.tsx
export function ImagesPage() {
  return <h2 className="text-2xl font-semibold">镜像仓库</h2>;
}
```

```tsx
// dashboard/frontend/src/pages/ResourcesPage.tsx
export function ResourcesPage() {
  return <h2 className="text-2xl font-semibold">集群资源</h2>;
}
```

- [ ] **Step 5: 更新 main.tsx**

替换 `dashboard/frontend/src/main.tsx`：

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 6: 安装 lucide-react 图标**

```bash
cd /home/nic/claude/ops/dashboard/frontend
npm install lucide-react
```

- [ ] **Step 7: 验证布局和导航**

```bash
cd /home/nic/claude/ops/dashboard/frontend
npm run dev
# 浏览器打开 http://localhost:5173，验证侧边栏和路由切换
```

- [ ] **Step 8: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: add layout, routing, and navigation sidebar"
```

---

### Task 7: 前端 — 概览页

**Files:**
- Create: `dashboard/frontend/src/components/ResourceCard.tsx`
- Create: `dashboard/frontend/src/components/StatusBadge.tsx`
- Modify: `dashboard/frontend/src/pages/OverviewPage.tsx`

- [ ] **Step 1: 创建 ResourceCard 组件**

```tsx
// dashboard/frontend/src/components/ResourceCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ResourceCardProps {
  title: string;
  used: number;
  total: number;
  unit?: string;
  icon: React.ReactNode;
}

export function ResourceCard({ title, used, total, unit = '', icon }: ResourceCardProps) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {used}{unit} <span className="text-sm font-normal text-muted-foreground">/ {total}{unit}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{pct}% 已分配</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: 创建 StatusBadge 组件**

```tsx
// dashboard/frontend/src/components/StatusBadge.tsx
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  ready: number;
  replicas: number;
}

export function StatusBadge({ ready, replicas }: StatusBadgeProps) {
  if (ready === replicas && replicas > 0) {
    return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Running</Badge>;
  }
  if (replicas === 0) {
    return <Badge variant="secondary">Stopped</Badge>;
  }
  return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>;
}
```

- [ ] **Step 3: 实现概览页**

```tsx
// dashboard/frontend/src/pages/OverviewPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, HardDrive, MemoryStick, Rocket } from 'lucide-react';
import { api } from '@/api/client';
import { ResourceCard } from '@/components/ResourceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getOverview().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="text-muted-foreground">加载中...</div>;

  const { resources, deployments } = data;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">概览</h2>

      <div className="grid grid-cols-4 gap-4">
        <ResourceCard
          title="GPU"
          used={resources.gpu.used}
          total={resources.gpu.total}
          icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
        />
        <ResourceCard
          title="CPU"
          used={parseInt(resources.cpu.used) || 0}
          total={parseInt(resources.cpu.total) || 0}
          icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
        />
        <ResourceCard
          title="内存"
          used={parseKi(resources.memory.used)}
          total={parseKi(resources.memory.total)}
          unit="Gi"
          icon={<MemoryStick className="h-4 w-4 text-muted-foreground" />}
        />
        <ResourceCard
          title="运行中服务"
          used={resources.runningDeployments}
          total={deployments.length}
          icon={<Rocket className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>运行中服务</CardTitle>
          <Button size="sm" onClick={() => navigate('/deployments')}>
            <Rocket className="h-4 w-4 mr-1" /> 创建部署
          </Button>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无部署服务</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">名称</th>
                  <th className="pb-2">镜像</th>
                  <th className="pb-2">状态</th>
                  <th className="pb-2">GPU</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d: any) => (
                  <tr
                    key={d.name}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/deployments/${d.name}?namespace=${d.namespace}`)}
                  >
                    <td className="py-2 font-medium">{d.name}</td>
                    <td className="py-2 text-muted-foreground">{d.image}</td>
                    <td className="py-2">
                      <StatusBadge ready={d.readyReplicas} replicas={d.replicas} />
                    </td>
                    <td className="py-2">{d.vgpu > 0 ? `${d.vgpu} vGPU` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function parseKi(val: string): number {
  if (!val) return 0;
  if (val.endsWith('Ki')) return Math.round(parseInt(val) / 1024 / 1024 * 10) / 10;
  if (val.endsWith('Mi')) return Math.round(parseInt(val) / 1024 * 10) / 10;
  if (val.endsWith('Gi')) return parseInt(val);
  return parseInt(val) || 0;
}
```

- [ ] **Step 4: 验证概览页**

启动前后端，浏览器打开 `http://localhost:5173`，确认资源卡片数据和服务列表正确显示。

- [ ] **Step 5: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: implement overview page with resource cards and deployment list"
```

---

### Task 8: 前端 — 弹性部署页（列表 + 创建弹窗）

**Files:**
- Create: `dashboard/frontend/src/pages/CreateDeploymentModal.tsx`
- Modify: `dashboard/frontend/src/pages/DeploymentsPage.tsx`

- [ ] **Step 1: 实现部署列表页**

```tsx
// dashboard/frontend/src/pages/DeploymentsPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { api } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateDeploymentModal } from './CreateDeploymentModal';

export function DeploymentsPage() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [prefillImage, setPrefillImage] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const load = () => {
    api.getDeployments().then(setDeployments).catch(console.error);
  };

  useEffect(() => {
    load();
    const img = searchParams.get('image');
    if (img) {
      setPrefillImage(img);
      setShowCreate(true);
    }
  }, []);

  const handleDelete = async (name: string, ns: string) => {
    if (!confirm(`确认删除 ${name}?`)) return;
    await api.deleteDeployment(name, ns);
    load();
  };

  const handleStop = async (name: string, ns: string) => {
    await api.scaleDeployment(name, { namespace: ns, replicas: 0 });
    load();
  };

  const handleStart = async (name: string, ns: string) => {
    await api.scaleDeployment(name, { namespace: ns, replicas: 1 });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">弹性部署</h2>
        <Button onClick={() => { setPrefillImage(''); setShowCreate(true); }}>
          <Plus className="h-4 w-4 mr-1" /> 创建部署
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">名称</th>
                <th className="p-3">镜像</th>
                <th className="p-3">命名空间</th>
                <th className="p-3">状态</th>
                <th className="p-3">GPU</th>
                <th className="p-3">创建时间</th>
                <th className="p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((d) => (
                <tr
                  key={`${d.namespace}-${d.name}`}
                  className="border-b last:border-0 hover:bg-muted/50"
                >
                  <td
                    className="p-3 font-medium cursor-pointer"
                    onClick={() => navigate(`/deployments/${d.name}?namespace=${d.namespace}`)}
                  >
                    {d.name}
                  </td>
                  <td className="p-3 text-muted-foreground">{d.image}</td>
                  <td className="p-3 text-muted-foreground">{d.namespace}</td>
                  <td className="p-3">
                    <StatusBadge ready={d.readyReplicas} replicas={d.replicas} />
                  </td>
                  <td className="p-3">{d.vgpu > 0 ? `${d.vgpu} vGPU` : '-'}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(d.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {d.replicas > 0 ? (
                        <Button size="icon" variant="ghost" onClick={() => handleStop(d.name, d.namespace)}>
                          <PowerOff className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => handleStart(d.name, d.namespace)}>
                          <Power className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(d.name, d.namespace)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {deployments.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    暂无部署，点击"创建部署"开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CreateDeploymentModal
        open={showCreate}
        onClose={() => { setShowCreate(false); load(); }}
        prefillImage={prefillImage}
      />
    </div>
  );
}
```

- [ ] **Step 2: 实现创建部署弹窗**

```tsx
// dashboard/frontend/src/pages/CreateDeploymentModal.tsx
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Props {
  open: boolean;
  onClose: () => void;
  prefillImage?: string;
}

interface ImageItem {
  name: string;
  tag?: string;
  size?: string;
  available: boolean;
  description?: string;
  recommendedResources?: any;
  command?: string[];
  args?: string[];
  ports?: number[];
}

export function CreateDeploymentModal({ open, onClose, prefillImage }: Props) {
  const [images, setImages] = useState<{ local: ImageItem[]; community: ImageItem[] }>({ local: [], community: [] });
  const [selected, setSelected] = useState<ImageItem | null>(null);
  const [form, setForm] = useState({
    name: '',
    namespace: 'default',
    command: '',
    args: '',
    vgpuNumber: 1,
    vgpuMemory: 4096,
    vgpuCores: 80,
    cpu: '4',
    memory: '8Gi',
    ports: '8000',
    env: '',
    volumes: '',
  });

  useEffect(() => {
    api.getImages().then(setImages).catch(console.error);
  }, []);

  useEffect(() => {
    if (prefillImage) {
      const all = [...images.local, ...images.community];
      const match = all.find((i) => i.name === prefillImage || i.name.startsWith(prefillImage));
      if (match) handleSelectImage(match);
    }
  }, [prefillImage, images]);

  const handleSelectImage = (img: ImageItem) => {
    setSelected(img);
    const rec = img.recommendedResources;
    if (rec) {
      setForm((f) => ({
        ...f,
        vgpuNumber: rec.vgpuNumber ?? 1,
        vgpuMemory: rec.vgpuMemory ?? 4096,
        vgpuCores: rec.vgpuCores ?? 80,
        cpu: rec.cpu ?? '4',
        memory: rec.memory ?? '8Gi',
        command: img.command?.join(' ') ?? '',
        args: img.args?.join(' ') ?? '',
        ports: img.ports?.join(',') ?? '8000',
      }));
    } else {
      setForm((f) => ({
        ...f,
        command: img.command?.join(' ') ?? '',
        args: '',
        ports: '8000',
      }));
    }
  };

  const handleCreate = async () => {
    if (!selected || !form.name) return;
    const ports = form.ports.split(',').map(Number).filter(Boolean);
    const env: Record<string, string> = {};
    form.env.split(',').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) env[k.trim()] = (v || '').trim();
    });
    const volumes = form.volumes
      ? form.volumes.split(',').map((v, i) => {
          const [hostPath, mountPath] = v.split(':');
          return { name: `vol-${i}`, hostPath: hostPath.trim(), mountPath: mountPath?.trim() || hostPath.trim() };
        })
      : [];

    await api.createDeployment({
      name: form.name,
      namespace: form.namespace,
      image: `${selected.name}:${selected.tag || 'latest'}`,
      command: form.command ? form.command.split(' ') : undefined,
      args: form.args ? form.args.split(' ') : undefined,
      vgpuNumber: form.vgpuNumber,
      vgpuMemory: form.vgpuMemory,
      vgpuCores: form.vgpuCores,
      cpu: form.cpu || undefined,
      memory: form.memory || undefined,
      ports,
      env: Object.keys(env).length > 0 ? env : undefined,
      volumes: volumes.length > 0 ? volumes : undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建部署</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 镜像选择 - 平铺列表 */}
          <div>
            <Label className="mb-2 block">选择镜像</Label>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">本地镜像</p>
                <div className="grid grid-cols-2 gap-2">
                  {images.local.map((img) => (
                    <div
                      key={img.name}
                      onClick={() => handleSelectImage(img)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selected?.name === img.name ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{img.name}</span>
                        <Badge variant="default" className="text-xs bg-green-500">可用</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{img.tag} · {img.size}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">社区镜像</p>
                <div className="grid grid-cols-2 gap-2">
                  {images.community.map((img) => (
                    <div
                      key={img.name}
                      onClick={() => handleSelectImage(img)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selected?.name === img.name ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{img.name}</span>
                        <Badge variant="secondary" className="text-xs">社区</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{img.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 基础配置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>部署名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-deployment" />
            </div>
            <div>
              <Label>命名空间</Label>
              <Input value={form.namespace} onChange={(e) => setForm({ ...form, namespace: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>启动命令</Label>
            <Input value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder="python3 -m vllm.entrypoints.openai.api_server" />
          </div>
          <div>
            <Label>启动参数</Label>
            <Input value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} placeholder="--model Qwen/Qwen2.5-1.5B-Instruct --port 8000" />
          </div>

          <Separator />

          {/* 资源配额 */}
          <p className="text-sm font-medium">资源配额</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>GPU 数量</Label>
              <Input type="number" min={0} max={10} value={form.vgpuNumber} onChange={(e) => setForm({ ...form, vgpuNumber: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>GPU 显存 (MB)</Label>
              <Input type="number" value={form.vgpuMemory} onChange={(e) => setForm({ ...form, vgpuMemory: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>GPU 核数</Label>
              <Input type="number" value={form.vgpuCores} onChange={(e) => setForm({ ...form, vgpuCores: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CPU</Label>
              <Input value={form.cpu} onChange={(e) => setForm({ ...form, cpu: e.target.value })} />
            </div>
            <div>
              <Label>内存</Label>
              <Input value={form.memory} onChange={(e) => setForm({ ...form, memory: e.target.value })} />
            </div>
          </div>

          <Separator />

          {/* 其他配置 */}
          <p className="text-sm font-medium">其他配置</p>
          <div>
            <Label>端口映射</Label>
            <Input value={form.ports} onChange={(e) => setForm({ ...form, ports: e.target.value })} placeholder="8000,8080" />
          </div>
          <div>
            <Label>环境变量</Label>
            <Input value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value })} placeholder="KEY=value,KEY2=value2" />
          </div>
          <div>
            <Label>存储挂载</Label>
            <Input value={form.volumes} onChange={(e) => setForm({ ...form, volumes: e.target.value })} placeholder="/data/models:/root/.cache/models" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleCreate} disabled={!selected || !form.name}>
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: 验证弹性部署页**

启动前后端，测试：创建部署弹窗打开/关闭、镜像选择、表单填写、创建部署。

- [ ] **Step 4: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: implement deployments list page and create deployment modal"
```

---

### Task 9: 前端 — 部署详情页（含日志流）

**Files:**
- Create: `dashboard/frontend/src/components/LogViewer.tsx`
- Modify: `dashboard/frontend/src/pages/DeploymentDetailPage.tsx`

- [ ] **Step 1: 创建 LogViewer 组件**

```tsx
// dashboard/frontend/src/components/LogViewer.tsx
import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';

interface Props {
  name: string;
  namespace: string;
}

export function LogViewer({ name, namespace }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = () => {
    const url = api.getLogStreamUrl(name, namespace);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs((prev) => [...prev.slice(-500), data.log]);
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => {
      setConnected(false);
      es.close();
    };
  };

  const disconnect = () => {
    eventSourceRef.current?.close();
    setConnected(false);
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [name, namespace]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {connected ? '已连接' : '未连接'}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLogs([])}>清空</Button>
          <Button size="sm" variant="outline" onClick={connected ? disconnect : connect}>
            {connected ? '断开' : '重连'}
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-64 overflow-auto bg-zinc-950 text-green-400 rounded-md p-3 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <span className="text-zinc-500">等待日志...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap">{log}</div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 实现部署详情页**

```tsx
// dashboard/frontend/src/pages/DeploymentDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Power, PowerOff, RotateCcw } from 'lucide-react';
import { api } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { LogViewer } from '@/components/LogViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DeploymentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const namespace = searchParams.get('namespace') || 'default';
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);
  const [replicas, setReplicas] = useState(1);

  const load = () => {
    if (name) {
      api.getDeployment(name, namespace).then(setDetail).catch(console.error);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [name, namespace]);

  if (!detail) return <div className="text-muted-foreground">加载中...</div>;

  const handleDelete = async () => {
    if (!confirm(`确认删除 ${name}?`)) return;
    await api.deleteDeployment(name!, namespace);
    navigate('/deployments');
  };

  const handleScale = async (rep: number) => {
    await api.scaleDeployment(name!, { namespace, replicas: rep });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/deployments')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-semibold">{detail.name}</h2>
        <StatusBadge ready={detail.readyReplicas} replicas={detail.replicas} />
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">镜像</span>
              <p className="font-medium">{detail.image}</p>
            </div>
            <div>
              <span className="text-muted-foreground">命名空间</span>
              <p className="font-medium">{detail.namespace}</p>
            </div>
            <div>
              <span className="text-muted-foreground">创建时间</span>
              <p className="font-medium">{new Date(detail.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">GPU</span>
              <p className="font-medium">{detail.vgpu} vGPU · {detail.vgpuMemory}MB</p>
            </div>
            <div>
              <span className="text-muted-foreground">副本</span>
              <p className="font-medium">{detail.readyReplicas} / {detail.replicas}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 访问端点 */}
      {detail.endpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>访问端点</CardTitle>
          </CardHeader>
          <CardContent>
            {detail.endpoints.map((ep: any) => (
              <div key={ep.name} className="text-sm">
                <span className="text-muted-foreground">{ep.name}</span>
                {ep.url && (
                  <a href={ep.url} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">
                    {ep.url}
                  </a>
                )}
                {!ep.url && <span className="ml-2 text-muted-foreground">Port {ep.port}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pod 列表 */}
      <Card>
        <CardHeader>
          <CardTitle>Pod 状态</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">名称</th>
                <th className="pb-2">状态</th>
                <th className="pb-2">重启</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {detail.pods.map((pod: any) => (
                <tr key={pod.name} className="border-b last:border-0">
                  <td className="py-2 font-medium">{pod.name}</td>
                  <td className="py-2">{pod.status}</td>
                  <td className="py-2">{pod.restarts}</td>
                  <td className="py-2 text-muted-foreground">{pod.ip || '-'}</td>
                </tr>
              ))}
              {detail.pods.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">暂无 Pod</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* 日志 */}
      <Card>
        <CardHeader>
          <CardTitle>实时日志</CardTitle>
        </CardHeader>
        <CardContent>
          <LogViewer name={name!} namespace={namespace} />
        </CardContent>
      </Card>

      {/* 操作 */}
      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div>
              <Label>扩缩容 (Replicas)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={replicas}
                onChange={(e) => setReplicas(parseInt(e.target.value) || 0)}
                className="w-24"
              />
            </div>
            <Button onClick={() => handleScale(replicas)}>应用</Button>
          </div>
          <div className="flex gap-2">
            {detail.replicas > 0 ? (
              <Button variant="outline" onClick={() => handleScale(0)}>
                <PowerOff className="h-4 w-4 mr-1" /> 停止
              </Button>
            ) : (
              <Button variant="outline" onClick={() => handleScale(1)}>
                <Power className="h-4 w-4 mr-1" /> 启动
              </Button>
            )}
            <Button variant="outline" onClick={() => { handleScale(0); setTimeout(() => handleScale(1), 1000); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> 重启
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> 删除
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 验证详情页**

启动前后端，点击某个部署进入详情页，确认状态、Pod 列表、日志流、扩缩容操作正常。

- [ ] **Step 4: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: implement deployment detail page with log viewer and scaling"
```

---

### Task 10: 前端 — 镜像仓库页

**Files:**
- Modify: `dashboard/frontend/src/pages/ImagesPage.tsx`

- [ ] **Step 1: 实现镜像仓库页**

```tsx
// dashboard/frontend/src/pages/ImagesPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Rocket } from 'lucide-react';

interface ImageItem {
  name: string;
  tag?: string;
  size?: string;
  available: boolean;
  description?: string;
  recommendedResources?: any;
  command?: string[];
  args?: string[];
  ports?: number[];
  category?: string;
}

export function ImagesPage() {
  const [images, setImages] = useState<{ local: ImageItem[]; community: ImageItem[] }>({ local: [], community: [] });
  const navigate = useNavigate();

  useEffect(() => {
    api.getImages().then(setImages).catch(console.error);
  }, []);

  const handleCreate = (img: ImageItem) => {
    const fullName = img.tag ? `${img.name}:${img.tag}` : img.name;
    navigate(`/deployments?image=${encodeURIComponent(fullName)}`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">镜像仓库</h2>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-medium">本地镜像</h3>
          <Badge variant="default" className="bg-green-500">{images.local.length}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {images.local.map((img) => (
            <Card key={img.name} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{img.name}</span>
                  <Badge variant="default" className="bg-green-500 text-xs">可用</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>标签: {img.tag || 'latest'}</p>
                  <p>大小: {img.size || '-'}</p>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => handleCreate(img)}
                >
                  <Rocket className="h-3 w-3 mr-1" /> 以此创建部署
                </Button>
              </CardContent>
            </Card>
          ))}
          {images.local.length === 0 && (
            <p className="text-muted-foreground text-sm col-span-3">暂无本地镜像</p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-medium">社区镜像</h3>
          <Badge variant="secondary">{images.community.length}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {images.community.map((img) => (
            <Card key={img.name} className="hover:shadow-md transition-shadow opacity-80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm truncate">{img.name}</span>
                  <Badge variant="secondary" className="text-xs">社区</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{img.description}</p>
                <div className="text-xs text-muted-foreground">
                  <p>标签: {img.tags?.join(', ') || 'latest'}</p>
                  {img.recommendedResources && (
                    <p>推荐: {img.recommendedResources.vgpuNumber} vGPU · {img.recommendedResources.vgpuMemory}MB 显存</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-3"
                  onClick={() => handleCreate(img)}
                >
                  <Rocket className="h-3 w-3 mr-1" /> 以此创建部署
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证镜像仓库页**

启动前后端，确认本地镜像和社区镜像分组显示，点击"以此创建部署"跳转正确。

- [ ] **Step 3: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: implement images page with local and community image cards"
```

---

### Task 11: 前端 — 集群资源页

**Files:**
- Modify: `dashboard/frontend/src/pages/ResourcesPage.tsx`

- [ ] **Step 1: 实现集群资源页**

```tsx
// dashboard/frontend/src/pages/ResourcesPage.tsx
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ResourcesPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.getResources().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="text-muted-foreground">加载中...</div>;

  const { node, queues } = data;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">集群资源</h2>

      {/* 节点状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            节点: {node.name}
            <Badge variant={node.status === 'Ready' ? 'default' : 'destructive'}
              className={node.status === 'Ready' ? 'bg-green-500' : ''}>
              {node.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            <ResourceBar label="CPU" used={node.allocatable.cpu} total={node.capacity.cpu} />
            <ResourceBar label="内存" used={node.allocatable.memory} total={node.capacity.memory} />
            <ResourceBar label="vGPU" used={node.allocatable.vgpuNumber} total={node.capacity.vgpuNumber} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <p>vGPU 显存: {node.allocatable.vgpuMemory} / {node.capacity.vgpuMemory} MB</p>
            </div>
            <div>
              <p>vGPU 核数: {node.allocatable.vgpuCores} / {node.capacity.vgpuCores}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Volcano 队列 */}
      {queues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Volcano 队列</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">名称</th>
                  <th className="pb-2">权重</th>
                  <th className="pb-2">状态</th>
                  <th className="pb-2">待调度 Pod</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q: any) => (
                  <tr key={q.name} className="border-b last:border-0">
                    <td className="py-2 font-medium">{q.name}</td>
                    <td className="py-2">{q.weight}</td>
                    <td className="py-2">
                      <Badge variant="outline">{q.state}</Badge>
                    </td>
                    <td className="py-2">{q.pendingPods}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ResourceBar({ label, used, total }: { label: string; used: string; total: string }) {
  const usedNum = parseResource(used);
  const totalNum = parseResource(total);
  const pct = totalNum > 0 ? Math.round((usedNum / totalNum) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{used} / {total}</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{pct}% 已分配</p>
    </div>
  );
}

function parseResource(val: string): number {
  if (!val) return 0;
  if (val.endsWith('Ki')) return parseInt(val) / 1024;
  if (val.endsWith('Mi')) return parseInt(val);
  if (val.endsWith('Gi')) return parseInt(val) * 1024;
  return parseInt(val) || 0;
}
```

- [ ] **Step 2: 验证集群资源页**

启动前后端，确认节点状态、资源进度条、Volcano 队列信息正确显示。

- [ ] **Step 3: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/frontend/
git commit -m "feat: implement resources page with node status and volcano queues"
```

---

### Task 12: 前端 — 创建部署时自动创建 Service

当前创建 Deployment 不会自动创建对应的 NodePort Service，需要后端支持。

**Files:**
- Modify: `dashboard/backend/src/services/k8s.service.ts`
- Modify: `dashboard/backend/src/routes/deployments.ts`

- [ ] **Step 1: 扩展 createDeployment 函数，在创建 Deployment 后自动创建 Service**

在 `dashboard/backend/src/services/k8s.service.ts` 的 `createDeployment` 函数末尾，在 `const res = await k8sAppsApi.createNamespacedDeployment(...)` 之后追加：

```typescript
  // 自动为每个端口创建 NodePort Service
  if (params.ports && params.ports.length > 0) {
    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: `${params.name}-svc`, namespace: params.namespace, labels: { app: params.name } },
      spec: {
        type: 'NodePort',
        selector: { app: params.name },
        ports: params.ports.map((port) => ({ port, targetPort: port, protocol: 'TCP' })),
      },
    };
    await k8sCoreApi.createNamespacedService(params.namespace, service);
  }
```

- [ ] **Step 2: 更新 deleteDeployment，同时删除关联 Service**

在 `dashboard/backend/src/services/k8s.service.ts` 的 `deleteDeployment` 函数中，在 `await k8sAppsApi.deleteNamespacedDeployment(...)` 之前追加：

```typescript
  // 删除关联 Service
  try {
    await k8sCoreApi.deleteNamespacedService(`${name}-svc`, namespace);
  } catch {
    // Service 可能不存在，忽略
  }
```

- [ ] **Step 3: 验证**

```bash
cd dashboard/backend
npx tsx src/index.ts &
sleep 2
# 创建一个测试部署
curl -X POST http://localhost:3001/api/deployments \
  -H 'Content-Type: application/json' \
  -d '{"name":"test-svc","namespace":"default","image":"nginx:latest","vgpuNumber":0,"vgpuMemory":0,"vgpuCores":0,"ports":[80]}'
# 验证 Service 已创建
k3s kubectl get svc test-svc-svc
# 删除
curl -X DELETE 'http://localhost:3001/api/deployments/test-svc?namespace=default'
# 验证 Service 已删除
k3s kubectl get svc test-svc-svc 2>&1
# Expected: "not found"
kill %1
```

- [ ] **Step 4: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/backend/
git commit -m "feat: auto-create/delete NodePort Service with Deployment"
```

---

### Task 13: 端到端验证 + README

**Files:**
- Create: `dashboard/README.md`

- [ ] **Step 1: 编写 README**

```markdown
# AI 算力租赁 Dashboard Demo

对接 K3S + Volcano 集群的 AI 算力弹性部署管理平台。

## 快速启动

```bash
# 启动后端
cd dashboard/backend
npm install
npm run dev

# 启动前端（新终端）
cd dashboard/frontend
npm install
npm run dev
```

打开 http://localhost:5173

## 功能

- **概览** — 集群资源用量、运行中服务一览
- **弹性部署** — 创建/停止/删除/扩缩容 AI 推理服务
- **镜像仓库** — 本地可用镜像 + 社区主流 AI 镜像展示
- **集群资源** — 节点状态、Volcano 队列、资源分配可视化

## 技术栈

- 前端: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- 后端: Express + @kubernetes/client-node
- 集群: K3S + Volcano (vGPU 调度)
```

- [ ] **Step 2: 端到端验证**

启动前后端，在浏览器中完整走通以下流程：
1. 概览页查看资源卡片和运行中服务
2. 弹性部署页点击"创建部署"，选择 vllm/vllm-openai 镜像，填写参数，创建
3. 等待 Pod Running，进入详情页查看状态、日志、端点
4. 执行扩缩容操作
5. 停止、重启、删除部署
6. 镜像仓库页查看本地和社区镜像
7. 集群资源页查看节点和队列信息

- [ ] **Step 3: 提交**

```bash
cd /home/nic/claude/ops
git add dashboard/
git commit -m "docs: add README and complete e2e verification"
```
