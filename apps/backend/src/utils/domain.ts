/**
 * Basic RFC 1035 domain validation
 * Allows: example.com, sub.example.com, example-site.com
 */
export function isValidDomain(domain: string): boolean {
  // Basic pattern: lowercase alphanumeric with hyphens and dots
  const pattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

  if (!pattern.test(domain)) {
    return false;
  }

  // Check length constraints
  if (domain.length > 253) {
    return false;
  }

  // Check each label (part between dots)
  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length < 1 || label.length > 63) {
      return false;
    }
  }

  return true;
}
