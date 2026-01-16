import { useState, useRef } from 'react';
import { Camera, Trash2, Upload, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { Avatar, Button } from '@/shared';
import styles from './AvatarUpload.module.css';

export function AvatarUpload() {
  const { user, uploadAvatar, deleteAvatar } = useAuthStore();
  const { addToast } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File too large', message: 'Maximum size is 2MB' });
      return;
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      addToast({
        type: 'error',
        title: 'Invalid file type',
        message: 'Use JPG, PNG, GIF, or WebP',
      });
      return;
    }

    setUploading(true);
    try {
      await uploadAvatar(file);
      addToast({ type: 'success', title: 'Profile picture updated' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload';
      addToast({ type: 'error', title: 'Upload failed', message });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAvatar();
      addToast({ type: 'success', title: 'Profile picture removed' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove';
      addToast({ type: 'error', title: 'Removal failed', message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div
        className={clsx(styles.avatarWrapper, (uploading || deleting) && styles.avatarLoading)}
        onClick={() => !uploading && !deleting && fileInputRef.current?.click()}
      >
        {uploading || deleting ? (
          <div className={styles.loadingState}>
            <Loader2 size={24} className={styles.spinner} />
          </div>
        ) : (
          <>
            <Avatar
              name={user?.display_name || 'User'}
              src={user?.profile_picture_url}
              size="xl"
              className={styles.avatar}
            />
            <div className={styles.overlay}>
              <Camera size={20} />
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className={styles.fileInput}
      />

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || deleting}
        >
          <Upload size={14} />
          Upload
        </Button>
        {user?.profile_picture_url && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={uploading || deleting}
            className={styles.deleteButton}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
