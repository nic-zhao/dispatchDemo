import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';
import * as pty from 'node-pty';

const HEARTBEAT_INTERVAL = 30000;

function buildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env['KUBECONFIG'] = process.env.KUBECONFIG || `${process.env.HOME}/.kube/config`;
  return env;
}

export function handleTerminal(ws: WebSocket, req: IncomingMessage) {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const podName = url.searchParams.get('pod');
  const namespace = url.searchParams.get('namespace') || 'default';

  if (!podName) {
    ws.send(JSON.stringify({ event: 'error', message: 'Missing pod parameter' }));
    ws.close();
    return;
  }

  let ptyProcess: pty.IPty | null = null;
  let alive = true;

  const startProcess = () => {
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }

    ptyProcess = pty.spawn('kubectl', ['exec', '-it', podName, '-n', namespace, '--', '/bin/sh', '-c', 'if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/root',
      env: buildEnv(),
    });

    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'stdout', data: btoa(data) }));
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'exit', code: exitCode }));
      }
      ptyProcess = null;
    });
  };

  startProcess();

  ws.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'stdin' && ptyProcess) {
        ptyProcess.write(atob(msg.data));
      }
      if (msg.type === 'resize' && ptyProcess) {
        const { cols, rows } = msg;
        if (cols && rows) {
          ptyProcess.resize(cols, rows);
        }
      }
      if (msg.type === 'reconnect' && alive) {
        startProcess();
      }
    } catch {
      // ignore malformed messages
    }
  });

  const heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL);

  ws.on('close', () => {
    alive = false;
    clearInterval(heartbeat);
    if (ptyProcess) {
      ptyProcess.kill();
      ptyProcess = null;
    }
  });
}
