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
    slug: 'the-post-mortem',
    title: "The Post-Mortem No PM Wants to Give",
    description:
      'A payment bug sat in your backlog marked P3 for three weeks. Then it became a P0 incident. Here\'s what that moment costs — and how defensible triage makes sure you always have an answer.',
    date: '2026-05-08',
    readTime: '6 min read',
    category: 'Product Management',
  },
  {
    slug: 'bug-backlog-politics',
    title: "Why Your Bug Backlog Is a Political Document, Not a Technical One",
    description:
      'The hidden reason bug priority decisions feel like negotiations every sprint — and what happens to your engineering team when politics replaces data.',
    date: '2026-05-01',
    readTime: '7 min read',
    category: 'Bug Triage',
  },
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
