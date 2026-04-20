export interface KnowledgeBase {
  id: string
  user_id: string
  product_overview: string
  critical_flows: string
  product_areas: string
  updated_at: string
}

export interface KBDocument {
  id: string
  user_id: string
  filename: string
  chunk_index: number
  chunk_text: string
  created_at: string
}

export interface TriageRun {
  id: string
  user_id: string
  filename: string
  bug_count: number
  run_at: string
  priority_counts?: { P1: number; P2: number; P3: number; P4: number }
}

export interface TriageResult {
  id: string
  run_id: string
  bug_id: string
  title: string
  rank: number
  priority: 'P1' | 'P2' | 'P3' | 'P4'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  business_impact: string
  rationale: string
  gap_flags: string[]
  pm_action: 'approved' | 'edited' | 'rejected' | null
  edited_priority: string | null
  edited_severity: string | null
  rejection_reason: string | null
  original_description: string | null
  reporter_priority: string | null
  improved_description: string | null
}

export interface RunWithResults extends TriageRun {
  results: TriageResult[]
}

export interface UserPlanInfo {
  plan: string
  monthly_runs_count: number
  runs_limit: number
}
