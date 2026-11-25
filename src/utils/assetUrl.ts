/**
 * Resolves static and uploaded asset URLs so they resolve properly across all deployment targets:
 * - GitHub Pages subfolder repositories (e.g. https://username.github.io/repo-name/)
 * - Custom root domains (e.g. https://gurudevdesigns.in/)
 * - Local development and Cloud Run environments
 */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Preserve absolute URLs, data URIs, blob URLs, and protocol-relative URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('//')
  ) {
    return trimmed;
  }

  // If already relative (e.g., ./assets/... or assets/...), leave as is
  if (trimmed.startsWith('./')) {
    return trimmed;
  }

  // If path starts with root slash (e.g., /assets/... or /src/assets/...),
  // convert to relative path so it loads inside GitHub Pages repository subpaths
  if (trimmed.startsWith('/')) {
    return `./${trimmed.slice(1)}`;
  }

  return `./${trimmed}`;
}
