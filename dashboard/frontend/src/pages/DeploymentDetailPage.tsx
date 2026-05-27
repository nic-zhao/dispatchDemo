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