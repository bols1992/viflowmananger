import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../logger.js';

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

export class TenantService {
  /**
   * Get all tenants (admin only)
   */
  async getAll() {
    return prisma.tenant.findMany({
      include: {
        _count: {
          select: { sites: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get tenant by ID
   */
  async getById(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        sites: {
          select: {
            id: true,
            name: true,
            domain: true,
            containerStatus: true,
          },
        },
        _count: {
          select: { sites: true },
        },
      },
    });

    if (!tenant) {
      throw new AppError(404, 'Tenant not found');
    }

    return tenant;
  }

  /**
   * Get tenant by email (for login)
   */
  async getByEmail(email: string) {
    return prisma.tenant.findUnique({
      where: { email },
    });
  }

  /**
   * Create a new tenant
   */
  async create(data: CreateTenantDto) {
    // Check if email already exists
    const existing = await prisma.tenant.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new AppError(400, 'Email already in use');
    }

    // Check if domain already exists
    const existingDomain = await prisma.tenant.findUnique({
      where: { domain: data.domain },
    });

    if (existingDomain) {
      throw new AppError(400, 'Domain already in use');
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        domain: data.domain,
        email: data.email,
        passwordHash,
      },
    });

    logger.info({ tenantId: tenant.id, email: tenant.email }, 'Tenant created');

    return tenant;
  }

  /**
   * Update tenant
   */
  async update(id: string, data: UpdateTenantDto) {
    const tenant = await prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      throw new AppError(404, 'Tenant not found');
    }

    // Check email uniqueness if changing
    if (data.email && data.email !== tenant.email) {
      const existing = await prisma.tenant.findUnique({
        where: { email: data.email },
      });

      if (existing) {
        throw new AppError(400, 'Email already in use');
      }
    }

    // Check domain uniqueness if changing
    if (data.domain && data.domain !== tenant.domain) {
      const existingDomain = await prisma.tenant.findUnique({
        where: { domain: data.domain },
      });

      if (existingDomain) {
        throw new AppError(400, 'Domain already in use');
      }
    }

    // Hash password if provided
    const updateData: any = {
      name: data.name,
      domain: data.domain,
      email: data.email,
      active: data.active,
    };

    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    logger.info({ tenantId: id }, 'Tenant updated');

    return updated;
  }

  /**
   * Delete tenant
   */
  async delete(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { sites: true },
        },
      },
    });

    if (!tenant) {
      throw new AppError(404, 'Tenant not found');
    }

    // Check if tenant has sites
    if (tenant._count.sites > 0) {
      throw new AppError(400, `Cannot delete tenant with ${tenant._count.sites} active sites`);
    }

    await prisma.tenant.delete({
      where: { id },
    });

    logger.info({ tenantId: id }, 'Tenant deleted');

    return { success: true };
  }

  /**
   * Get tenant's domain for site creation
   */
  async getTenantDomain(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { domain: true },
    });

    if (!tenant) {
      throw new AppError(404, 'Tenant not found');
    }

    return tenant.domain;
  }
}

export const tenantService = new TenantService();
