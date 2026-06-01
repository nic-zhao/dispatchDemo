# Pod 状态页面功能增强

## 概述

在 DeploymentDetailPage 中新增 "快捷访问" 卡片，位于 "Pod 状态" 与 "实时日志" 之间，包含三个快捷功能。

## 页面结构

```
基本信息
访问端点
Pod 状态
快捷访问  ← NEW
实时日志
操作
```

## 快捷访问卡片

卡片标题为"快捷访问"，右上角放置"添加端口"按钮。
卡片内容包含：

### 1. Quick Access URL

显示 http://{clusterIP}:{port} 的可点击链接。

**后端** (k8s.service.ts):
- getDeploymentDetail() 中读取 Service 的 spec.clusterIP，附加到 endpoint 数据
- 为每个 pod 返回容器名列表

**前端** (DeploymentDetailPage.tsx):
- 展示 clusterIP:port 的可点击 URL

### 2. 终端命令入口

显示 kubectl exec -it {pod-name} -n {namespace} -- /bin/sh，带复制按钮。

**前端**:
- 纯前端实现

### 3. 添加端口 (按钮在卡片右上角)

弹出 Dialog，包含：
- 容器名下接菜单 (Select)
- 端口号数字输入框 (Input)
- 确认/取消按钮

**后端**:
- 新增 addServicePort() 读取并更新 Service
- 新增路由 PATCH /deployments/:name/ports

## 数据结构

后端返回值扩展：pod 增加 containers[], endpoint 增加 clusterIP。
