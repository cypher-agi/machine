import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { copyToClipboard } from '@/shared/lib';
import { useAppStore } from '@/store/appStore';
import styles from '../../Sidekick/Sidekick.module.css';

export type CodeLanguage = 'hcl' | 'yaml' | 'bash' | 'json' | 'text';

// Custom syntax highlighting theme based on app's design
const customTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'var(--color-elevated)',
    margin: 0,
    padding: 0,
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
  },
};

export interface SidekickCodeProps {
  children: string;
}

export function SidekickCode({ children }: SidekickCodeProps) {
  return <pre className={styles.codeBlock}>{children}</pre>;
}

export interface SidekickCodeHighlightProps {
  children: string;
  language?: CodeLanguage;
}

export function SidekickCodeHighlight({ children, language = 'hcl' }: SidekickCodeHighlightProps) {
  return (
    <div className={styles.codeHighlight}>
      <SyntaxHighlighter
        language={language}
        style={customTheme}
        customStyle={{
          background: 'var(--color-elevated)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          margin: 0,
          overflow: 'auto',
        }}
        wrapLongLines={false}
        showLineNumbers={true}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: 'var(--space-3)',
          color: 'var(--color-text-muted)',
          textAlign: 'right',
          userSelect: 'none',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export interface SidekickFullCodeProps {
  children: string;
  language?: CodeLanguage;
  title?: string;
}

/** Full-height code view that fills the sidekick content area */
export function SidekickFullCode({ children, language = 'hcl', title }: SidekickFullCodeProps) {
  const { addToast } = useAppStore();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(children);
    setCopied(true);
    addToast({ type: 'info', title: 'Copied', message: 'Template copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.fullCodeContainer}>
      {title && (
        <div className={styles.fullCodeHeader}>
          <span className={styles.fullCodeTitle}>{title}</span>
          <button 
            className={styles.fullCodeCopyButton} 
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}
      <div className={styles.fullCodeContent}>
        <SyntaxHighlighter
          language={language}
          style={customTheme}
          customStyle={{
            background: 'var(--color-elevated)',
            margin: 0,
            padding: 'var(--space-3)',
            height: '100%',
            overflow: 'auto',
          }}
          wrapLongLines={false}
          showLineNumbers={true}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: 'var(--space-3)',
            color: 'var(--color-text-muted)',
            textAlign: 'right',
            userSelect: 'none',
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export interface SidekickJsonProps {
  data: unknown;
}

export function SidekickJson({ data }: SidekickJsonProps) {
  return <pre className={styles.jsonPreview}>{JSON.stringify(data, null, 2)}</pre>;
}

