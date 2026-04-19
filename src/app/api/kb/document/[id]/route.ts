import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: doc } = await supabase
    .from('kb_documents')
    .select('filename')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { error } = await supabase
    .from('kb_documents')
    .delete()
    .eq('user_id', user.id)
    .eq('filename', doc.filename)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
