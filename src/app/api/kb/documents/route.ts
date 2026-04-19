import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Return unique documents (one row per filename, first chunk_index)
  const { data } = await supabase
    .from('kb_documents')
    .select('id, user_id, filename, created_at')
    .eq('user_id', user.id)
    .eq('chunk_index', 0)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}
