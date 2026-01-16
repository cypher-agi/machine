import { useQuery } from '@tanstack/react-query';
import {
  GitCommit,
  User,
  Copy,
  ExternalLink,
  FolderGit2,
  ChevronRight,
  GitMerge,
  Tag,
  GitPullRequest,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { CommitWithRepo as _CommitWithRepo } from '@machina/shared';
import { getCommit } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { copyToClipboard } from '@/shared/lib';
import { Badge, Button } from '@/shared/ui';
import {
  SidekickHeader,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
  SidekickPanel,
  SidekickSection,
  SidekickRow,
} from '../../components';
import styles from './CommitDetail.module.css';

export interface CommitDetailProps {
  commitId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

// Parse conventional commit type from message
function parseCommitType(message: string): { type: string | null; cleanMessage: string } {
  const match = message.match(/^(\w+)(?:\([^)]+\))?!?:\s*/);
  if (match && match[1]) {
    const type = match[1].toLowerCase();
    const knownTypes = [
      'feat',
      'fix',
      'chore',
      'docs',
      'style',
      'refactor',
      'test',
      'perf',
      'ci',
      'build',
      'revert',
      'wip',
    ];
    if (knownTypes.includes(type)) {
      return { type, cleanMessage: message.slice(match[0].length) };
    }
  }
  return { type: null, cleanMessage: message };
}

// Get commit type styling
function getCommitTypeClass(type: string): string {
  const classMap: Record<string, string> = {
    feat: styles['commitTypeFeat'] ?? '',
    fix: styles['commitTypeFix'] ?? '',
    docs: styles['commitTypeDocs'] ?? '',
    refactor: styles['commitTypeRefactor'] ?? '',
    test: styles['commitTypeTest'] ?? '',
    perf: styles['commitTypePerf'] ?? '',
    chore: styles['commitTypeChore'] ?? '',
    ci: styles['commitTypeChore'] ?? '',
    build: styles['commitTypeChore'] ?? '',
    revert: styles['commitTypeRevert'] ?? '',
    wip: styles['commitTypeWip'] ?? '',
    style: styles['commitTypeChore'] ?? '',
  };
  return classMap[type] ?? '';
}

export function CommitDetail({ commitId, onClose, onMinimize }: CommitDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();

  const { data: commit, isLoading } = useQuery({
    queryKey: ['commit', commitId],
    queryFn: () => getCommit(commitId),
  });

  const handleCopy = async (text: string, label: string) => {
    try {
      await copyToClipboard(text);
      addToast({ type: 'success', title: 'Copied', message: `${label} copied` });
    } catch {
      addToast({ type: 'error', title: 'Copy failed' });
    }
  };

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!commit) {
    return <SidekickLoading message="Commit not found" />;
  }

  const { type, cleanMessage } = parseCommitType(commit.message_headline);
  const hasBody = commit.message && commit.message.trim() !== commit.message_headline.trim();
  const body = hasBody ? commit.message.slice(commit.message_headline.length).trim() : null;

  return (
    <>
      <SidekickHeader
        icon={<GitCommit size={18} />}
        name={cleanMessage}
        nameSans
        subtitle={`${commit.author_name} · ${formatDistanceToNow(new Date(commit.authored_at), { addSuffix: true })}`}
        statusBadge={commit.is_merge_commit ? <Badge variant="muted">merge</Badge> : undefined}
        onClose={onClose}
        onMinimize={onMinimize}
        quickCode={commit.short_sha}
        quickCodeLabel="SHA"
      />

      <SidekickContent>
        <SidekickPanel>
          {/* Stats Grid */}
          <div className={styles['statsGrid']}>
            <div className={styles['statCard']}>
              <div className={styles['statValue']}>{commit.stats.files_changed}</div>
              <div className={styles['statLabel']}>Files</div>
            </div>
            <div className={styles['statCard']}>
              <div className={`${styles['statValue']} ${styles['statValueAdditions']}`}>
                +{commit.stats.additions.toLocaleString()}
              </div>
              <div className={styles['statLabel']}>Additions</div>
            </div>
            <div className={styles['statCard']}>
              <div className={`${styles['statValue']} ${styles['statValueDeletions']}`}>
                -{commit.stats.deletions.toLocaleString()}
              </div>
              <div className={styles['statLabel']}>Deletions</div>
            </div>
          </div>

          {/* Commit Message */}
          <div className={styles['commitMessage']}>
            <h3 className={styles['commitHeadline']}>
              {type && (
                <span className={`${styles['commitType']} ${getCommitTypeClass(type)}`}>
                  {type}
                </span>
              )}
              {cleanMessage}
            </h3>
            {body && <pre className={styles['commitBody']}>{body}</pre>}
          </div>

          {/* Badges */}
          <div className={styles['badges']}>
            {commit.is_merge_commit && (
              <span className={`${styles['badge']} ${styles['badgeMerge']}`}>
                <GitMerge size={12} />
                Merge Commit
              </span>
            )}
            {commit.is_on_default_branch && (
              <span className={`${styles['badge']} ${styles['badgeDefault']}`}>Default Branch</span>
            )}
            {commit.branch_name && <span className={styles['badge']}>{commit.branch_name}</span>}
          </div>

          {/* Author Section */}
          <div className={styles['authorSection']}>
            <div className={styles['authorAvatar']}>
              {commit.contributor?.avatar_url ? (
                <img src={commit.contributor.avatar_url} alt={commit.author_name} />
              ) : (
                <User size={20} />
              )}
            </div>
            <div className={styles['authorInfo']}>
              <div className={styles['authorName']}>{commit.author_name}</div>
              <div className={styles['authorEmail']}>{commit.author_email}</div>
            </div>
          </div>

          {/* Repository Link */}
          <SidekickSection title="Repository">
            <div
              className={styles['repoLink']}
              onClick={() => setSidekickSelection({ type: 'repository', id: commit.repo_id })}
            >
              <FolderGit2 size={16} className={styles['repoIcon']} />
              <span className={styles['repoName']}>
                {commit.repository.full_name.includes('/') ? (
                  <>
                    <span className={styles['repoOrg']}>
                      {commit.repository.full_name.split('/')[0]}/
                    </span>
                    {commit.repository.full_name.split('/')[1]}
                  </>
                ) : (
                  commit.repository.full_name
                )}
              </span>
              <ChevronRight size={14} className={styles['repoChevron']} />
            </div>
          </SidekickSection>

          {/* Tags */}
          {commit.tag_names && commit.tag_names.length > 0 && (
            <SidekickSection title="Tags">
              <div className={styles['tagsContainer']}>
                {commit.tag_names.map((tag) => (
                  <span key={tag} className={styles['tag']}>
                    <Tag size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            </SidekickSection>
          )}

          {/* Associated PRs */}
          {commit.pr_numbers && commit.pr_numbers.length > 0 && (
            <SidekickSection title="Pull Requests">
              <div className={styles['prList']}>
                {commit.pr_numbers.map((prNum) => (
                  <span key={prNum} className={styles['prBadge']}>
                    <GitPullRequest size={12} />#{prNum}
                  </span>
                ))}
              </div>
            </SidekickSection>
          )}

          {/* Parent Commits */}
          {commit.parent_shas && commit.parent_shas.length > 0 && (
            <SidekickSection title="Parent Commits">
              <div className={styles['parentsList']}>
                {commit.parent_shas.map((sha) => (
                  <code key={sha} className={styles['parentSha']}>
                    {sha.slice(0, 7)}
                  </code>
                ))}
              </div>
            </SidekickSection>
          )}

          {/* Details */}
          <SidekickSection title="Details">
            <SidekickRow label="Full SHA" value={commit.sha} mono copyable />
            <SidekickRow label="Authored" value={format(new Date(commit.authored_at), 'PPpp')} />
            {commit.committer_name && commit.committer_name !== commit.author_name && (
              <SidekickRow label="Committer" value={commit.committer_name} />
            )}
            {commit.committed_at !== commit.authored_at && (
              <SidekickRow
                label="Committed"
                value={format(new Date(commit.committed_at), 'PPpp')}
              />
            )}
            <SidekickRow label="Source" value={commit.source_type} />
          </SidekickSection>
        </SidekickPanel>
      </SidekickContent>

      <SidekickActionBar spread>
        <div className={styles['actionGroup']}>
          <Button variant="secondary" size="sm" onClick={() => handleCopy(commit.sha, 'Full SHA')}>
            <Copy size={14} />
            Copy SHA
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(commit.html_url, '_blank')}
          >
            <ExternalLink size={14} />
            View on GitHub
          </Button>
        </div>
      </SidekickActionBar>
    </>
  );
}
