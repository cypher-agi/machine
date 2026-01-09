import { ArrowRightLeft, ExternalLink, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import type { Agent } from '@machina/shared';
import { SidekickPanel, SidekickSection } from '../../components';
import { mockTransactions } from '@/apps/agents/mock';
import styles from './AgentDetail.module.css';

interface AgentTransactionsTabProps {
  agent: Agent;
}

export function AgentTransactionsTab({ agent }: AgentTransactionsTabProps) {
  // Filter transactions for this agent
  const transactions = mockTransactions.filter((tx) => tx.agent_id === agent.agent_id);

  if (transactions.length === 0) {
    return (
      <SidekickPanel>
        <SidekickSection title="Transactions" icon={<ArrowRightLeft size={12} />}>
          <p className={styles.emptyText}>
            {agent.wallet_chain
              ? 'No transactions yet for this agent.'
              : 'This agent does not have a wallet configured.'}
          </p>
        </SidekickSection>
      </SidekickPanel>
    );
  }

  return (
    <SidekickPanel>
      <SidekickSection
        title={`Transactions (${transactions.length})`}
        icon={<ArrowRightLeft size={12} />}
      >
        <div className={styles.transactionsList}>
          {transactions.map((tx) => (
            <div key={tx.transaction_id} className={styles.transactionItem}>
              <div className={styles.txHeader}>
                <div className={styles.txType}>
                  <span className={styles.txTypeLabel}>{tx.type}</span>
                  <span className={styles.txChain}>{tx.chain.toUpperCase()}</span>
                </div>
                <div
                  className={clsx(
                    styles.txStatus,
                    tx.status === 'confirmed' && styles.txStatusConfirmed,
                    tx.status === 'pending' && styles.txStatusPending,
                    tx.status === 'failed' && styles.txStatusFailed
                  )}
                >
                  {tx.status === 'confirmed' && <CheckCircle size={12} />}
                  {tx.status === 'pending' && <Loader2 size={12} className="animate-spin" />}
                  {tx.status === 'failed' && <XCircle size={12} />}
                  {tx.status}
                </div>
              </div>

              {tx.amount && (
                <div className={styles.txAmount}>
                  {tx.amount} {tx.token}
                </div>
              )}

              <div className={styles.txAddresses}>
                <div className={styles.txAddress}>
                  <span className={styles.txAddressLabel}>From</span>
                  <code className={styles.txAddressValue}>
                    {tx.from_address.slice(0, 10)}...{tx.from_address.slice(-6)}
                  </code>
                </div>
                {tx.to_address && (
                  <div className={styles.txAddress}>
                    <span className={styles.txAddressLabel}>To</span>
                    <code className={styles.txAddressValue}>
                      {tx.to_address.slice(0, 10)}...{tx.to_address.slice(-6)}
                    </code>
                  </div>
                )}
              </div>

              <div className={styles.txFooter}>
                <span className={styles.txTime}>
                  <Clock size={10} />
                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                </span>
                {tx.tx_hash && (
                  <a
                    href={`https://explorer.example.com/tx/${tx.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.txExplorer}
                  >
                    <ExternalLink size={10} />
                    Explorer
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </SidekickSection>
    </SidekickPanel>
  );
}
