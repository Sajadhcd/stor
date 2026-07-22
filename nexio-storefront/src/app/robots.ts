import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_STORE_URL || 'https://store.nexio.iq';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
