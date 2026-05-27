import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, MemoryStick, Rocket } from 'lucide-react';
import { api } from '@/api/client';
import { ResourceCard } from '@/components/ResourceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function OverviewPage() {
  const [data, setData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getOverview().then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="text-muted-foreground">加载中...</div>;

  const { resources, deployments } = data;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">概览</h2>

      <div className="grid grid-cols-4 gap-4">
        <ResourceCard
          title="GPU"
          used={resources.gpu.used}
          total={resources.gpu.total}
          icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
        />
        <ResourceCard
          title="CPU"
          used={parseInt(resources.cpu.used) || 0}
          total={parseInt(resources.cpu.total) || 0}
          icon={<Cpu className="h-4 w-4 text-muted-foreground" />}
        />
        <ResourceCard
          title="内存"
          used={parseKi(resources.memory.used)}
          total={parseKi(resources.memory.total)}
          unit="Gi"
          icon={<MemoryStick className="h-4 w-4 text-muted-foreground" />}
        />
        <ResourceCard
          title="运行中服务"
          used={resources.runningDeployments}
          total={deployments.length}
          icon={<Rocket className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>运行中服务</CardTitle>
          <Button size="sm" onClick={() => navigate('/deployments')}>
            <Rocket className="h-4 w-4 mr-1" /> 创建部署
          </Button>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无部署服务</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">名称</th>
                  <th className="pb-2">镜像</th>
                  <th className="pb-2">状态</th>
                  <th className="pb-2">GPU</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d: any) => (
                  <tr
                    key={d.name}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/deployments/${d.name}?namespace=${d.namespace}`)}
                  >
                    <td className="py-2 font-medium">{d.name}</td>
                    <td className="py-2 text-muted-foreground">{d.image}</td>
                    <td className="py-2">
                      <StatusBadge ready={d.readyReplicas} replicas={d.replicas} />
                    </td>
                    <td className="py-2">{d.vgpu > 0 ? `${d.vgpu} vGPU` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function parseKi(val: string): number {
  if (!val) return 0;
  if (val.endsWith('Ki')) return Math.round(parseInt(val) / 1024 / 1024 * 10) / 10;
  if (val.endsWith('Mi')) return Math.round(parseInt(val) / 1024 * 10) / 10;
  if (val.endsWith('Gi')) return parseInt(val);
  return parseInt(val) || 0;
}