import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import clsx from 'clsx';
import styles from './SSHTerminal.module.css';

interface SSHTerminalProps {
  machineId: string;
  sshKeyId: string;
  machineName: string;
  machineIp: string;
  onDisconnect?: () => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function SSHTerminal({ 
  machineId, 
  sshKeyId, 
  machineName,
  machineIp,
  onDisconnect 
}: SSHTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<ConnectionStatus>('connecting');
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage] = useState('Initializing...');

  // Keep statusRef in sync
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#e4e4e7',
        cursor: '#22d3ee',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#22d3ee33',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa',
      },
      allowTransparency: true,
      scrollback: 10000,
    });

    terminalInstance.current = terminal;

    // Add addons
    const fit = new FitAddon();
    fitAddon.current = fit;
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());

    // Open terminal in container
    terminal.open(terminalRef.current);
    fit.fit();

    // Handle resize
    const handleResize = () => {
      fit.fit();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows
        }));
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Connect WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = '3001'; // API port
    const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws/terminal?machineId=${machineId}&sshKeyId=${sshKeyId}`;

    terminal.writeln(`\x1b[36m━━━ Connecting to ${machineName} (${machineIp}) ━━━\x1b[0m`);
    terminal.writeln('');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connecting');
      setStatusMessage('WebSocket connected, establishing SSH...');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        switch (msg.type) {
          case 'status':
            setStatusMessage(msg.message);
            terminal.writeln(`\x1b[33m${msg.message}\x1b[0m`);
            break;
          
          case 'connected':
            setStatus('connected');
            setStatusMessage('Connected');
            // Send initial resize
            ws.send(JSON.stringify({
              type: 'resize',
              cols: terminal.cols,
              rows: terminal.rows
            }));
            break;
          
          case 'data':
            terminal.write(msg.data);
            break;
          
          case 'error':
            setStatus('error');
            setStatusMessage(msg.message);
            terminal.writeln(`\x1b[31mError: ${msg.message}\x1b[0m`);
            break;
          
          case 'disconnected':
            setStatus('disconnected');
            setStatusMessage(msg.message || 'Disconnected');
            terminal.writeln('');
            terminal.writeln(`\x1b[33m${msg.message || 'Connection closed'}\x1b[0m`);
            onDisconnect?.();
            break;
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setStatusMessage('WebSocket connection failed');
      terminal.writeln('\x1b[31mWebSocket connection failed\x1b[0m');
    };

    ws.onclose = () => {
      if (statusRef.current !== 'error') {
        setStatus('disconnected');
        setStatusMessage('Connection closed');
      }
    };

    // Handle terminal input
    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    });

    // Cleanup
    return () => {
      resizeObserver.disconnect();
      ws.close();
      terminal.dispose();
    };
  }, [machineId, sshKeyId, machineName, machineIp, onDisconnect]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      fitAddon.current?.fit();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const statusIndicatorClass = clsx(
    styles.statusIndicator,
    status === 'connected' && styles.statusConnected,
    status === 'connecting' && styles.statusConnecting,
    status === 'error' && styles.statusError,
    status === 'disconnected' && styles.statusDisconnected
  );

  return (
    <div className={styles.container}>
      {/* Status bar */}
      <div className={styles.statusBar}>
        <div className={styles.statusInfo}>
          <div className={statusIndicatorClass} />
          <span className={styles.machineInfo}>
            {machineName} ({machineIp})
          </span>
        </div>
        <span className={styles.statusMessage}>
          {statusMessage}
        </span>
      </div>
      
      {/* Terminal container */}
      <div 
        ref={terminalRef} 
        className={styles.terminalContainer}
      />
    </div>
  );
}

