import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { ensureUserPlan, getPlanLimits } from '@/lib/plan'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function chunkText(text: string, chunkSize = 400, overlap = 40): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
    i += chunkSize - overlap
  }
  return chunks
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  if (name.endsWith('.pdf')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pdf-parse')
    const pdfParse = mod.default ?? mod
    const data = await pdfParse(buffer)
    return data.text
  }

  if (name.endsWith('.docx')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  // .txt / .md — plain text
  return file.text()
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 5 KB document uploads per minute per user
  const { allowed, retryAfterMs } = checkRateLimit(`kb-upload:${user.id}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  // Plan gate — document uploads are Pro and Max only
  const userPlan = await ensureUserPlan(supabase, user.id)
  const limits   = getPlanLimits(userPlan.plan)
  if (!limits.docUpload) {
    return NextResponse.json(
      { error: 'Document uploads are available on Pro and Max plans. Upgrade to unlock this feature.' },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowedExtensions = ['.pdf', '.docx', '.txt', '.md']
  const isAllowed = allowedExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
  if (!isAllowed) return NextResponse.json({ error: 'Only PDF, Word (.docx), .txt, and .md files are supported.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File must be under 10MB.' }, { status: 400 })

  let text: string
  try {
    text = await extractText(file)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[kb/upload] extractText error:', msg)
    return NextResponse.json({ error: `Failed to extract text: ${msg}` }, { status: 400 })
  }

  if (!text.trim()) return NextResponse.json({ error: 'No text content found in file.' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY) {
    console.error('[kb/upload] OPENAI_API_KEY is not set')
    return NextResponse.json({ error: 'Server misconfiguration: embedding API key missing.' }, { status: 500 })
  }

  // Delete previous chunks for same filename
  await supabase.from('kb_documents').delete().eq('user_id', user.id).eq('filename', file.name)

  const chunks = chunkText(text)

  // Embed all chunks
  const insertRows = []
  for (let i = 0; i < chunks.length; i++) {
    let embeddingResponse
    try {
      embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks[i].slice(0, 8192),
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[kb/upload] OpenAI embedding error on chunk ${i}:`, msg)
      return NextResponse.json({ error: `Failed to create embeddings: ${msg}` }, { status: 500 })
    }
    insertRows.push({
      user_id: user.id,
      filename: file.name,
      chunk_index: i,
      chunk_text: chunks[i],
      embedding: embeddingResponse.data[0].embedding,
    })
  }

  const { error } = await supabase.from('kb_documents').insert(insertRows)
  if (error) {
    console.error('[kb/upload] Supabase insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, chunks: insertRows.length })
}
