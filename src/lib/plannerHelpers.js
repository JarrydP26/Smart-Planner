// Pure helper functions operating on a planner's data object.
// These mirror the logic from the HTML version, adapted to work on an
// explicit data object (and return a new object) rather than mutating
// global variables, since React state should be updated immutably.

export function getWeek(data, weekId) {
  return data.weeks.find(w => w.id === weekId) || null
}

export function groupsEnabledFor(data, subj) {
  const cfg = data.appSettings.abilityGroups?.[subj]
  return !!(cfg && cfg.enabled && cfg.groups?.length)
}

export function getActiveGroupId(data, subj, myGroupPrefs) {
  const cfg = data.appSettings.abilityGroups?.[subj]
  if (!cfg || !cfg.enabled || !cfg.groups?.length) return null
  const preferred = myGroupPrefs?.[subj]
  if (preferred && cfg.groups.find(g => g.id === preferred)) return preferred
  return cfg.groups[0].id
}

export function getEffectiveGroupId(data, subj, myGroupPrefs) {
  if (!groupsEnabledFor(data, subj)) return null
  return getActiveGroupId(data, subj, myGroupPrefs)
}

export function getGroupName(data, subj, groupId) {
  const cfg = data.appSettings.abilityGroups?.[subj]
  const g = cfg?.groups?.find(x => x.id === groupId)
  return g ? g.name : ''
}

// Read a session, group-aware. Returns null if none.
export function getSessionFor(week, subj, day, groupId) {
  const cell = week.sessions?.[subj]?.[day]
  if (!groupId) return cell || null
  if (!cell || typeof cell !== 'object' || cell.title !== undefined) return null
  return cell[groupId] || null
}

// Returns a NEW week object with the session set, group-aware.
// Use this then save the whole data object via the data hook's save().
export function withSessionSet(week, subj, day, groupId, sessionObj) {
  const newWeek = { ...week, sessions: { ...week.sessions } }
  if (!newWeek.sessions[subj]) newWeek.sessions[subj] = {}
  newWeek.sessions[subj] = { ...newWeek.sessions[subj] }

  if (!groupId) {
    newWeek.sessions[subj][day] = sessionObj
  } else {
    const existing = newWeek.sessions[subj][day]
    const cell = (existing && typeof existing === 'object' && existing.title === undefined) ? { ...existing } : {}
    cell[groupId] = sessionObj
    newWeek.sessions[subj][day] = cell
  }
  return newWeek
}

// Replace one week inside the data object, returning a new data object.
export function withWeekUpdated(data, weekId, updatedWeek) {
  return {
    ...data,
    weeks: data.weeks.map(w => (w.id === weekId ? updatedWeek : w)),
  }
}

function freshWeekSessions(planSubjects) {
  const sessions = {}
  Object.keys(planSubjects).forEach(s => {
    sessions[s] = { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null }
  })
  return sessions
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function getMonday(d) {
  const day = d.getDay()
  const m = new Date(d)
  m.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  m.setHours(0, 0, 0, 0)
  return m
}

// Creates a new week object and returns a new data object with it appended.
export function withNewWeek(data, planSubjects, startMonday) {
  const id = 'w' + Date.now() + Math.random().toString(36).slice(2, 6)
  const end = new Date(startMonday)
  end.setDate(end.getDate() + 4)
  const label = `${fmtDate(startMonday)} – ${fmtDate(end)}`

  let weekLabel = null
  if (data.weeks.length === 0) {
    const term = data.appSettings?.currentTerm || 1
    weekLabel = `Term ${term} Week 1`
  } else {
    const prev = data.weeks[data.weeks.length - 1].weekLabel || ''
    const m = prev.match(/^(Term \d+ Week )(\d+)$/)
    if (m) weekLabel = m[1] + (parseInt(m[2]) + 1)
  }

  const newWeek = {
    id,
    label,
    dateStart: new Date(startMonday).toISOString(),
    sessions: freshWeekSessions(planSubjects),
    topics: {},
    smallGroups: {},
    dayBlocks: {},
    rowBlocks: {},
    fixedNotes: {},
    weekLabel,
  }

  return {
    ...data,
    weeks: [...data.weeks, newWeek],
    activeWeekId: id,
  }
}

export function withNextWeek(data, planSubjects) {
  const last = data.weeks[data.weeks.length - 1]
  const startMonday = last ? new Date(last.dateStart) : getMonday(new Date())
  if (last) startMonday.setDate(startMonday.getDate() + 7)
  return withNewWeek(data, planSubjects, startMonday)
}

// Updates the "Term X" portion of every existing week's label to a new term
// number, keeping each week's own "Week N" number unchanged.
export function withRelabeledTerm(data, newTerm) {
  const weeks = data.weeks.map((w) => {
    const current = w.weekLabel || ''
    const m = current.match(/^Term \d+ (Week \d+)$/)
    const weekLabel = m ? `Term ${newTerm} ${m[1]}` : current
    return { ...w, weekLabel }
  })
  return { ...data, weeks }
}

// Small group grid data (Maths to Self / Read to Self) — a separate map on
// the week, keyed by "{sgKey}_{day}" (e.g. "mts_Monday"), each holding an
// optional description plus one name-list per small-group cell.
export function getSgData(week, sgKey, day) {
  const key = `${sgKey}_${day}`
  return week.smallGroups?.[key] || {}
}

export function withSgDataSet(week, sgKey, day, obj) {
  const key = `${sgKey}_${day}`
  return { ...week, smallGroups: { ...week.smallGroups, [key]: obj } }
}

export { getMonday }
