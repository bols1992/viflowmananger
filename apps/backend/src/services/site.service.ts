import { prisma } from '../db.js';
import { AppError } from '../middleware/error.js';
import { generateSlug, isValidSlug } from '../utils/slug.js';
import { isValidDomain } from '../utils/domain.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { hashPassword } from '../utils/password.js';

export interface CreateSiteDto {
  name: string;
  domain: string;
  description?: string;
  basicAuthPassword: string;
  basicAuthEnabled?: boolean;
}

export class SiteService {
  /**
   * Create a new site
   */
  async createSite(dto: CreateSiteDto) {
    // Validate domain
    if (!isValidDomain(dto.domain)) {
      throw new AppError(400, 'Invalid domain format');
    }

    // Check domain uniqueness
    const existingDomain = await prisma.site.findUnique({
      where: { domain: dto.domain },
    });

    if (existingDomain) {
      throw new AppError(409, 'Domain already exists');
    }

    // Generate slug
    let slug = generateSlug(dto.name);

    if (!slug || !isValidSlug(slug)) {
      throw new AppError(400, 'Invalid site name - cannot generate valid slug');
    }

    // Ensure slug uniqueness
    let counter = 1;
    let uniqueSlug = slug;
    while (await prisma.site.findUnique({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }
    slug = uniqueSlug;

    const site = await prisma.site.create({
      data: {
        name: dto.name,
        domain: dto.domain,
        slug,
        description: dto.description,
        basicAuthUser: config.BASIC_AUTH_DEFAULT_USER,
        basicAuthPassword: dto.basicAuthPassword,
        basicAuthEnabled: dto.basicAuthEnabled ?? true,
      },
    });

    logger.info({ siteId: site.id, slug, domain: site.domain }, 'Site created');

    return site;
  }

  /**
   * Get all sites
   */
  async getSites() {
    return prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { deployments: true },
        },
      },
    });
  }

  /**
   * Get site by ID
   */
  async getSiteById(id: string) {
    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!site) {
      throw new AppError(404, 'Site not found');
    }

    return site;
  }

  /**
   * Delete site
   */
  async deleteSite(id: string) {
    const site = await prisma.site.findUnique({ where: { id } });

    if (!site) {
      throw new AppError(404, 'Site not found');
    }

    await prisma.site.delete({ where: { id } });

    logger.info({ siteId: id, slug: site.slug }, 'Site deleted');

    return { success: true };
  }
}

export const siteService = new SiteService();
