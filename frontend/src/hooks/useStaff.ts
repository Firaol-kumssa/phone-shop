import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deactivateUser, listUsers, registerUser } from '@/services/auth.service';

export function useStaff() {
  return useQuery({ queryKey: ['staff'], queryFn: listUsers });
}

export function useRegisterUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
