import { api } from './client';

export interface Deployment {
  id: string;
  siteId: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  message?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  site?: {
    name: string;
    domain: string;
    slug: string;
  };
}

export interface DeploymentLog {
  id: string;
  status: string;
  message?: string;
  log: string;
}

export const deploymentsApi = {
  getAll: async (siteId?: string) => {
    const params = siteId ? { siteId } : undefined;
    const response = await api.get<{ deployments: Deployment[] }>('/deployments', { params });
    return response.data.deployments;
  },

  getById: async (id: string) => {
    const response = await api.get<{ deployment: Deployment }>(`/deployments/${id}`);
    return response.data.deployment;
  },

  getLog: async (id: string) => {
    const response = await api.get<DeploymentLog>(`/deployments/${id}/log`);
    return response.data;
  },
};
