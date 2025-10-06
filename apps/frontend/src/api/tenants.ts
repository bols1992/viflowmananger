import { api } from './client';

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sites: number;
  };
  sites?: {
    id: string;
    name: string;
    domain: string;
    containerStatus: string;
  }[];
}

export interface CreateTenantDto {
  name: string;
  domain: string;
  email: string;
  password: string;
}

export interface UpdateTenantDto {
  name?: string;
  domain?: string;
  email?: string;
  password?: string;
  active?: boolean;
}

export const tenantsApi = {
  async getAll(): Promise<Tenant[]> {
    const response = await api.get('/tenants');
    return response.data;
  },

  async getById(id: string): Promise<Tenant> {
    const response = await api.get(`/tenants/${id}`);
    return response.data;
  },

  async create(data: CreateTenantDto): Promise<Tenant> {
    const response = await api.post('/tenants', data);
    return response.data;
  },

  async update(id: string, data: UpdateTenantDto): Promise<Tenant> {
    const response = await api.put(`/tenants/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/tenants/${id}`);
  },
};
