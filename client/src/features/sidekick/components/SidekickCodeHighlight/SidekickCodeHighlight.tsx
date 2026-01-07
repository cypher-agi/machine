import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import styles from './SidekickCodeHighlight.module.css';

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
