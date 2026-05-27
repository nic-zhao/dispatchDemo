import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ResourceCardProps {
  title: string;
  used: number;
  total: number;
  unit?: string;
  icon: React.ReactNode;
}

export function ResourceCard({ title, used, total, unit = '', icon }: ResourceCardProps) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {used}{unit} <span className="text-sm font-normal text-muted-foreground">/ {total}{unit}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{pct}% 已分配</p>
      </CardContent>
    </Card>
  );
}