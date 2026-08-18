import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { login } from '@/services/auth.service';
import { session } from '@/services/api';
import type { SessionUser } from '@/services/types';

export function useAuth() {
  const navigate = useNavigate();
  return {
    user: session.user<SessionUser>(),
    isAuthenticated: session.token() !== null,
    logout(): void {
      session.clear();
      navigate('/login', { replace: true });
    },
  };
}

export function useLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      login(username, password),
    onSuccess(data) {
      session.save(data.accessToken, data.user);
      navigate('/inventory', { replace: true });
    },
  });
}
