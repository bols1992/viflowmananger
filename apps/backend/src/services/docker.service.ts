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
   * Detect ViFlow version from extracted files
   */
  static async detectViFlowVersion(extractPath: string): Promise<'7' | '8'> {
    try {
      // Look for the main DLL
      const dllPath = path.join(
        extractPath,
        'ViCon.ViFlow.WebModel.Server.dll'
      );

      // Check if file exists
      try {
        await fs.access(dllPath);
      } catch {
        logger.warn(`Main DLL not found at ${dllPath}, defaulting to version 8`);
        return '8';
      }

      // Try to read assembly info or version file
      // For now, we check for presence of .NET 8 specific files
      const possibleNet8Indicators = [
        'ViCon.ViFlow.WebModel.Server.runtimeconfig.json',
        'appsettings.json'
      ];

      for (const file of possibleNet8Indicators) {
        const filePath = path.join(extractPath, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');

          // Check for .NET 8 or .NET Core 3.1 indicators
          if (content.includes('"version": "8.') || content.includes('net8.0')) {
            return '8';
          }
          if (content.includes('"version": "3.1') || content.includes('netcoreapp3.1')) {
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
      return '8';
    }
  }

  /**
   * Generate Dockerfile content based on ViFlow version
   */
  static generateDockerfile(viflowVersion: '7' | '8'): string {
    const baseImage =
      viflowVersion === '8'
        ? 'mcr.microsoft.com/dotnet/aspnet:8.0'
        : 'mcr.microsoft.com/dotnet/core/aspnet:3.1';

    return `FROM ${baseImage}
WORKDIR /app
COPY . .
EXPOSE 80
ENV ASPNETCORE_URLS=http://+:80
ENTRYPOINT ["dotnet", "ViCon.ViFlow.WebModel.Server.dll"]
`;
  }

  /**
   * Build Docker image for a site
   */
  static async buildImage(
    siteId: string,
    extractPath: string,
    viflowVersion: '7' | '8'
  ): Promise<string> {
    const imageName = `viflow-site-${siteId}`;

    try {
      // Create Dockerfile
      const dockerfilePath = path.join(extractPath, 'Dockerfile');
      const dockerfileContent = this.generateDockerfile(viflowVersion);
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

      // Start new container
      const { stdout } = await execAsync(
        `${this.DOCKER_CMD} run -d --name ${containerName} -p ${port}:80 --restart unless-stopped ${imageName}`
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
      await fs.writeFile(configPath, config);

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
   * Complete cleanup of a site's Docker resources
   */
  static async cleanup(siteId: string, domain: string): Promise<void> {
    const containerName = `viflow-site-${siteId}`;
    const imageName = `viflow-site-${siteId}`;

    await this.stopContainer(containerName).catch(() => {});
    await this.removeContainer(containerName).catch(() => {});
    await this.removeImage(imageName).catch(() => {});
    await this.removeNginxConfig(domain).catch(() => {});

    // Remove uploaded files
    const uploadPath = path.join(this.UPLOAD_DIR, siteId);
    try {
      await fs.rm(uploadPath, { recursive: true, force: true });
      logger.info(`Removed upload directory ${uploadPath}`);
    } catch (error) {
      logger.warn(`Could not remove upload directory ${uploadPath}`, error);
    }
  }
}
