import { MetadataRoute } from 'next'
import { posts } from './blog/lib/posts'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://www.sensebug.com'

  // Most recent content update — bump this date whenever the landing page or
  // pricing page copy changes significantly.
  const CONTENT_UPDATED = new Date('2026-05-11')

  const blogPosts: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [
    {
      url: base,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/pricing`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/blog`,
      lastModified: new Date(posts[0].date), // date of most recent post
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...blogPosts,
    {
      url: `${base}/signup`,
      lastModified: new Date('2026-03-01'),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${base}/login`,
      lastModified: new Date('2026-03-01'),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${base}/support`,
      lastModified: new Date('2026-03-01'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: new Date('2026-03-01'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: `${base}/terms`,
      lastModified: new Date('2026-03-01'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]
}
