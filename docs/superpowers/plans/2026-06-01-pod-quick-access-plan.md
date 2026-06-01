# 快捷访问 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "快捷访问" card between Pod 状态 and 实时日志 with Quick Access URL, Terminal Command, and Add Port features.

**Architecture:** Backend extends K8s service API to return clusterIP+containers data and support adding ports via PATCH. Frontend adds a new Card with three sections and an AddPortDialog component.

**Tech Stack:** Express.js + @kubernetes/client-node (backend), React 19 + shadcn/ui (frontend)

---

### Task 1: Backend - extend getDeploymentDetail with clusterIP and containers

**Files:**
- Modify: `dashboard/backend/src/services/k8s.service.ts:265-312`

- [ ] **Step 1: Add clusterIP to endpoint, containers to pods**

Edit `k8s.service.ts` in `getDeploymentDetail()`:

In the endpoints mapping, add `clusterIP`:
```typescript
const endpoints = (svcList.items || []).map((s: any) => {
    const nodePort = s.spec?.type === 'NodePort' ? s.spec.ports?.[0]?.nodePort : null;
    const port = s.spec?.ports?.[0]?.port || 0;
    return {
      name: s.metadata!.name,
      type: s.spec?.type || '',
      port,
      nodePort,
      clusterIP: s.spec?.clusterIP || '',
      url: nodePort ? `http://<node-ip>:${nodePort}` : null,
    };
  });
```

In the pods mapping, add `containers`:
```typescript
pods: (podList.items || []).map((p: any) => ({
      name: p.metadata!.name,
      status: p.status!.phase,
      restarts: p.status!.containerStatuses?.[0]?.restartCount || 0,
      ip: p.status!.podIP || '',
      containers: (p.spec?.containers || []).map((c: any) => c.name),
    })),
```

- [ ] **Step 2: Verify the backend compiles**

Run: `cd dashboard/backend && npx tsc --noEmit`
Expected: No errors

---

### Task 2: Backend - add addServicePort() function

**Files:**
- Modify: `dashboard/backend/src/services/k8s.service.ts` (add new export function)

- [ ] **Step 1: Add addServicePort function**

After `scaleDeployment()` (around line 263), add:

```typescript
export async function addServicePort(name: string, namespace: string, port: number) {
  const svcName = `${name}-svc`;
  const svc: any = await k8sCoreApi.readNamespacedService({ name: svcName, namespace });

  if (!svc.spec) svc.spec = {};
  if (!svc.spec.ports) svc.spec.ports = [];

  const existing = svc.spec.ports.find((p: any) => p.port === port);
  if (existing) return svc; // already exists

  svc.spec.ports.push({
    port,
    targetPort: port,
    protocol: 'TCP',
    name: `port-${port}`,
  });

  const result = await k8sCoreApi.replaceNamespacedService({ name: svcName, namespace, body: svc });
  return result;
}
```

- [ ] **Step 2: Add import for k8sCoreApi if needed**

`k8sCoreApi` is already imported at line 1.

- [ ] **Step 3: Verify compilation**

Run: `cd dashboard/backend && npx tsc --noEmit`
Expected: No errors

---

### Task 3: Backend - add PATCH /deployments/:name/ports route

**Files:**
- Modify: `dashboard/backend/src/routes/deployments.ts` (add import and new route)

- [ ] **Step 1: Add import for addServicePort**

Edit line 8 to add `addServicePort`:
```typescript
import {
  getRunningDeployments,
  createDeployment,
  deleteDeployment,
  scaleDeployment,
  getDeploymentDetail,
  addServicePort,
} from '../services/k8s.service.js';
```

- [ ] **Step 2: Add PATCH /:name/ports route**

After the DELETE route (line 68), add:
```typescript
// PATCH /:name/ports — add port to service
router.patch('/:name/ports', async (req: Request, res: Response) => {
  try {
    const namespace = (req.query.namespace as string) || 'default';
    const { port } = req.body;
    if (!port || typeof port !== 'number') {
      res.status(400).json({ error: 'port is required and must be a number' });
      return;
    }
    const result = await addServicePort(req.params.name as string, namespace, port);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verify compilation**

Run: `cd dashboard/backend && npx tsc --noEmit`
Expected: No errors

---

### Task 4: Frontend - create AddPortDialog component

**Files:**
- Create: `dashboard/frontend/src/components/AddPortDialog.tsx`

- [ ] **Step 1: Create AddPortDialog component**

```typescript
import { useState } from 'react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
  containers: string[];
  deploymentName: string;
  namespace: string;
  onSuccess: () => void;
}

export function AddPortDialog({ open, onClose, containers, deploymentName, namespace, onSuccess }: Props) {
  const [selectedContainer, setSelectedContainer] = useState(containers[0] || '');
  const [port, setPort] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!port || !selectedContainer) return;
    setLoading(true);
    try {
      await api.addDeploymentPort(deploymentName, namespace, Number(port));
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加端口</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>容器名</Label>
            <Select value={selectedContainer} onValueChange={setSelectedContainer}>
              <SelectTrigger>
                <SelectValue placeholder="选择容器" />
              </SelectTrigger>
              <SelectContent>
                {containers.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>暴露端口</Label>
            <Input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="例如: 8080"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSubmit} disabled={loading || !port || !selectedContainer}>
            {loading ? '添加中...' : '确认'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add addDeploymentPort to API client**

Edit `dashboard/frontend/src/api/client.ts`, add method to `api` object:
```typescript
addDeploymentPort: (name: string, ns: string, port: number) =>
    request<any>(`/deployments/${name}/ports?namespace=${ns}`, { method: 'PATCH', body: JSON.stringify({ port }) }),
```

- [ ] **Step 3: Verify compilation**

Run: `cd dashboard/frontend && npx tsc --noEmit`
Expected: No errors

---

### Task 5: Frontend - add 快捷访问 card to DeploymentDetailPage

**Files:**
- Modify: `dashboard/frontend/src/pages/DeploymentDetailPage.tsx`

- [ ] **Step 1: Add imports**

Add to the import section:
```typescript
import { Copy, ExternalLink, Plus } from 'lucide-react';
import { AddPortDialog } from '@/components/AddPortDialog';
```

- [ ] **Step 2: Add state for the dialog**

Inside the component, add:
```typescript
const [portDialogOpen, setPortDialogOpen] = useState(false);
```

- [ ] **Step 3: Add 快捷访问 card between Pod 状态 and 实时日志**

After the Pod 状态 card (line 138 `</Card>`) and before the 实时日志 card (line 140), insert:

```tsx
{/* 快捷访问 */}
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>快捷访问</CardTitle>
    <Button size="sm" onClick={() => setPortDialogOpen(true)}>
      <Plus className="h-4 w-4 mr-1" /> 添加端口
    </Button>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* Quick Access URL */}
    {detail.endpoints.length > 0 && detail.endpoints[0].clusterIP && (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground w-20">访问地址:</span>
        <a
          href={`http://${detail.endpoints[0].clusterIP}:${detail.endpoints[0].port}`}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline flex items-center gap-1"
        >
          http://{detail.endpoints[0].clusterIP}:{detail.endpoints[0].port}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    )}
    {/* Terminal Command */}
    {detail.pods.map((pod: any) => (
      <div key={pod.name} className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground w-20 shrink-0">终端命令:</span>
        <code className="flex-1 bg-muted px-2 py-1 rounded text-xs break-all">
          kubectl exec -it {pod.name} -n {detail.namespace} -- /bin/sh
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => navigator.clipboard.writeText(`kubectl exec -it ${pod.name} -n ${detail.namespace} -- /bin/sh`)}
          title="复制命令"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    ))}
    {detail.pods.length === 0 && (
      <p className="text-sm text-muted-foreground">暂无 Pod</p>
    )}
  </CardContent>
</Card>

{/* AddPortDialog */}
<AddPortDialog
  open={portDialogOpen}
  onClose={() => setPortDialogOpen(false)}
  containers={detail.pods[0]?.containers || []}
  deploymentName={name!}
  namespace={namespace}
  onSuccess={() => { load(); }}
/>
```

- [ ] **Step 4: Verify compilation**

Run: `cd dashboard/frontend && npx tsc --noEmit`
Expected: No errors

---

### Task 6: Run verification

- [ ] **Step 1: Backend typecheck**

Run: `cd dashboard/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Frontend typecheck and build**

Run: `cd dashboard/frontend && npx tsc --noEmit && npx vite build`
Expected: Build succeeds
