import { api } from './client';

export interface User {
  userId: string;
  username: string;
  role: string;
  tenantId?: string;
  tenantName?: string;
  tenantDomain?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TenantLoginRequest {
  email: string;
  password: string;
}

export const authApi = {
  login: async (data: LoginRequest) => {
    const response = await api.post<{ user: User }>('/auth/login', data);
    return response.data;
  },

  loginTenant: async (data: TenantLoginRequest) => {
    const response = await api.post<{ user: User }>('/auth/login/tenant', data);
    return response.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  getMe: async () => {
    const response = await api.get<{ user: User }>('/auth/me');
    return response.data;
  },
};
