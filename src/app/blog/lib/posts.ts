export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  readTime: string
  category: string
}

export const posts: PostMeta[] = [
  {
    slug: 'how-to-prioritize-bugs',
    title: "How to Prioritize Bugs: A Product Manager's Guide to Cutting Through the Noise",
    description:
      'A practical framework for PM bug triage — how to cut through reporter bias, rank by real business impact, and walk into sprint planning with a list you can actually defend.',
    date: '2026-04-25',
    readTime: '8 min read',
    category: 'Bug Triage',
  },
]

export function getPost(slug: string): PostMeta | undefined {
  return posts.find(p => p.slug === slug)
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
