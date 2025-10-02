import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface DockerContainerInfo {
  name: string;
  port: number;
  status: 'building' | 'running' | 'stopped' | 'error';
}

export class DockerService {
  private static readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
  private static readonly NGINX_SITES_DIR = '/etc/nginx/sites-enabled';
  private static readonly BASE_PORT = 8100;
  private static usedPorts = new Set<number>();
  private static readonly DOCKER_CMD = '/usr/bin/docker'; // Use full path to avoid alias issues

  /**
   * Find next available port starting from BASE_PORT
   */
  static async getAvailablePort(): Promise<number> {
    // Check existing containers to avoid conflicts
    try {
      const { stdout } = await execAsync(
        `${this.DOCKER_CMD} ps -a --format "{{.Ports}}"`
      );
      const ports = stdout
        .split('\n')
        .map((line) => {
          const match = line.match(/:(\d+)->/);
          return match ? parseInt(match[1]) : null;
        })
        .filter((p) => p !== null) as number[];

      ports.forEach((p) => this.usedPorts.add(p));
    } catch (error) {
      logger.warn('Could not fetch existing Docker ports', error);
    }

    // Find free port
    let port = this.BASE_PORT;
    while (this.usedPorts.has(port)) {
      port++;
    }
    this.usedPorts.add(port);
    return port;
  }

  /**
   * Find the DLL in extracted files (might be in subdirectory)
   */
  static async findViFlowDll(extractPath: string): Promise<string | null> {
    const dllName = 'ViCon.ViFlow.WebModel.Server.dll';

    // Check root directory first
    const rootDllPath = path.join(extractPath, dllName);
    try {
      await fs.access(rootDllPath);
      return extractPath; // DLL is in root
    } catch {
      // Search in subdirectories (max depth 2)
      const searchDirs = async (dir: string, depth: number): Promise<string | null> => {
        if (depth > 2) return null;

        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            if (entry.isDirectory()) {
              const subPath = path.join(dir, entry.name);
              const dllPath = path.join(subPath, dllName);

              try {
                await fs.access(dllPath);
                return subPath; // Found DLL in subdirectory
              } catch {
                // Continue searching
                const found = await searchDirs(subPath, depth + 1);
                if (found) return found;
              }
            }
          }
        } catch (error) {
          logger.warn(`Error searching directory ${dir}`, error);
        }

        return null;
      };

      return await searchDirs(extractPath, 0);
    }
  }

  /**
   * Detect ViFlow version from extracted files
   */
  static async detectViFlowVersion(dllPath: string): Promise<'7' | '8'> {
    try {
      // Check if DLL exists
      const fullDllPath = path.join(dllPath, 'ViCon.ViFlow.WebModel.Server.dll');
      try {
        await fs.access(fullDllPath);
      } catch {
        throw new Error('ViFlow DLL not found');
      }

      // Try to read runtimeconfig.json for exact .NET version
      const runtimeConfigPath = path.join(dllPath, 'ViCon.ViFlow.WebModel.Server.runtimeconfig.json');
      try {
        const content = await fs.readFile(runtimeConfigPath, 'utf-8');
        const config = JSON.parse(content);

        // Check framework version
        const frameworkVersion = config?.runtimeOptions?.framework?.version;
        if (frameworkVersion) {
          logger.info(`Found .NET framework version: ${frameworkVersion}`);

          // .NET 8.x -> ViFlow 8
          if (frameworkVersion.startsWith('8.')) {
            return '8';
          }
          // .NET 6.x -> ViFlow 8 (uses same image)
          if (frameworkVersion.startsWith('6.')) {
            return '8';
          }
          // .NET 3.1.x -> ViFlow 7
          if (frameworkVersion.startsWith('3.1')) {
            return '7';
          }
        }
      } catch (error) {
        logger.warn('Could not read runtimeconfig.json', error);
      }

      // Fallback: check other files
      const possibleIndicators = ['appsettings.json'];
      for (const file of possibleIndicators) {
        const filePath = path.join(dllPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');

          if (content.includes('net8.0') || content.includes('net6.0')) {
            return '8';
          }
          if (content.includes('netcoreapp3.1')) {
            return '7';
          }
        } catch {
          continue;
        }
      }

      // Default to version 8 if detection fails
      logger.warn('Could not detect ViFlow version, defaulting to 8');
      return '8';
    } catch (error) {
      logger.error('Error detecting ViFlow version', error);
      throw error;
    }
  }

  /**
   * Generate Dockerfile content based on ViFlow version
   */
  static generateDockerfile(viflowVersion: '7' | '8', dllSubPath?: string): string {
    // ViFlow 8 uses .NET 6/8 (we use 6 for broader compatibility)
    // ViFlow 7 uses .NET Core 3.1
    const baseImage =
      viflowVersion === '8'
        ? 'mcr.microsoft.com/dotnet/aspnet:6.0'
        : 'mcr.microsoft.com/dotnet/core/aspnet:3.1';

    // If DLL is in a subdirectory, copy from there
    const copySource = dllSubPath ? `${dllSubPath}/.` : '.';

    return `FROM ${baseImage}
WORKDIR /app
COPY ${copySource} .
EXPOSE 5001
ENV ASPNETCORE_URLS=http://+:5001
ENTRYPOINT ["dotnet", "ViCon.ViFlow.WebModel.Server.dll"]
`;
  }

  /**
   * Build Docker image for a site
   */
  static async buildImage(
    siteId: string,
    extractPath: string,
    viflowVersion: '7' | '8',
    dllSubPath?: string
  ): Promise<string> {
    const imageName = `viflow-site-${siteId}`;

    try {
      // Create Dockerfile
      const dockerfilePath = path.join(extractPath, 'Dockerfile');
      const dockerfileContent = this.generateDockerfile(viflowVersion, dllSubPath);
      await fs.writeFile(dockerfilePath, dockerfileContent);

      logger.info(`Building Docker image ${imageName}...`);

      // Build image
      // Use DOCKER_BUILDKIT=0 to force classic builder
      const { stdout, stderr } = await execAsync(
        `DOCKER_BUILDKIT=0 ${this.DOCKER_CMD} build -t ${imageName} "${extractPath}"`,
        { maxBuffer: 1024 * 1024 * 10 } // 10MB buffer for build output
      );

      logger.info(`Docker build stdout: ${stdout}`);
      if (stderr) logger.warn(`Docker build stderr: ${stderr}`);

      logger.info(`Successfully built image ${imageName}`);
      return imageName;
    } catch (error: any) {
      logger.error(`Failed to build Docker image ${imageName}`, error);
      throw new Error(`Docker build failed: ${error.message}`);
    }
  }

  /**
   * Start Docker container for a site
   */
  static async startContainer(
    siteId: string,
    imageName: string,
    port: number
  ): Promise<string> {
    const containerName = `viflow-site-${siteId}`;

    try {
      // Stop and remove existing container if it exists
      await this.stopContainer(containerName).catch(() => {});
      await this.removeContainer(containerName).catch(() => {});

      logger.info(
        `Starting container ${containerName} on port ${port}...`
      );

      // Start new container (map host port to container port 5001)
      const { stdout } = await execAsync(
        `${this.DOCKER_CMD} run -d --name ${containerName} -p ${port}:5001 --restart unless-stopped ${imageName}`
      );

      const containerId = stdout.trim();
      logger.info(`Container ${containerName} started with ID ${containerId}`);

      return containerName;
    } catch (error: any) {
      logger.error(`Failed to start container ${containerName}`, error);
      throw new Error(`Failed to start container: ${error.message}`);
    }
  }

  /**
   * Stop Docker container
   */
  static async stopContainer(containerName: string): Promise<void> {
    try {
      logger.info(`Stopping container ${containerName}...`);
      await execAsync(`${this.DOCKER_CMD} stop ${containerName}`);
      logger.info(`Container ${containerName} stopped`);
    } catch (error: any) {
      logger.error(`Failed to stop container ${containerName}`, error);
      throw new Error(`Failed to stop container: ${error.message}`);
    }
  }

  /**
   * Start existing Docker container
   */
  static async startExistingContainer(containerName: string): Promise<void> {
    try {
      logger.info(`Starting container ${containerName}...`);
      await execAsync(`${this.DOCKER_CMD} start ${containerName}`);
      logger.info(`Container ${containerName} started`);
    } catch (error: any) {
      logger.error(`Failed to start container ${containerName}`, error);
      throw new Error(`Failed to start container: ${error.message}`);
    }
  }

  /**
   * Remove Docker container
   */
  static async removeContainer(containerName: string): Promise<void> {
    try {
      logger.info(`Removing container ${containerName}...`);
      await execAsync(`${this.DOCKER_CMD} rm -f ${containerName}`);
      logger.info(`Container ${containerName} removed`);
    } catch (error: any) {
      // It's okay if container doesn't exist
      logger.warn(`Could not remove container ${containerName}`, error);
    }
  }

  /**
   * Remove Docker image
   */
  static async removeImage(imageName: string): Promise<void> {
    try {
      logger.info(`Removing image ${imageName}...`);
      await execAsync(`${this.DOCKER_CMD} rmi -f ${imageName}`);
      logger.info(`Image ${imageName} removed`);
    } catch (error: any) {
      logger.warn(`Could not remove image ${imageName}`, error);
    }
  }

  /**
   * Get container status
   */
  static async getContainerStatus(
    containerName: string
  ): Promise<'running' | 'stopped' | 'error'> {
    try {
      const { stdout } = await execAsync(
        `${this.DOCKER_CMD} inspect -f '{{.State.Status}}' ${containerName}`
      );
      const status = stdout.trim();

      if (status === 'running') return 'running';
      if (status === 'exited' || status === 'created') return 'stopped';
      return 'error';
    } catch (error) {
      return 'stopped';
    }
  }

  /**
   * Generate Nginx configuration for a site
   */
  static generateNginxConfig(domain: string, port: number): string {
    return `server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:${port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
`;
  }

  /**
   * Write Nginx config and reload
   */
  static async updateNginxConfig(
    domain: string,
    port: number
  ): Promise<void> {
    try {
      const configPath = path.join(
        this.NGINX_SITES_DIR,
        `viflow-${domain}.conf`
      );
      const config = this.generateNginxConfig(domain, port);

      logger.info(`Writing Nginx config to ${configPath}...`);

      // Write to temp file first, then move with sudo
      const tempPath = `/tmp/viflow-nginx-${domain}.conf`;
      await fs.writeFile(tempPath, config);

      // Move to nginx directory with sudo
      await execAsync(`sudo mv ${tempPath} ${configPath}`);
      await execAsync(`sudo chmod 644 ${configPath}`);

      // Test nginx config
      logger.info('Testing Nginx configuration...');
      await execAsync('sudo nginx -t');

      // Reload nginx
      logger.info('Reloading Nginx...');
      await execAsync('sudo nginx -s reload');

      logger.info('Nginx configuration updated successfully');
    } catch (error: any) {
      logger.error('Failed to update Nginx config', error);
      throw new Error(`Failed to update Nginx: ${error.message}`);
    }
  }

  /**
   * Remove Nginx config for a site
   */
  static async removeNginxConfig(domain: string): Promise<void> {
    try {
      const configPath = path.join(
        this.NGINX_SITES_DIR,
        `viflow-${domain}.conf`
      );

      logger.info(`Removing Nginx config ${configPath}...`);
      await fs.unlink(configPath);

      // Reload nginx
      logger.info('Reloading Nginx...');
      await execAsync('sudo nginx -s reload');

      logger.info('Nginx configuration removed successfully');
    } catch (error: any) {
      logger.warn('Failed to remove Nginx config', error);
    }
  }

  /**
   * Sync container status from Docker to database on startup
   */
  static async syncContainerStatus(): Promise<void> {
    try {
      logger.info('Syncing container status from Docker...');
      const { stdout } = await execAsync(`${this.DOCKER_CMD} ps -a --filter "name=viflow-site-" --format "{{.Names}}\t{{.Status}}"`);

      if (!stdout.trim()) {
        logger.info('No ViFlow containers found');
        return;
      }

      const containers = stdout.trim().split('\n');
      const prisma = (await import('../db.js')).prisma;

      for (const line of containers) {
        const [containerName, statusText] = line.split('\t');
        const siteId = containerName.replace('viflow-site-', '');

        // Determine status from Docker status text
        let status: 'running' | 'stopped' | 'error' = 'stopped';
        if (statusText.toLowerCase().includes('up')) {
          status = 'running';
        } else if (statusText.toLowerCase().includes('exited') || statusText.toLowerCase().includes('created')) {
          status = 'stopped';
        }

        // Update database
        await prisma.site.update({
          where: { id: siteId },
          data: { containerStatus: status },
        }).catch((err) => {
          logger.warn(`Could not update status for site ${siteId}:`, err.message);
        });

        logger.info(`Synced ${containerName}: ${status}`);
      }

      logger.info('Container status sync completed');
    } catch (error: any) {
      logger.error('Failed to sync container status:', error.message);
    }
  }

  /**
   * Complete cleanup of a site's Docker resources
   */
  static async cleanup(siteId: string, domain: string, deleteUploadDir = true): Promise<void> {
    const containerName = `viflow-site-${siteId}`;
    const imageName = `viflow-site-${siteId}`;

    await this.stopContainer(containerName).catch(() => {});
    await this.removeContainer(containerName).catch(() => {});
    await this.removeImage(imageName).catch(() => {});
    await this.removeNginxConfig(domain).catch(() => {});

    // Remove uploaded files only if requested
    if (deleteUploadDir) {
      const uploadPath = path.join(this.UPLOAD_DIR, siteId);
      try {
        await fs.rm(uploadPath, { recursive: true, force: true });
        logger.info(`Removed upload directory ${uploadPath}`);
      } catch (error) {
        logger.warn(`Could not remove upload directory ${uploadPath}`, error);
      }
    }
  }
}
