# Create Deployment Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the create-deployment modal into a standalone `/create` route page.

**Architecture:** Create a new `CreateDeploymentPage.tsx` using the form content from the existing modal, adapt it to a page layout (no Dialog wrapper). Update routing, navigation targets in DeploymentsPage and ImagesPage, then delete the old modal.

**Tech Stack:** React, react-router-dom, shadcn/ui components

---

### Task 1: Create CreateDeploymentPage.tsx

**Files:**
- Create: `dashboard/frontend/src/pages/CreateDeploymentPage.tsx`

- [ ] **Step 1: Write CreateDeploymentPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

export function CreateDeploymentPage() {
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    api.getImages().then(setImages).catch(console.error);
  }, []);

  const prefillImage = searchParams.get('image');

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
    navigate(`/deployments/${form.name}?namespace=${form.namespace}`);
  };

  return (
    <div className="space-y-6">
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate('/deployments')}>取消</Button>
        <Button onClick={handleCreate} disabled={!selected || !form.name}>
          创建
        </Button>
      </div>
    </div>
  );
}
```

---

### Task 2: Modify App.tsx — add /create route

**Files:**
- Modify: `dashboard/frontend/src/App.tsx`

- [ ] **Step 1: Add import for CreateDeploymentPage**

After the line `import { ResourcesPage } from './pages/ResourcesPage';`, add:
```tsx
import { CreateDeploymentPage } from './pages/CreateDeploymentPage';
```

- [ ] **Step 2: Add /create route**

After the line `<Route path="/resources" element={<ResourcesPage />} />`, add:
```tsx
          <Route path="/create" element={<CreateDeploymentPage />} />
```

---

### Task 3: Modify DeploymentsPage.tsx — navigate to /create

**Files:**
- Modify: `dashboard/frontend/src/pages/DeploymentsPage.tsx`

- [ ] **Step 1: Remove unused imports**

Remove `CreateDeploymentModal` import line:
```tsx
// DELETE this line:
import { CreateDeploymentModal } from './CreateDeploymentModal';
```

Also remove `useSearchParams` from the react-router-dom import since it's no longer used. Change:
```tsx
import { useNavigate, useSearchParams } from 'react-router-dom';
```
to:
```tsx
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Remove modal state and image param handling**

Replace:
```tsx
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
```
with:
```tsx
  const navigate = useNavigate();

  const load = () => {
    api.getDeployments().then(setDeployments).catch(console.error);
  };

  useEffect(() => {
    load();
  }, []);
```

- [ ] **Step 3: Replace button onClick**

Replace:
```tsx
        <Button onClick={() => { setPrefillImage(''); setShowCreate(true); }}>
```
with:
```tsx
        <Button onClick={() => navigate('/create')}>
```

- [ ] **Step 4: Remove CreateDeploymentModal JSX**

Remove these lines from the bottom:
```tsx
      <CreateDeploymentModal
        open={showCreate}
        onClose={() => { setShowCreate(false); load(); }}
        prefillImage={prefillImage}
      />
```

---

### Task 4: Modify ImagesPage.tsx — navigate to /create

**Files:**
- Modify: `dashboard/frontend/src/pages/ImagesPage.tsx`

- [ ] **Step 1: Change navigate target**

In the `handleCreate` function, change:
```tsx
    navigate(`/deployments?image=${encodeURIComponent(fullName)}`);
```
to:
```tsx
    navigate(`/create?image=${encodeURIComponent(fullName)}`);
```

---

### Task 5: Delete CreateDeploymentModal.tsx

**Files:**
- Delete: `dashboard/frontend/src/pages/CreateDeploymentModal.tsx`

- [ ] **Step 1: Delete the file**

Run:
```bash
rm dashboard/frontend/src/pages/CreateDeploymentModal.tsx
```

---

### Task 6: Verify

- [ ] **Step 1: Run build check**

```bash
cd dashboard/frontend && npx tsc --noEmit
```

Expected: No TypeScript errors.
