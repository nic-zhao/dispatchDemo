import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { api } from '@/api/client';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function DeploymentsPage() {
  const [deployments, setDeployments] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = () => {
    api.getDeployments().then(setDeployments).catch(console.error);
  };

  useEffect(() => {
    load();
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
        <Button onClick={() => navigate('/create')}>
          <Plus className="h-4 w-4 mr-1" /> 创建部署
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">名称</th>
                <th className="p-3">类型</th>
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
                  <td className="p-3 text-muted-foreground">{d.kind || 'Deployment'}</td>
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
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    暂无部署，点击"创建部署"开始
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

    </div>
  );
}