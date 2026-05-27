# AI 算力租赁 Dashboard Demo 设计文档

## 概述

为本地 K3S 集群构建一个 Dashboard Demo，面向客户演示 AI 算力租赁平台的弹性部署能力。核心功能聚焦于**弹性部署服务**，账号登录和计费系统暂不纳入。

## 集群现状

- K3S 单节点 (nic)，v1.35.4+k3s1
- Volcano 调度器：10 vGPU、6144MB vgpu-memory、100 vgpu-cores
- 已部署服务：vLLM (Qwen2.5-1.5B-Instruct)、JupyterHub、Kubeflow Training Operator
- 资源总量：20 CPU、~15GB 内存、1 GPU (通过 Volcano vGPU 切分)

## 架构：BFF 模式

```
React + Vite (SPA, Port 5173)
        ↓ HTTP API
Express BFF (API 聚合层, Port 3001)
        ↓ @kubernetes/client-node
K3S + Volcano (K8s API)
```

BFF 层职责：
- 聚合 K8s API 调用（Deployment、Pod、Node、Volcano Queue 等）
- 数据转换：将 K8s 原始响应精简为前端需要的结构
- 执行节点命令（如 `crictl images` 获取本地镜像列表）
- 流式日志代理（kubectl logs → SSE → 前端）

## 技术栈

- **前端**：React 18 + Vite + TypeScript + Tailwind CSS
- **后端**：Node.js + Express + TypeScript + @kubernetes/client-node
- **K8s 交互**：@kubernetes/client-node (K8s API) + node-child-process (crictl)
- **UI 组件**：shadcn/ui（轻量，匹配 HuggingFace 简洁风格）

## 页面设计

### 1. 概览页 (`/`)

**资源概览卡片**（顶部横排 4 卡片）：
- GPU：已用/总量 (vgpu-number)，带进度条
- CPU：已分配/总量
- 内存：已分配/总量
- 运行中服务数

**运行中服务**（中部）：
- 当前活跃 Deployment 的简表：名称、镜像、状态、GPU 占用
- 点击跳转服务详情

**快速操作**（底部）：
- "创建部署" 主按钮
- 最近操作记录（创建/停止/删除）

### 2. 弹性部署页 (`/deployments`)

#### 服务列表
每行：部署名称 / 镜像 / 状态(Running/Pending/Stopped) / GPU 占用 / 创建时间 / 操作按钮(停止/删除/详情)

#### 创建部署（侧滑面板或弹窗）

**基础配置**：
- 部署名称（必填）
- 镜像选择（平铺列表，分"演示镜像"和"社区镜像"两组）
  - 演示镜像：本地真实可用的镜像（vllm/vllm-openai、jupyter/base-notebook 等），带"可用"标签，选中后可真实创建部署
  - 社区镜像：主流 AI 镜像名称展示（如 pytorch/pytorch、tensorflow/serving、ollama/ollama 等），带"社区"标签，仅展示不可真实调用
- 启动命令（默认填入镜像推荐命令）
- 启动参数（如 vLLM 的 `--model`、`--port` 等，可编辑）

**资源配额**：
- GPU 数量 (volcano.sh/vgpu-number, 1-10)
- GPU 显存 (volcano.sh/vgpu-memory, MB)
- GPU 核数 (volcano.sh/vgpu-cores)
- CPU 请求/限制（可选，有默认值）
- 内存请求/限制（可选，有默认值）

**其他配置**：
- 端口映射（容器端口 → 服务端口）
- 环境变量（键值对，可增删）
- 存储挂载（hostPath 或 PVC，如 HuggingFace 缓存目录）

**确认创建**：
- 展示配置摘要
- 确认后 BFF 调用 K8s API 创建 Deployment（schedulerName: volcano）

#### 服务详情 (`/deployments/:name`)

- **状态信息**：Deployment 状态 + Pod 列表（名称、状态、重启次数、IP）
- **资源使用**：当前分配的 GPU/CPU/内存
- **访问端点**：通过 K8s Service 自动发现 NodePort，拼接为 `http://<node-ip>:<nodePort>` 展示
- **实时日志**：kubectl logs 流式输出（SSE 推送到前端）
- **扩缩容**：调整 replicas 数量
- **操作**：停止(设 replicas=0) / 删除 / 重启

### 3. 镜像仓库页 (`/images`)

- **镜像列表**（平铺卡片/列表形式，分两组）：
  - **本地镜像**：从 K3S 节点 `crictl images` 获取，带"可用"标签，可点击"以此创建部署"真实调用
  - **社区镜像**：预置主流 AI 镜像列表（如 pytorch/pytorch、tensorflow/serving、ollama/ollama、mistral/vllm 等），带"社区"标签，仅展示不可真实调用
- 每个镜像卡片显示：镜像名称 / 标签 / 镜像大小（本地镜像）/ 推荐资源配额 / 操作按钮
- 每个镜像可展开查看推荐启动参数模板（预填命令和参数）
- 点击"以此镜像创建部署"跳转到弹性部署页并预填镜像信息

### 4. 集群资源页 (`/resources`)

- **节点状态**：节点名 / Ready 状态 / CPU 分配比 / 内存分配比 / vGPU 分配比
- **Volcano 队列**：队列名 / 权重 / 已分配资源 / 待调度 Pod 数
- **资源可视化**：GPU/CPU/内存的分配比，用进度条展示，不引入复杂图表库

## BFF API 设计

```
GET    /api/overview              — 概览数据（资源汇总 + 运行中服务）
GET    /api/deployments           — Deployment 列表
POST   /api/deployments           — 创建 Deployment
GET    /api/deployments/:name     — Deployment 详情 + Pod 列表
PUT    /api/deployments/:name     — 更新 Deployment（扩缩容）
DELETE /api/deployments/:name     — 删除 Deployment
GET    /api/deployments/:name/logs — 日志流（SSE）
GET    /api/images                — 本地镜像列表
GET    /api/resources             — 集群资源（节点 + Volcano 队列）
```

## 项目结构

```
dashboard/
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── pages/           # 概览、弹性部署、镜像仓库、集群资源
│   │   ├── components/      # 共享组件（资源卡片、状态标签、日志查看器等）
│   │   ├── api/             # API 调用封装
│   │   └── App.tsx
│   └── package.json
├── backend/                 # Express BFF
│   ├── src/
│   │   ├── routes/          # API 路由
│   │   ├── services/        # K8s 交互逻辑
│   │   └── index.ts
│   └── package.json
└── README.md
```

## 不在范围内

- 用户认证/登录系统
- 计费/费用系统
- 多租户/团队管理
- 复杂图表库引入
- Ingress/域名管理（Demo 阶段用 NodePort）
