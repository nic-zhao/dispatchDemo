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
