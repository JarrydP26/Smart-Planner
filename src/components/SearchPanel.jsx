import { useState, useMemo } from 'react'
import { DEFAULT_PLAN_SUBJECTS } from '../lib/timetableDefaults'

// Searches every session's title/detail/learning-intention/resources across
// every week and subject in the current planner — a term can span 10+ weeks
// with no other way to find "where did I plan that spelling activity".
export default function SearchPanel({ data, onNavigate }) {
  const [query, setQuery] = useState('')
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const hits = []
    data.weeks.forEach(week => {
      Object.entries(week.sessions || {}).forEach(([subj, days]) => {
        const subjMeta = planSubjects[subj]
        if (!subjMeta) return
        Object.entries(days || {}).forEach(([day, session]) => {
          if (!session) return
          const haystack = [session.title, session.detail, session.li, session.resources].filter(Boolean).join(' ').toLowerCase()
          if (!haystack.includes(q)) return
          const field = session.title?.toLowerCase().includes(q) ? session.title
            : session.detail?.toLowerCase().includes(q) ? session.detail
            : session.li?.toLowerCase().includes(q) ? session.li
            : session.resources
          hits.push({
            weekId: week.id,
            weekLabel: week.weekLabel || week.label,
            day, subj, subjLabel: subjMeta.label,
            title: session.title,
            snippet: snippetAround(field || '', q),
          })
        })
      })
    })
    return hits
  }, [query, data.weeks, planSubjects])

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>🔍 Search this planner</h2>
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search session titles, notes, learning intentions, resources…"
        style={styles.input}
      />

      {query.trim().length >= 2 && (
        <div style={styles.resultsMeta}>
          {results.length} result{results.length === 1 ? '' : 's'}
        </div>
      )}

      <div style={styles.results}>
        {results.map((r, i) => (
          <button
            key={i}
            style={styles.resultCard}
            onClick={() => onNavigate(r.subj)}
          >
            <div style={styles.resultTop}>
              <span style={styles.resultSubj}>{r.subjLabel}</span>
              <span style={styles.resultWhen}>{r.weekLabel} · {r.day}</span>
            </div>
            <div style={styles.resultTitle}>{r.title}</div>
            {r.snippet && <div style={styles.resultSnippet}>{r.snippet}</div>}
          </button>
        ))}
        {query.trim().length >= 2 && results.length === 0 && (
          <div style={styles.emptyState}>No matches found.</div>
        )}
      </div>
    </div>
  )
}

// Trims a field down to a short snippet centered on the match, so long
// detail fields don't dump their whole content into the results list.
function snippetAround(text, q) {
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return text.slice(0, 100)
  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + q.length + 60)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

const styles = {
  wrap: { maxWidth: 700, margin: '0 auto', padding: '30px 20px' },
  title: { fontSize: 20, fontWeight: 800, marginBottom: 16 },
  input: { width: '100%', padding: '11px 14px', border: '1.5px solid #D4D9E5', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' },
  resultsMeta: { fontSize: 11, color: '#7A849E', marginTop: 10, marginBottom: 4 },
  results: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 },
  resultCard: { textAlign: 'left', background: '#fff', border: '1.5px solid #D4D9E5', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  resultTop: { display: 'flex', justifyContent: 'space-between', marginBottom: 4 },
  resultSubj: { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#3A86D4' },
  resultWhen: { fontSize: 10, color: '#7A849E' },
  resultTitle: { fontSize: 13, fontWeight: 700, marginBottom: 2 },
  resultSnippet: { fontSize: 11, color: '#7A849E', lineHeight: 1.4 },
  emptyState: { fontSize: 12, color: '#7A849E', textAlign: 'center', padding: '20px 0' },
}
