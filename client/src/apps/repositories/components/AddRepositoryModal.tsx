import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, FolderGit2, Check, Loader2 } from 'lucide-react';
import type { GitHubRepository } from '@machina/shared';
import { getGitHubRepositories, addRepositoriesFromGitHub } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Modal, Button, Input } from '@/shared';
import styles from './AddRepositoryModal.module.css';

interface AddRepositoryModalProps {
  onClose: () => void;
}

export function AddRepositoryModal({ onClose }: AddRepositoryModalProps) {
  const { addToast } = useAppStore();
  const { currentTeamId } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());

  // Fetch GitHub repositories from integration
  const { data: repos, isLoading } = useQuery({
    queryKey: ['github-repositories', currentTeamId],
    queryFn: () => getGitHubRepositories(),
  });

  // Add repositories mutation
  const addMutation = useMutation({
    mutationFn: (repoIds: string[]) => addRepositoriesFromGitHub({ github_repo_ids: repoIds }),
    onSuccess: (added) => {
      addToast({
        type: 'success',
        title: 'Repositories Added',
        message: `Added ${added.length} repository${added.length !== 1 ? 's' : ''} for tracking`,
      });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      onClose();
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Failed to Add Repositories',
        message: error.message,
      });
    },
  });

  // Filter repos by search
  const filteredRepos = repos?.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(search.toLowerCase()) ||
      repo.description?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleRepo = (repoId: string) => {
    const newSelected = new Set(selectedRepoIds);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepoIds(newSelected);
  };

  const handleAdd = () => {
    if (selectedRepoIds.size === 0) return;
    addMutation.mutate(Array.from(selectedRepoIds));
  };

  const footer = (
    <div className={styles['footer']}>
      <Button variant="secondary" size="sm" onClick={onClose}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleAdd}
        disabled={selectedRepoIds.size === 0 || addMutation.isPending}
      >
        {addMutation.isPending ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Adding...
          </>
        ) : (
          <>Add {selectedRepoIds.size > 0 ? `(${selectedRepoIds.size})` : 'Repositories'}</>
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add Repositories"
      className={styles['modal'] ?? ''}
      footer={footer}
    >
      <div className={styles['content']}>
        {/* Search */}
        <div className={styles['searchBox']}>
          <Search size={16} className={styles['searchIcon']} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            size="sm"
            className={styles['searchInput']}
          />
        </div>

        {/* Repository list */}
        <div className={styles['repoList']}>
          {isLoading ? (
            <div className={styles['loadingState']}>
              <Loader2 size={24} className="animate-spin" />
              <span>Loading repositories...</span>
            </div>
          ) : !filteredRepos || filteredRepos.length === 0 ? (
            <div className={styles['emptyState']}>
              {repos && repos.length === 0 ? (
                <>
                  <FolderGit2 size={32} />
                  <p>No repositories found</p>
                  <p className={styles['emptyHint']}>
                    Connect a GitHub integration first to see available repositories.
                  </p>
                </>
              ) : (
                <>
                  <Search size={32} />
                  <p>No matching repositories</p>
                </>
              )}
            </div>
          ) : (
            filteredRepos.map((repo) => (
              <RepoItem
                key={repo.repo_id}
                repo={repo}
                isSelected={selectedRepoIds.has(repo.repo_id)}
                onToggle={() => toggleRepo(repo.repo_id)}
              />
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}

interface RepoItemProps {
  repo: GitHubRepository;
  isSelected: boolean;
  onToggle: () => void;
}

function RepoItem({ repo, isSelected, onToggle }: RepoItemProps) {
  return (
    <button
      type="button"
      className={`${styles['repoItem']} ${isSelected ? styles['repoItemSelected'] : ''}`}
      onClick={onToggle}
    >
      <div className={`${styles['checkbox']} ${isSelected ? styles['checkboxSelected'] : ''}`}>
        {isSelected && <Check size={12} />}
      </div>
      <div className={styles['repoInfo']}>
        <div className={styles['repoName']}>{repo.full_name}</div>
        {repo.description && <div className={styles['repoDesc']}>{repo.description}</div>}
        <div className={styles['repoMeta']}>
          {repo.private && <span className={styles['privateTag']}>Private</span>}
          {repo.language && <span className={styles['metaItem']}>{repo.language}</span>}
          <span className={styles['metaItem']}>{repo.default_branch}</span>
        </div>
      </div>
    </button>
  );
}
