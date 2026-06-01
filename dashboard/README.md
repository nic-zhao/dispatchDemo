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
