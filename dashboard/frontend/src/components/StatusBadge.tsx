import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  ready: number;
  replicas: number;
}

export function StatusBadge({ ready, replicas }: StatusBadgeProps) {
  if (ready === replicas && replicas > 0) {
    return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Running</Badge>;
  }
  if (replicas === 0) {
    return <Badge variant="secondary">Stopped</Badge>;
  }
  return <Badge variant="outline" className="text-yellow-600 border-yellow-400">Pending</Badge>;
}