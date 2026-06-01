import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, ExternalLink, Terminal } from 'lucide-react';
import { api } from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { LogViewer } from '@/components/LogViewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const JUPYTERHUB_URL = 'http://100.93.76.54:32080/';

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

function hasJupyterLink(detail: any): boolean {
  const name = (detail.name || '').toLowerCase();
  const containers: { name: string; image: string }[] = detail.containers || [];
  return containers.some((c) => c.image.toLowerCase().includes('jupyter')) || name.includes('jupyter');
}

export function PodDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const namespace = searchParams.get('namespace') || 'default';
  const navigate = useNavigate();
  const [detail, setDetail] = useState<any>(null);

  const load = () => {
    if (name) {
      api.getPodDetail(name, namespace).then(setDetail).catch(console.error);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [name, namespace]);

  if (!detail) return <div className="text-muted-foreground">加载中...</div>;

  const handleDelete = async () => {
    if (!confirm(`确认删除 Pod ${name}? 如果被 Deployment 管理，Pod 将自动重建。`)) return;
    await api.deletePod(name!, namespace);
    navigate('/pods');
  };

  const openTerminal = () => {
    window.open(`/pods/${name}/terminal?namespace=${namespace}`, '_blank');
  };

  const isRunning = detail.status === 'Running';
  const showJupyter = hasJupyterLink(detail);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pods')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-2xl font-semibold">{detail.name}</h2>
        <PodStatusBadge status={detail.status} />
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">命名空间</span>
              <p className="font-medium">{detail.namespace}</p>
            </div>
            <div>
              <span className="text-muted-foreground">IP</span>
              <p className="font-medium">{detail.ip || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">节点</span>
              <p className="font-medium">{detail.node || '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">创建时间</span>
              <p className="font-medium">{new Date(detail.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">重启次数</span>
              <p className="font-medium">{detail.restarts}</p>
            </div>
            <div>
              <span className="text-muted-foreground">管理者</span>
              <p className="font-medium">{detail.owner}</p>
            </div>
          </div>

          {/* 容器列表 */}
          {detail.containers && detail.containers.length > 0 && (
            <div className="mt-4">
              <span className="text-muted-foreground">容器</span>
              <div className="mt-1 space-y-1">
                {detail.containers.map((c: any) => (
                  <div key={c.name} className="text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-muted-foreground">{c.image}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 快捷访问 */}
      <Card>
        <CardHeader>
          <CardTitle>快捷访问</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {showJupyter && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground w-20">应用界面:</span>
              <a
                href={JUPYTERHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline flex items-center gap-1"
              >
                JupyterHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground w-20">SSH 终端:</span>
            <Button
              size="sm"
              onClick={openTerminal}
              disabled={!isRunning}
              title={isRunning ? '打开终端' : 'Pod 未运行'}
            >
              <Terminal className="h-4 w-4 mr-1" /> 打开终端
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 条件 */}
      {detail.conditions && detail.conditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>状态条件</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2">类型</th>
                  <th className="pb-2">状态</th>
                  <th className="pb-2">原因</th>
                  <th className="pb-2">消息</th>
                </tr>
              </thead>
              <tbody>
                {detail.conditions.map((c: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 font-medium">{c.type}</td>
                    <td className="py-2">{c.status}</td>
                    <td className="py-2 text-muted-foreground">{c.reason}</td>
                    <td className="py-2 text-muted-foreground">{c.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 日志 */}
      <Card>
        <CardHeader>
          <CardTitle>实时日志</CardTitle>
        </CardHeader>
        <CardContent>
          <LogViewer name={name!} namespace={namespace} logType="pod" />
        </CardContent>
      </Card>

      {/* 操作 */}
      <Card>
        <CardHeader>
          <CardTitle>操作</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1" /> 删除 Pod
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
