import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function PodStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'Running':
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Running</Badge>;
    case 'Pending':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>;
    case 'Failed':
    case 'Error':
      return <Badge variant="destructive">Error</Badge>;
    case 'Succeeded':
      return <Badge variant="secondary">Completed</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function PodsPage() {
  const [pods, setPods] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = () => {
    api.getPods().then(setPods).catch(console.error);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (name: string, ns: string) => {
    if (!confirm(`确认删除 Pod ${name}? 如果被 Deployment 管理，Pod 将自动重建。`)) return;
    await api.deletePod(name, ns);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">任务列表</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">名称</th>
                  <th className="p-3">命名空间</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">重启</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">镜像</th>
                  <th className="p-3">节点</th>
                  <th className="p-3">创建时间</th>
                  <th className="p-3">管理者</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {pods.map((p) => (
                  <tr
                    key={`${p.namespace}-${p.name}`}
                    className="border-b last:border-0 hover:bg-muted/50"
                  >
                    <td
                      className="p-3 font-medium cursor-pointer"
                      onClick={() => navigate(`/pods/${p.name}?namespace=${p.namespace}`)}
                    >
                      {p.name}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.namespace}</td>
                    <td className="p-3">
                      <PodStatusBadge status={p.status} />
                    </td>
                    <td className="p-3">{p.restarts}</td>
                    <td className="p-3 text-muted-foreground">{p.ip || '-'}</td>
                    <td className="p-3 text-muted-foreground max-w-[200px] truncate">{p.image}</td>
                    <td className="p-3 text-muted-foreground">{p.node || '-'}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="p-3 text-muted-foreground">{p.owner}</td>
                    <td className="p-3">
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(p.name, p.namespace)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {pods.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      暂无 Pod 数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
