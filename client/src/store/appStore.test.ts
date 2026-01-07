import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './appStore';

describe('AppStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      sidekickSelection: null,
      terminalMachineId: null,
      machineFilters: {},
      machineSort: { field: 'created_at', direction: 'desc' },
      deployWizardOpen: false,
      toasts: [],
    });
  });

  describe('setSidekickSelection', () => {
    it('should set sidekick selection', () => {
      const { setSidekickSelection } = useAppStore.getState();

      setSidekickSelection({ type: 'machine', id: 'machine-1' });

      const { sidekickSelection } = useAppStore.getState();
      expect(sidekickSelection).toEqual({ type: 'machine', id: 'machine-1' });
    });

    it('should set terminal machine ID when selecting a machine', () => {
      const { setSidekickSelection } = useAppStore.getState();

      setSidekickSelection({ type: 'machine', id: 'machine-123' });

      const { terminalMachineId } = useAppStore.getState();
      expect(terminalMachineId).toBe('machine-123');
    });

    it('should clear terminal when selecting non-machine item', () => {
      const { setSidekickSelection, setTerminalMachineId } = useAppStore.getState();

      // First set a machine terminal
      setTerminalMachineId('machine-1');
      expect(useAppStore.getState().terminalMachineId).toBe('machine-1');

      // Select a provider instead
      setSidekickSelection({ type: 'provider', id: 'provider-1' });

      expect(useAppStore.getState().terminalMachineId).toBeNull();
    });

    it('should clear selection when set to null', () => {
      const { setSidekickSelection } = useAppStore.getState();

      setSidekickSelection({ type: 'machine', id: 'machine-1' });
      setSidekickSelection(null);

      const { sidekickSelection } = useAppStore.getState();
      expect(sidekickSelection).toBeNull();
    });
  });

  describe('setTerminalMachineId', () => {
    it('should set terminal machine ID', () => {
      const { setTerminalMachineId } = useAppStore.getState();

      setTerminalMachineId('machine-1');

      const { terminalMachineId } = useAppStore.getState();
      expect(terminalMachineId).toBe('machine-1');
    });

    it('should clear terminal machine ID when set to null', () => {
      const { setTerminalMachineId } = useAppStore.getState();

      setTerminalMachineId('machine-1');
      setTerminalMachineId(null);

      const { terminalMachineId } = useAppStore.getState();
      expect(terminalMachineId).toBeNull();
    });
  });

  describe('setMachineFilters', () => {
    it('should merge filters with existing', () => {
      const { setMachineFilters } = useAppStore.getState();

      setMachineFilters({ status: 'running' });
      setMachineFilters({ provider: 'digitalocean' });

      const { machineFilters } = useAppStore.getState();
      expect(machineFilters).toEqual({
        status: 'running',
        provider: 'digitalocean',
      });
    });

    it('should overwrite existing filter values', () => {
      const { setMachineFilters } = useAppStore.getState();

      setMachineFilters({ status: 'running' });
      setMachineFilters({ status: 'stopped' });

      const { machineFilters } = useAppStore.getState();
      expect(machineFilters.status).toBe('stopped');
    });
  });

  describe('clearMachineFilters', () => {
    it('should reset filters to empty object', () => {
      const { setMachineFilters, clearMachineFilters } = useAppStore.getState();

      setMachineFilters({ status: 'running', provider: 'digitalocean' });
      clearMachineFilters();

      const { machineFilters } = useAppStore.getState();
      expect(machineFilters).toEqual({});
    });
  });

  describe('setMachineSort', () => {
    it('should update sort configuration', () => {
      const { setMachineSort } = useAppStore.getState();

      setMachineSort({ field: 'name', direction: 'asc' });

      const { machineSort } = useAppStore.getState();
      expect(machineSort).toEqual({ field: 'name', direction: 'asc' });
    });
  });

  describe('setDeployWizardOpen', () => {
    it('should toggle deploy wizard state', () => {
      const { setDeployWizardOpen } = useAppStore.getState();

      setDeployWizardOpen(true);
      expect(useAppStore.getState().deployWizardOpen).toBe(true);

      setDeployWizardOpen(false);
      expect(useAppStore.getState().deployWizardOpen).toBe(false);
    });
  });

  describe('addToast', () => {
    it('should add toast with generated ID', () => {
      const { addToast } = useAppStore.getState();

      addToast({ type: 'success', message: 'Test message' });

      const { toasts } = useAppStore.getState();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].id).toBeDefined();
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('Test message');
    });

    it('should generate unique IDs for each toast', () => {
      const { addToast } = useAppStore.getState();

      addToast({ type: 'success', message: 'Toast 1' });
      addToast({ type: 'error', message: 'Toast 2' });

      const { toasts } = useAppStore.getState();
      expect(toasts).toHaveLength(2);
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it('should append new toasts to existing ones', () => {
      const { addToast } = useAppStore.getState();

      addToast({ type: 'info', message: 'First' });
      addToast({ type: 'warning', message: 'Second' });

      const { toasts } = useAppStore.getState();
      expect(toasts).toHaveLength(2);
      expect(toasts[0].message).toBe('First');
      expect(toasts[1].message).toBe('Second');
    });
  });

  describe('removeToast', () => {
    it('should remove toast by ID', () => {
      const { addToast, removeToast } = useAppStore.getState();

      addToast({ type: 'success', message: 'Test' });
      const { toasts } = useAppStore.getState();
      const toastId = toasts[0].id;

      removeToast(toastId);

      expect(useAppStore.getState().toasts).toHaveLength(0);
    });

    it('should only remove the specified toast', () => {
      const { addToast, removeToast } = useAppStore.getState();

      addToast({ type: 'success', message: 'First' });
      addToast({ type: 'error', message: 'Second' });

      const { toasts } = useAppStore.getState();
      const firstToastId = toasts[0].id;

      removeToast(firstToastId);

      const remainingToasts = useAppStore.getState().toasts;
      expect(remainingToasts).toHaveLength(1);
      expect(remainingToasts[0].message).toBe('Second');
    });

    it('should handle removing non-existent toast ID gracefully', () => {
      const { addToast, removeToast } = useAppStore.getState();

      addToast({ type: 'success', message: 'Test' });

      removeToast('non-existent-id');

      expect(useAppStore.getState().toasts).toHaveLength(1);
    });
  });
});
