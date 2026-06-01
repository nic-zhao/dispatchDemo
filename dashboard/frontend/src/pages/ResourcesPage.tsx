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
