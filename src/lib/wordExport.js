// Client-side Word document generation using the `docx` npm package.
// Two exports are built here:
//   - buildSubjectDocument: one subject's whole term (mirrors Term View)
//   - buildFullTermDocument: every subject across the whole term, full
//     lesson detail per subject per week (not just a title-only glance)
//
// Both use getSubjectPlannableDays (from plannerHelpers) rather than each
// subject's own declared `days` list — the declared list is just
// descriptive metadata and can end up out of step with whatever a
// customised Timetable Setup actually has configured, which is what was
// causing a subject (e.g. Maths) to come out empty or missing entirely.

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } from 'docx'
import { DEFAULT_PLAN_SUBJECTS } from './timetableDefaults'
import { getSessionFor, groupsEnabledFor, getEffectiveGroupId, getSubjectPlannableDays } from './plannerHelpers'

// ─── Look & feel ──────────────────────────────────────────────────────
// Narrow margins, Century Gothic, a slightly smaller body size so more
// fits per page, with roomier table cells so the tables themselves read
// as the bigger, more prominent element on the page.
const FONT = 'Century Gothic'
const BODY_SIZE = 18   // 9pt
const H1_SIZE = 30     // 15pt
const H2_SIZE = 24     // 12pt
const H3_SIZE = 20     // 10pt
const NARROW_MARGIN = 720 // 0.5" in twips (matches Word's "Narrow" preset)
const CELL_MARGINS = { top: 100, bottom: 100, left: 130, right: 130 } // dxa — roomier cells

function run(text, opts = {}) {
  return new TextRun({ text: text || '', font: FONT, size: opts.size || BODY_SIZE, bold: !!opts.bold })
}

function heading(text, level) {
  const size = level === 1 ? H1_SIZE : level === 2 ? H2_SIZE : H3_SIZE
  return new Paragraph({
    spacing: { before: level === 1 ? 0 : 260, after: 120 },
    children: [run(text, { bold: true, size })],
  })
}

function bodyParagraph(text, opts = {}) {
  return new Paragraph({ spacing: opts.spacing, children: [run(text)] })
}

function cell(text, { bold = false, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: CELL_MARGINS,
    children: [new Paragraph({ children: [run(text, { bold })] })],
  })
}

function headerRow(labels, widths) {
  return new TableRow({
    children: labels.map((l, i) => cell(l, { bold: true, width: widths?.[i] })),
  })
}

function pageSettings() {
  return {
    properties: {
      page: { margin: { top: NARROW_MARGIN, bottom: NARROW_MARGIN, left: NARROW_MARGIN, right: NARROW_MARGIN } },
    },
  }
}

// One subject's whole term — one table per week, one row per meeting day.
export function buildSubjectDocument(data, subj, myGroupPrefs) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const subjMeta = planSubjects[subj]
  const days = getSubjectPlannableDays(data, subj)
  const hasGroups = groupsEnabledFor(data, subj)
  const groupId = hasGroups ? getEffectiveGroupId(data, subj, myGroupPrefs) : null

  const children = [heading(`${subjMeta?.label || subj} — Term Overview`, 1)]

  if (data.termSummaries?.[subj]) {
    children.push(bodyParagraph(data.termSummaries[subj], { spacing: { after: 200 } }))
  }

  data.weeks.forEach(week => {
    const weekTitle = `${week.weekLabel || week.label}${week.topics?.[subj] ? ' — ' + week.topics[subj] : ''}`
    children.push(heading(weekTitle, 2))

    const widths = [12, 20, 34, 20, 14]
    const rows = [headerRow(['Day', 'Session', 'Notes', 'Learning Intention', 'Resources'], widths)]
    days.forEach(day => {
      const session = getSessionFor(week, subj, day, groupId)
      rows.push(new TableRow({
        children: [
          cell(day, { width: widths[0] }),
          cell(session?.title || '—', { width: widths[1] }),
          cell(session?.detail || '', { width: widths[2] }),
          cell(session?.li || '', { width: widths[3] }),
          cell(session?.resources || '', { width: widths[4] }),
        ],
      }))
    })

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  })

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [{ ...pageSettings(), children }],
  })
}

// Every subject, whole term — full lesson detail (not just titles), one
// section per subject per week, covering every ability group where
// enabled so nothing is condensed away.
export function buildFullTermDocument(data) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const subjects = Object.keys(planSubjects)

  const children = [heading(`${data.appSettings?.className || 'Class'} — Full Term Plan`, 1)]

  data.weeks.forEach(week => {
    children.push(heading(week.weekLabel || week.label, 2))

    subjects.forEach(subj => {
      const meta = planSubjects[subj]
      const days = getSubjectPlannableDays(data, subj)
      if (!days.length) return // this subject isn't actually scheduled anywhere in the current timetable

      const hasGroups = groupsEnabledFor(data, subj)
      const groupCfg = hasGroups ? data.appSettings.abilityGroups[subj] : null
      const groupIds = hasGroups && groupCfg?.groups?.length ? groupCfg.groups.map(g => g.id) : [null]
      const groupNames = hasGroups ? Object.fromEntries((groupCfg?.groups || []).map(g => [g.id, g.name])) : {}

      children.push(heading(meta.label, 3))

      const labels = hasGroups
        ? ['Day', 'Group', 'Session', 'Notes', 'Learning Intention', 'Resources']
        : ['Day', 'Session', 'Notes', 'Learning Intention', 'Resources']
      const widths = hasGroups ? [10, 12, 16, 32, 18, 12] : [10, 18, 34, 22, 16]
      const rows = [headerRow(labels, widths)]

      days.forEach(day => {
        groupIds.forEach(groupId => {
          const session = getSessionFor(week, subj, day, groupId)
          const rowCells = hasGroups
            ? [
                cell(day, { width: widths[0] }),
                cell(groupNames[groupId] || '', { width: widths[1] }),
                cell(session?.title || '—', { width: widths[2] }),
                cell(session?.detail || '', { width: widths[3] }),
                cell(session?.li || '', { width: widths[4] }),
                cell(session?.resources || '', { width: widths[5] }),
              ]
            : [
                cell(day, { width: widths[0] }),
                cell(session?.title || '—', { width: widths[1] }),
                cell(session?.detail || '', { width: widths[2] }),
                cell(session?.li || '', { width: widths[3] }),
                cell(session?.resources || '', { width: widths[4] }),
              ]
          rows.push(new TableRow({ children: rowCells }))
        })
      })

      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
    })
  })

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
    sections: [{ ...pageSettings(), children }],
  })
}

// Builds the .docx as a Blob and triggers a browser download — no server
// round-trip needed.
export async function downloadWordDoc(doc, filename) {
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
