import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';

interface Props {
  name: string;
  namespace: string;
  logType?: 'deployment' | 'pod';
}

export function LogViewer({ name, namespace, logType = 'deployment' }: Props) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = () => {
    const url = logType === 'pod'
      ? api.getPodLogStreamUrl(name, namespace)
      : api.getLogStreamUrl(name, namespace);
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs((prev) => [...prev.slice(-500), data.log]);
      } catch { /* ignore parse errors */ }
    };
    es.onerror = () => {
      setConnected(false);
      es.close();
    };
  };

  const disconnect = () => {
    eventSourceRef.current?.close();
    setConnected(false);
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [name, namespace]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {connected ? '已连接' : '未连接'}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setLogs([])}>清空</Button>
          <Button size="sm" variant="outline" onClick={connected ? disconnect : connect}>
            {connected ? '断开' : '重连'}
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="h-64 overflow-auto bg-zinc-950 text-green-400 rounded-md p-3 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <span className="text-zinc-500">等待日志...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap">{log}</div>
          ))
        )}
      </div>
    </div>
  );
}