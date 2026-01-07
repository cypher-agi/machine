import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rebootMachine, destroyMachine, restartMachineService } from '@/lib/api';
import { useAppStore } from '@/store/appStore';

export interface UseMachineActionsOptions {
  machineId: string;
  machineName: string;
}

export function useMachineActions({ machineId, machineName }: UseMachineActionsOptions) {
  const queryClient = useQueryClient();
  const { addToast } = useAppStore();

  const rebootMutation = useMutation({
    mutationFn: () => rebootMachine(machineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      addToast({ type: 'success', title: 'Reboot initiated', message: `Rebooting ${machineName}` });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Reboot failed', message: error.message });
    },
  });

  const destroyMutation = useMutation({
    mutationFn: () => destroyMachine(machineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      addToast({
        type: 'success',
        title: 'Destroy initiated',
        message: `Destroying ${machineName}`,
      });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Destroy failed', message: error.message });
    },
  });

  const restartServiceMutation = useMutation({
    mutationFn: (serviceName: string) => restartMachineService(machineId, serviceName),
    onSuccess: (_, serviceName) => {
      queryClient.invalidateQueries({ queryKey: ['machines'] });
      addToast({
        type: 'success',
        title: 'Service restart initiated',
        message: `Restarting ${serviceName}`,
      });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: 'Service restart failed', message: error.message });
    },
  });

  return {
    reboot: () => rebootMutation.mutate(),
    destroy: () => destroyMutation.mutate(),
    restartService: (serviceName: string) => restartServiceMutation.mutate(serviceName),
    isRebooting: rebootMutation.isPending,
    isDestroying: destroyMutation.isPending,
    isRestartingService: restartServiceMutation.isPending,
  };
}
