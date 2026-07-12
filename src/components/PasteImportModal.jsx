import { useState } from 'react'
import { DAYS } from '../lib/timetableDefaults'

// Parses a table pasted from Word/Google Docs (copies as HTML) or a plain
// tab-separated fallback into a flat array of row objects, each just
// { cells: [...] } — no row labels needed, since this always represents one
// subject's teaching days as columns.
function parseHtmlTable(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null
  const trs = Array.from(table.querySelectorAll('tr'))
  if (trs.length === 0) return null
  return trs.map(tr => ({
    cells: Array.from(tr.querySelectorAll('th,td')).map(td => td.textContent.trim()),
  }))
}

function parsePlainTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null
  return lines.map(line => ({ cells: line.split('\t') }))
}

export default function PasteImportModal({ open, subjLabel, weeks, activeWeekId, onApply, onClose }) {
  const [tableRows, setTableRows] = useState(null) // [{cells:[...]}, ...]
  const [headerRowIndex, setHeaderRowIndex] = useState(null) // which row (if any) looks like day names
  const [mergedCells, setMergedCells] = useState([]) // one combined text block per column, all content rows joined
  const [dayMap, setDayMap] = useState({}) // column index -> day
  const [weekId, setWeekId] = useState(activeWeekId)
  const [downOnBackdrop, setDownOnBackdrop] = useState(false)

  if (!open) return null

  // Combines every content row's text for a given column into one block,
  // e.g. if a day has 3 separate table rows (different activities), they
  // all collapse into one session with each row on its own line.
  function mergeColumns(rows, contentStartIndex, colCount) {
    const merged = []
    for (let ci = 0; ci < colCount; ci++) {
      const pieces = rows.slice(contentStartIndex)
        .map(r => (r.cells[ci] || '').trim())
        .filter(Boolean)
      merged.push(pieces.join('\n'))
    }
    return merged
  }

  function handlePaste(e) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    let rows = null
    if (html && html.includes('<table')) rows = parseHtmlTable(html)
    if (!rows && text) rows = parsePlainTable(text)
    if (!rows || rows.length === 0) {
      window.alert("Couldn't find a table in what you pasted. Try selecting the whole table in Word before copying.")
      return
    }

    setTableRows(rows)
    const colCount = Math.max(...rows.map(r => r.cells.length))

    // If the first row's cells look like day names, treat it as the header
    // and every row after it as content (merged together per column).
    // Otherwise there's no header — every row is content, and days need to
    // be mapped manually.
    const firstRowIsHeader = rows[0].cells.some(c => DAYS.some(d => c.toLowerCase().includes(d.toLowerCase())))
    if (firstRowIsHeader && rows.length > 1) {
      setHeaderRowIndex(0)
      setMergedCells(mergeColumns(rows, 1, colCount))
      const dm = {}
      rows[0].cells.forEach((cellText, ci) => {
        const day = DAYS.find(d => cellText.toLowerCase().includes(d.toLowerCase()))
        if (day) dm[ci] = day
      })
      setDayMap(dm)
    } else {
      setHeaderRowIndex(null)
      setMergedCells(mergeColumns(rows, 0, colCount))
      setDayMap({})
    }
  }

  function reset() {
    setTableRows(null)
    setHeaderRowIndex(null)
    setMergedCells([])
    setDayMap({})
  }

  function handleApply() {
    const matchedCount = mergedCells.filter((c, ci) => dayMap[ci] && c.trim()).length
    if (matchedCount === 0) {
      window.alert('Nothing matched — check the day mapping below.')
      return
    }
    const week = weeks.find(w => w.id === weekId)
    const weekLabel = week?.weekLabel || week?.label || 'this week'
    if (!window.confirm(`Import ${matchedCount} session${matchedCount === 1 ? '' : 's'} for ${subjLabel} into ${weekLabel}? This will overwrite any existing sessions in those days.`)) return
    onApply({ weekId, dayMap, contentCells: mergedCells })
    reset()
  }

  return (
    <div
      className="no-print"
      style={styles.backdrop}
      onMouseDown={(e) => setDownOnBackdrop(e.target === e.currentTarget)}
      onClick={(e) => { if (downOnBackdrop && e.target === e.currentTarget) onClose() }}
    >
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <h2 style={styles.title}>📋 Paste {subjLabel} from Word</h2>

        {!tableRows ? (
          <>
            <p style={styles.hint}>
              Select your {subjLabel} table in Word — one column per teaching day — copy it, then paste it below.
            </p>
            <div
              contentEditable
              suppressContentEditableWarning
              onPaste={handlePaste}
              style={styles.pasteBox}
            />
          </>
        ) : (
          <>
            <div style={styles.field}>
              <label style={styles.label}>Week</label>
              <select value={weekId} onChange={(e) => setWeekId(e.target.value)} style={styles.select}>
                {weeks.map((w, i) => (
                  <option key={w.id} value={w.id}>{w.weekLabel || `Week ${i + 1}`} ({w.label})</option>
                ))}
              </select>
            </div>

            {headerRowIndex === null && (
              <p style={styles.hint}>No day headings detected — match each column to a day below.</p>
            )}

            <div style={styles.mapSection}>
              <div style={styles.mapLabel}>Columns → Days</div>
              {mergedCells.map((cellText, ci) => (
                <div key={ci} style={styles.mapRow}>
                  <span style={styles.mapCellText} title={cellText}>{cellText.split('\n')[0] || '(blank)'}{cellText.includes('\n') ? ` (+${cellText.split('\n').length - 1} more)` : ''}</span>
                  <select value={dayMap[ci] || ''} onChange={(e) => setDayMap({ ...dayMap, [ci]: e.target.value || undefined })} style={styles.select}>
                    <option value="">Skip this column</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={styles.actions}>
              <button style={styles.outlineBtn} onClick={reset}>Start over</button>
              <button style={styles.primaryBtn} onClick={handleApply}>Import</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.32)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#fff', borderRadius: 12, padding: 22, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', position: 'relative', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' },
  closeBtn: { position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#7A849E' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 10 },
  hint: { fontSize: 12, color: '#7A849E', marginBottom: 14, lineHeight: 1.5 },
  pasteBox: { minHeight: 140, border: '2px dashed #D4D9E5', borderRadius: 8, padding: 16, fontSize: 13, color: '#7A849E', outline: 'none' },
  field: { marginBottom: 12 },
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#7A849E', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  mapSection: { marginBottom: 18 },
  mapLabel: { fontSize: 11, fontWeight: 800, color: '#7A849E', textTransform: 'uppercase', marginBottom: 6 },
  mapRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid #F0F2F7' },
  mapCellText: { fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  select: { width: '100%', border: '1px solid #D4D9E5', borderRadius: 5, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit' },
  actions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 },
  outlineBtn: { padding: '8px 14px', borderRadius: 7, border: '1.5px solid #D4D9E5', background: 'transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  primaryBtn: { padding: '8px 14px', borderRadius: 7, border: 'none', background: '#3A86D4', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
}
