// Client-side Word document generation using the `docx` npm package.
// Two exports are built here:
//   - buildSubjectDocument: one subject's whole term (mirrors Term View)
//   - buildFullTermDocument: every subject across the whole term, one
//     Subject × Day table per week (mirrors the Weekly Planner grid, at a
//     glance rather than reproducing every timetable row/break exactly)

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx'
import { DEFAULT_PLAN_SUBJECTS } from './timetableDefaults'
import { getSessionFor, groupsEnabledFor, getEffectiveGroupId } from './plannerHelpers'

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

function cell(text, { bold = false, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: text || '', bold })] })],
  })
}

function headerRow(labels) {
  return new TableRow({ children: labels.map(l => cell(l, { bold: true })) })
}

// One subject's whole term — one table per week, one row per meeting day.
export function buildSubjectDocument(data, subj, myGroupPrefs) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const subjMeta = planSubjects[subj]
  const days = subjMeta?.days || []
  const hasGroups = groupsEnabledFor(data, subj)
  const groupId = hasGroups ? getEffectiveGroupId(data, subj, myGroupPrefs) : null

  const children = [
    new Paragraph({ text: `${subjMeta?.label || subj} — Term Overview`, heading: HeadingLevel.HEADING_1 }),
  ]

  if (data.termSummaries?.[subj]) {
    children.push(new Paragraph({ text: data.termSummaries[subj], spacing: { after: 200 } }))
  }

  data.weeks.forEach(week => {
    const weekTitle = `${week.weekLabel || week.label}${week.topics?.[subj] ? ' — ' + week.topics[subj] : ''}`
    children.push(new Paragraph({ text: weekTitle, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }))

    const rows = [headerRow(['Day', 'Session', 'Notes', 'Learning Intention', 'Resources'])]
    days.forEach(day => {
      const session = getSessionFor(week, subj, day, groupId)
      rows.push(new TableRow({
        children: [
          cell(day, { width: 12 }),
          cell(session?.title || '—', { width: 20 }),
          cell(session?.detail || '', { width: 34 }),
          cell(session?.li || '', { width: 20 }),
          cell(session?.resources || '', { width: 14 }),
        ],
      }))
    })

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  })

  return new Document({ sections: [{ children }] })
}

// Every subject, whole term — one Subject × Day table per week. Uses each
// subject's first ability group where groups are enabled, since a single
// glance table can't show every group at once (the per-subject export
// above supports switching groups if more detail is needed there).
export function buildFullTermDocument(data) {
  const planSubjects = data.planSubjects || DEFAULT_PLAN_SUBJECTS
  const subjects = Object.keys(planSubjects)

  const children = [
    new Paragraph({ text: `${data.appSettings?.className || 'Class'} — Full Term Plan`, heading: HeadingLevel.HEADING_1 }),
  ]

  data.weeks.forEach(week => {
    children.push(new Paragraph({ text: week.weekLabel || week.label, heading: HeadingLevel.HEADING_2, spacing: { before: 300 } }))

    const rows = [headerRow(['Subject', ...ALL_DAYS])]
    subjects.forEach(subj => {
      const meta = planSubjects[subj]
      const hasGroups = groupsEnabledFor(data, subj)
      const groupId = hasGroups ? data.appSettings.abilityGroups[subj]?.groups?.[0]?.id : null
      rows.push(new TableRow({
        children: [
          cell(meta.label, { bold: true, width: 16 }),
          ...ALL_DAYS.map(day => {
            if (!meta.days?.includes(day)) return cell('')
            const session = getSessionFor(week, subj, day, groupId)
            return cell(session?.title || '')
          }),
        ],
      }))
    })

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
  })

  return new Document({ sections: [{ children }] })
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
