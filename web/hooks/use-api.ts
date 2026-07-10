'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { request } from '@/lib/api';

export function useApiRequest() {
  const { getToken } = useAuth();

  const apiRequest = useCallback(
    async (method: string, path: string, body: any = null) => {
      const token = await getToken();
      return request(method, path, body, token);
    },
    [getToken],
  );

  return apiRequest;
}

export function useApiToken() {
  const { getToken } = useAuth();
  return getToken;
}
