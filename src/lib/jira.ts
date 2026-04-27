/**
 * Strip Jira/Confluence wiki markup so raw ticket text displays cleanly
 * in the UI. Safe to use in both client and server contexts.
 */
export function stripJiraMarkup(text: string): string {
  if (!text) return text
  return text
    // Image macros: !filename.png! or !filename.png|width=100!
    .replace(/![^|\n!]{1,200}(\|[^!\n]{0,100})!/g, '')
    // [text|url] → text
    .replace(/\[([^\|\]]{1,120})\|https?:\/\/[^\]]{1,300}\]/g, '$1')
    // bare [url] → remove
    .replace(/\[https?:\/\/[^\]]{1,300}\]/g, '')
    // {code}...{code} → keep content, drop fences
    .replace(/\{code[^}]*\}([\s\S]{0,3000}?)\{code\}/gi, '$1')
    // {noformat}...{noformat} → keep content
    .replace(/\{noformat[^}]*\}([\s\S]{0,3000}?)\{noformat\}/gi, '$1')
    // {color:x}text{color} → text
    .replace(/\{color[^}]*\}([\s\S]{0,500}?)\{color\}/gi, '$1')
    // remaining {macros} → remove
    .replace(/\{[a-zA-Z][^}]{0,60}\}/g, '')
    // ||table header cell|| → plain text with newline after each row
    .replace(/\|\|([^|]+)/g, '$1 ')
    // |table cell| → space-separated
    .replace(/\|([^|\n]+)/g, '$1 ')
    // h1./h2. etc headings → plain text
    .replace(/^h[1-6]\.\s*/gim, '')
    // *bold* → bold, _italic_ → italic, +underline+
    .replace(/\*([^*\n]{1,200})\*/g, '$1')
    .replace(/_([^_\n]{1,200})_/g, '$1')
    .replace(/\+([^+\n]{1,200})\+/g, '$1')
    // ~~strikethrough~~ or -strikethrough-
    .replace(/~~([^~\n]{1,200})~~/g, '$1')
    // horizontal rules
    .replace(/^-{4,}$/gm, '')
    // collapse 3+ blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
