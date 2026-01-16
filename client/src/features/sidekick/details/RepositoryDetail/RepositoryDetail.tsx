import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderGit2, RefreshCw, Trash2 } from 'lucide-react';
import { getRepository, syncRepository, deleteRepository } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { Button, ConfirmModal } from '@/shared';
import {
  SidekickHeader,
  SidekickTabs,
  SidekickContent,
  SidekickLoading,
  SidekickActionBar,
} from '../../components';
import { RepositoryOverview } from './RepositoryOverview';
import { RepositoryCommits } from './RepositoryCommits';
import { RepositoryContributors } from './RepositoryContributors';
import styles from './RepositoryDetail.module.css';

export interface RepositoryDetailProps {
  repositoryId: string;
  onClose: () => void;
  onMinimize?: () => void;
}

type TabId = 'overview' | 'commits' | 'contributors';

const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'commits', label: 'Commits' },
  { id: 'contributors', label: 'Contributors' },
];

export function RepositoryDetail({ repositoryId, onClose, onMinimize }: RepositoryDetailProps) {
  const { addToast, setSidekickSelection } = useAppStore();
  const { getCurrentTeam, currentTeamId } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentTeamRole = getCurrentTeam()?.role;
  const isAdmin = currentTeamRole === 'admin';

  const { data: repository, isLoading } = useQuery({
    queryKey: ['repository', repositoryId],
    queryFn: () => getRepository(repositoryId),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncRepository(repositoryId),
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['repository', repositoryId] });
      await queryClient.cancelQueries({ queryKey: ['repositories', currentTeamId] });

      // Snapshot the previous value
      const previousRepository = queryClient.getQueryData(['repository', repositoryId]);
      const previousRepositories = queryClient.getQueryData(['repositories', currentTeamId]);

      // Optimistically update to syncing status
      queryClient.setQueryData(['repository', repositoryId], (old: typeof repository) =>
        old ? { ...old, sync_status: 'syncing' } : old
      );
      queryClient.setQueryData(
        ['repositories', currentTeamId],
        (old: (typeof repository)[] | undefined) =>
          old?.map((repo: typeof repository) =>
            repo.repo_id === repositoryId ? { ...repo, sync_status: 'syncing' } : repo
          )
      );

      return { previousRepository, previousRepositories };
    },
    onSuccess: (result) => {
      addToast({
        type: 'success',
        title: 'Sync Complete',
        message: `Synced ${result.commits_synced} commits and ${result.prs_synced} PRs`,
      });
      queryClient.invalidateQueries({ queryKey: ['repository', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repositories', currentTeamId] });
      queryClient.invalidateQueries({ queryKey: ['repository-commits', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['repository-contributors', repositoryId] });
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousRepository) {
        queryClient.setQueryData(['repository', repositoryId], context.previousRepository);
      }
      if (context?.previousRepositories) {
        queryClient.setQueryData(['repositories', currentTeamId], context.previousRepositories);
      }
      addToast({
        type: 'error',
        title: 'Sync Failed',
        message: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRepository(repositoryId),
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'Repository Removed',
        message: 'Repository has been removed from tracking',
      });
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setSidekickSelection(null);
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Delete Failed',
        message: error.message,
      });
    },
  });

  if (isLoading) {
    return <SidekickLoading />;
  }

  if (!repository) {
    return (
      <div className={styles['loading']}>
        <span>Repository not found</span>
      </div>
    );
  }

  return (
    <>
      <SidekickHeader
        icon={<FolderGit2 size={18} />}
        name={repository.full_name}
        nameSans
        subtitle={repository.description}
        onClose={onClose}
        onMinimize={onMinimize}
      />

      <SidekickTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as TabId)}
      />

      <SidekickContent>
        {activeTab === 'overview' && <RepositoryOverview repository={repository} />}
        {activeTab === 'commits' && <RepositoryCommits repositoryId={repositoryId} />}
        {activeTab === 'contributors' && <RepositoryContributors repositoryId={repositoryId} />}
      </SidekickContent>

      {isAdmin && (
        <SidekickActionBar spread>
          <div className={styles['actionGroup']}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || repository.sync_status === 'syncing'}
            >
              <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            className={styles['dangerButton']}
          >
            <Trash2 size={14} />
          </Button>
        </SidekickActionBar>
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Remove Repository"
        message={`Are you sure you want to remove "${repository.full_name}" from tracking? This will delete all synced commits and pull requests.`}
        confirmLabel="Remove"
        danger
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}
