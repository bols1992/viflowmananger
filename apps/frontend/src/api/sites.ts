import { api } from './client';

export interface Site {
  id: string;
  name: string;
  domain: string;
  slug: string;
  description?: string;
  basicAuthUser: string;
  basicAuthPassword?: string;
  basicAuthEnabled: boolean;
  viflowVersion?: string;
  containerName?: string;
  containerPort?: number;
  containerStatus?: 'building' | 'running' | 'stopped' | 'error';
  customLogoPath?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    deployments: number;
  };
}

export interface CreateSiteRequest {
  name: string;
  subdomain: string;
  description?: string;
  basicAuthPassword: string;
  basicAuthEnabled?: boolean;
  tenantId?: string;
}

export interface UploadResponse {
  success: boolean;
  file: {
    path: string;
    size: number;
    originalName: string;
  };
}

export const sitesApi = {
  getAll: async () => {
    const response = await api.get<{ sites: Site[] }>('/sites');
    return response.data.sites;
  },

  getById: async (id: string) => {
    const response = await api.get<{ site: Site }>(`/sites/${id}`);
    return response.data.site;
  },

  create: async (data: CreateSiteRequest) => {
    const response = await api.post<{ site: Site }>('/sites', data);
    return response.data.site;
  },

  upload: async (
    id: string,
    file: File,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadResponse>(`/sites/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  deploy: async (id: string, basicAuthPassword: string) => {
    const response = await api.post(`/sites/${id}/deploy`, { basicAuthPassword });
    return response.data;
  },

  delete: async (id: string) => {
    await api.delete(`/sites/${id}`);
  },

  start: async (id: string) => {
    const response = await api.post(`/sites/${id}/start`);
    return response.data;
  },

  stop: async (id: string) => {
    const response = await api.post(`/sites/${id}/stop`);
    return response.data;
  },

  uploadLogo: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await api.post(`/sites/${id}/logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  deleteLogo: async (id: string) => {
    const response = await api.delete(`/sites/${id}/logo`);
    return response.data;
  },
};
