import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/apiClient';

export interface TaskInitiativeInput {
  dayNumber: string;
  stepCategory: string;
  taskTitle: string;
  taskDescription: string;
  basePoints: number;
  proofType: string;
  isMilestone: boolean;
  milestoneLabel?: string;
  bonusPoints?: number;
}

export const useCreateTaskInitiative = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: TaskInitiativeInput) => {
      const res: any = await apiClient.post('/api/tasks/initiative', data);
      return res.data || res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useListTasks = () => {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res: any = await apiClient.get('/api/tasks');
      return res.data || res;
    },
  });
};
