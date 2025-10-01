import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger.js';

/**
 * SECURITY: Validates that a file path doesn't contain directory traversal attempts
 * Rejects: "..", absolute paths, symlinks
 */
export function isPathSafe(filePath: string): boolean {
  // Normalize path and check for traversal
  const normalized = path.normalize(filePath);

  // Reject absolute paths
  if (path.isAbsolute(normalized)) {
    logger.warn(`Rejected absolute path: ${filePath}`);
    return false;
  }

  // Reject paths with ".."
  if (normalized.includes('..')) {
    logger.warn(`Rejected path with traversal: ${filePath}`);
    return false;
  }

  // Reject paths starting with / or containing ://
  if (filePath.startsWith('/') || filePath.includes('://')) {
    logger.warn(`Rejected suspicious path: ${filePath}`);
    return false;
  }

  return true;
}

/**
 * Validates upload file type and size
 */
export async function validateUploadFile(
  filePath: string,
  maxSize: number
): Promise<{ valid: boolean; error?: string }> {
  try {
    const stats = await fs.stat(filePath);

    // Check size
    if (stats.size > maxSize) {
      return {
        valid: false,
        error: `File size ${stats.size} exceeds maximum ${maxSize} bytes`,
      };
    }

    // Check if it's a regular file
    if (!stats.isFile()) {
      return {
        valid: false,
        error: 'Upload is not a regular file',
      };
    }

    // Basic MIME type check (check magic bytes for ZIP)
    const buffer = Buffer.alloc(4);
    const fd = await fs.open(filePath, 'r');
    await fd.read(buffer, 0, 4, 0);
    await fd.close();

    // ZIP magic: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
    const isPkZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
    if (!isPkZip) {
      return {
        valid: false,
        error: 'File is not a valid ZIP archive',
      };
    }

    return { valid: true };
  } catch (error) {
    logger.error({ error, filePath }, 'File validation error');
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
    };
  }
}

/**
 * SECURITY: Validates extracted file paths during unzip
 * This should be used by the deployment script
 */
export interface ZipValidationLimits {
  maxFiles?: number;
  maxTotalSize?: number;
}

export function createZipSafetyCheck(limits: ZipValidationLimits = {}) {
  const maxFiles = limits.maxFiles || 10000;
  const maxTotalSize = limits.maxTotalSize || 5 * 1024 * 1024 * 1024; // 5GB

  let fileCount = 0;
  let totalSize = 0;

  return {
    checkPath: (entryPath: string): boolean => {
      fileCount++;

      if (fileCount > maxFiles) {
        logger.error(`ZIP contains too many files (>${maxFiles})`);
        return false;
      }

      return isPathSafe(entryPath);
    },

    checkSize: (size: number): boolean => {
      totalSize += size;

      if (totalSize > maxTotalSize) {
        logger.error(`ZIP total size exceeds limit (>${maxTotalSize})`);
        return false;
      }

      return true;
    },
  };
}
