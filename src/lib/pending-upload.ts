/**
 * In-memory store for the pending CSV upload.
 *
 * Replaces sessionStorage: no serialization overhead, no duplicate-run
 * risk on refresh (the file is consumed on first read), and no stale-data
 * issue on back-button navigation.
 *
 * Scope: single SPA session. The file is intentionally not persisted —
 * if the user hard-refreshes mid-upload they return to the dashboard
 * and re-select the file, which is the correct UX.
 */

let pendingFile: File | null = null

export function setPendingFile(file: File): void {
  pendingFile = file
}

/** Returns the pending file and clears it so it can only be consumed once. */
export function takePendingFile(): File | null {
  const file = pendingFile
  pendingFile = null
  return file
}
