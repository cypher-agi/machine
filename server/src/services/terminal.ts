import { WebSocket, WebSocketServer } from 'ws';
import { Client, type ClientChannel, type ConnectConfig } from 'ssh2';
import type { Server } from 'http';
import { parse } from 'url';
import { database } from './database';

interface TerminalSession {
  ws: WebSocket;
  sshClient: Client;
  stream?: ClientChannel;
  machineId: string;
}

const activeSessions: Map<string, TerminalSession> = new Map();

export function setupTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws/terminal',
  });

  console.log('🖥️  Terminal WebSocket server initialized');

  wss.on('connection', (ws, req) => {
    const { query } = parse(req.url || '', true);
    const machineId = query.machineId as string;
    const sshKeyId = query.sshKeyId as string;

    if (!machineId) {
      ws.send(JSON.stringify({ type: 'error', message: 'Missing machineId parameter' }));
      ws.close();
      return;
    }

    console.log(`Terminal connection request for machine: ${machineId}`);

    // Get machine info
    const machine = database.getMachine(machineId);
    if (!machine) {
      ws.send(JSON.stringify({ type: 'error', message: 'Machine not found' }));
      ws.close();
      return;
    }

    if (!machine.public_ip) {
      ws.send(JSON.stringify({ type: 'error', message: 'Machine has no public IP' }));
      ws.close();
      return;
    }

    if (machine.actual_status !== 'running') {
      ws.send(JSON.stringify({ type: 'error', message: 'Machine is not running' }));
      ws.close();
      return;
    }

    // Get SSH private key
    let privateKey: string | undefined;
    if (sshKeyId) {
      privateKey = database.getSSHKeyPrivateKey(sshKeyId);
      if (!privateKey) {
        ws.send(
          JSON.stringify({ type: 'error', message: 'SSH key not found or no private key stored' })
        );
        ws.close();
        return;
      }
    }

    // Create SSH connection
    const sshClient = new Client();
    const sessionId = `${machineId}-${Date.now()}`;

    const session: TerminalSession = {
      ws,
      sshClient,
      machineId,
    };
    activeSessions.set(sessionId, session);

    ws.send(JSON.stringify({ type: 'status', message: `Connecting to ${machine.public_ip}...` }));

    sshClient.on('ready', () => {
      console.log(`SSH connection established to ${machine.public_ip}`);
      ws.send(JSON.stringify({ type: 'status', message: 'Connected!' }));

      sshClient.shell({ term: 'xterm-256color', cols: 80, rows: 24 }, (err, stream) => {
        if (err) {
          ws.send(JSON.stringify({ type: 'error', message: `Shell error: ${err.message}` }));
          ws.close();
          return;
        }

        session.stream = stream;
        ws.send(JSON.stringify({ type: 'connected' }));

        // Forward SSH output to WebSocket
        stream.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'data', data: data.toString('utf8') }));
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'data', data: data.toString('utf8') }));
          }
        });

        stream.on('close', () => {
          ws.send(JSON.stringify({ type: 'disconnected', message: 'SSH session closed' }));
          ws.close();
        });
      });
    });

    sshClient.on('error', (err) => {
      console.error(`SSH error for ${machine.public_ip}:`, err.message);
      ws.send(JSON.stringify({ type: 'error', message: `SSH error: ${err.message}` }));
      ws.close();
    });

    sshClient.on('close', () => {
      console.log(`SSH connection closed for ${machine.public_ip}`);
      activeSessions.delete(sessionId);
    });

    // Handle WebSocket messages
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.type) {
          case 'data':
            // Forward terminal input to SSH
            if (session.stream) {
              session.stream.write(msg.data);
            }
            break;

          case 'resize':
            // Handle terminal resize
            if (session.stream && msg.cols && msg.rows) {
              session.stream.setWindow(msg.rows, msg.cols, 0, 0);
            }
            break;
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket closed for machine ${machineId}`);
      sshClient.end();
      activeSessions.delete(sessionId);
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      sshClient.end();
      activeSessions.delete(sessionId);
    });

    // Initiate SSH connection
    if (!privateKey) {
      // Fallback: try without key (will fail if no password auth)
      ws.send(
        JSON.stringify({ type: 'error', message: 'No SSH key provided. Please select an SSH key.' })
      );
      ws.close();
      return;
    }

    const sshConfig: ConnectConfig = {
      host: machine.public_ip,
      port: 22,
      username: 'root',
      readyTimeout: 30000,
      keepaliveInterval: 10000,
      privateKey,
    };

    try {
      sshClient.connect(sshConfig);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ws.send(JSON.stringify({ type: 'error', message: `Connection failed: ${message}` }));
      ws.close();
    }
  });

  return wss;
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}
