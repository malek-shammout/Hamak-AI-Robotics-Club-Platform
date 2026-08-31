import type {MetadataRoute} from 'next';

const PUBLIC_PATHS = ['', '/courses', '/projects', '/events', '/news', '/consultations', '/verify'];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const now = new Date();

  return ['ar', 'en'].flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? 'weekly' as const : 'daily' as const,
      priority: path === '' ? 1 : 0.7,
    }))
  );
}
