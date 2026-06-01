import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Terminal as TerminalIcon, X } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function TerminalPage() {
  const { name } = useParams<{ name: string }>();
  const [searchParams] = useSearchParams();
  const namespace = searchParams.get('namespace') || 'default';
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termRef.current || !name) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();

    termInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/pods/terminal?pod=${encodeURIComponent(name)}&namespace=${encodeURIComponent(namespace)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'stdout' || msg.type === 'stderr') {
            term.write(atob(msg.data));
          }
          if (msg.event === 'exit') {
            term.write('\r\n\x1b[33m[Process exited - press Enter to reconnect]\x1b[0m\r\n');
            ws.close();
          }
          if (msg.event === 'error') {
            term.write(`\r\n\x1b[31m[Error: ${msg.message}]\x1b[0m\r\n`);
          }
        } catch {
          // ignore
        }
      };

      ws.onopen = () => {
        term.write('\x1b[32m[Connected]\x1b[0m\r\n');
      };

      ws.onclose = () => {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (termInstanceRef.current === term) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = () => {
        term.write('\r\n\x1b[31m[Connection error - retrying in 3s]\x1b[0m\r\n');
      };
    };

    connect();

    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'stdin',
          data: btoa(data),
        }));
      }
    });

    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
      if (wsRef.current?.readyState === WebSocket.OPEN && term.cols && term.rows) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        }));
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(termRef.current);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      term.dispose();
    };
  }, [name, namespace]);

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-700">
        <div className="flex items-center gap-2 text-zinc-200">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-zinc-500">|</span>
          <span className="text-xs text-zinc-400">namespace: {namespace}</span>
        </div>
        <button
          onClick={handleClose}
          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded hover:bg-zinc-700 transition-colors"
        >
          <X className="h-3 w-3" />
          关闭窗口
        </button>
      </div>
      <div ref={termRef} className="flex-1 px-1 py-0.5" />
    </div>
  );
}
