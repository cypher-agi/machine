import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  RefreshCw, 
  Package,
  Trash2,
  Edit,
  Lock,
  Cloud,
  Terminal,
  Play,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getBootstrapProfiles, deleteBootstrapProfile } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/shared/ui';
import type { BootstrapMethod, BootstrapProfile } from '@machine/shared';
import styles from './BootstrapPage.module.css';

const methodIcons: Record<BootstrapMethod, typeof Cloud> = {
  cloud_init: Cloud,
  ssh_script: Terminal,
  ansible: Play,
};

const methodLabels: Record<BootstrapMethod, string> = {
  cloud_init: 'Cloud-Init',
  ssh_script: 'SSH Script',
  ansible: 'Ansible',
};

function BootstrapPage() {
  const { addToast } = useAppStore();
  const queryClient = useQueryClient();
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  const { data: profiles, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['bootstrap-profiles'],
    queryFn: getBootstrapProfiles,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBootstrapProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bootstrap-profiles'] });
      addToast({ type: 'success', title: 'Profile deleted' });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Delete failed', message: error.message });
    },
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Bootstrap Profiles</h1>
          <span className={styles.count}>{profiles?.length ?? 0}</span>
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" iconOnly onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" size="sm">
            <Plus size={14} />
            New Profile
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <span className={styles.loadingText}>Loading profiles...</span>
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className={styles.grid}>
            {profiles.map((profile) => {
              const MethodIcon = methodIcons[profile.method];

              return (
                <div key={profile.profile_id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.methodIcon}>
                      <MethodIcon size={24} />
                    </div>

                    <div className={styles.cardInfo}>
                      <div className={styles.cardNameRow}>
                        <h3 className={styles.cardName}>{profile.name}</h3>
                        {profile.is_system_profile && (
                          <span className={styles.systemBadge}>
                            <Lock size={12} />
                            System
                          </span>
                        )}
                        <span className={styles.methodBadge}>
                          {methodLabels[profile.method]}
                        </span>
                      </div>

                      <p className={styles.cardDescription}>
                        {profile.description || 'No description'}
                      </p>

                      {/* Services */}
                      {profile.services_to_run.length > 0 && (
                        <div className={styles.tagSection}>
                          <span className={styles.tagLabel}>Services:</span>
                          <div className={styles.tagList}>
                            {profile.services_to_run.map((svc) => (
                              <span key={svc.service_name} className={styles.serviceTag}>
                                {svc.display_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
                      {profile.tags && profile.tags.length > 0 && (
                        <div className={styles.tagSection}>
                          <span className={styles.tagLabel}>Tags:</span>
                          <div className={styles.tagList}>
                            {profile.tags.map((tag) => (
                              <span key={tag} className={styles.tag}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={styles.cardActions}>
                      <span className={styles.timestamp}>
                        {formatDistanceToNow(new Date(profile.updated_at), { addSuffix: true })}
                      </span>
                      {!profile.is_system_profile && (
                        <>
                          <Button variant="ghost" size="sm" iconOnly>
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            onClick={() => {
                              if (confirm(`Delete profile "${profile.name}"?`)) {
                                deleteMutation.mutate(profile.profile_id);
                              }
                            }}
                            style={{ color: 'var(--color-error)' }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* View Template Button */}
                  {profile.cloud_init_template && (
                    <div className={styles.templateSection}>
                      <button
                        onClick={() => setExpandedProfile(expandedProfile === profile.profile_id ? null : profile.profile_id)}
                        className={styles.templateToggle}
                      >
                        <Eye size={16} />
                        View Template
                        {expandedProfile === profile.profile_id ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </button>
                      
                      {expandedProfile === profile.profile_id && (
                        <div className={styles.templateContent}>
                          <pre className={styles.templateCode}>
                            {profile.cloud_init_template}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyContent}>
              <div className={styles.emptyIcon}>
                <Package size={32} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div className={styles.emptyText}>
                <h3 className={styles.emptyTitle}>No bootstrap profiles</h3>
                <p className={styles.emptyDesc}>
                  Create a profile to define what gets installed on your machines at boot.
                </p>
                <Button variant="primary" size="sm">
                  <Plus size={14} />
                  New Profile
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BootstrapPage;
