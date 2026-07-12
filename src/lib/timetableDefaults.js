// Default timetable structure — matches the HTML version's built-in ROWS.
// A planner can override this via Timetable Setup; if data.rows is null,
// this default is used instead.
//
// Specialist blocks (PE/Art, Science/Drama, etc.) are their own standalone
// rows rather than a rowspan merged across several other rows — this is
// deliberately simpler than the original HTML's approach: rowspan cells that
// stretch across several rows are fragile (any timetable edit around them
// easily desyncs the table's column count), and standalone rows are fully
// configurable — a teacher can move, rename, retime, or add more of them
// freely via Timetable Setup.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const DEFAULT_ROWS = [
  { type: 'block-header', label: 'MORNING BLOCK  8:45 – 11:00', cls: 'block-morning' },
  { type: 'slot', time: '8:45', name: 'Circle',
    days: { Monday: { fixed: 'Circle\n15 mins', cls: 's-circle' }, Tuesday: { fixed: 'Circle\n15 mins', cls: 's-circle' }, Wednesday: { fixed: 'Circle\n15 mins', cls: 's-circle' }, Thursday: { fixed: 'Circle\n15 mins', cls: 's-circle' }, Friday: { fixed: 'Circle\n15 mins', cls: 's-circle' } }
  },
  { type: 'slot', time: '9:00', name: 'Learning Powers', topicKey: 'learningPowers', toggleKey: 'learningPowers',
    days: { Monday: { fixed: 'Learning Powers', cls: 's-lp', toggleAware: true }, Tuesday: null, Wednesday: { fixed: 'Learning Powers', cls: 's-lp', toggleAware: true }, Thursday: { fixed: 'Learning Powers', cls: 's-lp', toggleAware: true }, Friday: { fixed: 'Learning Powers', cls: 's-lp', toggleAware: true } }
  },
  { type: 'slot', time: '9:30', name: 'Maths', topicKey: 'maths',
    days: { Monday: { plannable: true, subject: 'maths' }, Tuesday: null, Wednesday: { plannable: true, subject: 'maths' }, Thursday: { plannable: true, subject: 'maths' }, Friday: { plannable: true, subject: 'maths' } }
  },
  { type: 'slot', time: '10:30', name: 'Spelling', topicKey: 'spelling', spellingOnly: true, toggleKey: 'spelling',
    days: { Monday: { spelling: true }, Tuesday: null, Wednesday: { spelling: true }, Thursday: { spelling: true }, Friday: { spelling: true } }
  },
  { type: 'break', label: 'EATING TIME 11:00–11:10  ·  OUTSIDE PLAY 11:10–11:35' },
  { type: 'block-header', label: 'MIDDLE BLOCK  11:35 – 1:35', cls: 'block-middle' },
  { type: 'slot', time: '11:35', name: 'Maths to Self', sgKey: 'mts',
    days: { Monday: { sg: true, sgKey: 'mts' }, Tuesday: { sg: true, sgKey: 'mts' }, Wednesday: { sg: true, sgKey: 'mts' }, Thursday: { sg: true, sgKey: 'mts' }, Friday: null }
  },
  { type: 'slot', time: '11:45', name: 'Read to Self', sgKey: 'rts',
    days: { Monday: { sg: true, sgKey: 'rts' }, Tuesday: { sg: true, sgKey: 'rts' }, Wednesday: { sg: true, sgKey: 'rts' }, Thursday: { sg: true, sgKey: 'rts' }, Friday: null }
  },
  { type: 'slot', time: '12:20', name: 'Writing', topicKey: 'writing',
    days: { Monday: { plannable: true, subject: 'writing' }, Tuesday: { plannable: true, subject: 'writing' }, Wednesday: { plannable: true, subject: 'writing' }, Thursday: { plannable: true, subject: 'writing' }, Friday: null }
  },
  { type: 'slot', time: '1:00', name: 'Brain Break', topicKey: 'brainBreak', toggleKey: 'brainBreak',
    days: { Monday: { fixed: 'Brain Break', cls: 's-brain', toggleAware: true }, Tuesday: { fixed: 'Brain Break', cls: 's-brain', toggleAware: true }, Wednesday: { fixed: 'Brain Break', cls: 's-brain', toggleAware: true }, Thursday: { fixed: 'Brain Break', cls: 's-brain', toggleAware: true }, Friday: null }
  },
  { type: 'slot', time: '1:10', name: 'Reading', topicKey: 'reading',
    days: { Monday: { plannable: true, subject: 'reading' }, Tuesday: { plannable: true, subject: 'reading' }, Wednesday: { plannable: true, subject: 'reading' }, Thursday: { plannable: true, subject: 'reading' }, Friday: null }
  },
  { type: 'break', label: 'EATING TIME 1:35–1:45  ·  OUTSIDE PLAY 1:45–2:05' },
  { type: 'block-header', label: 'AFTERNOON BLOCK  2:05 – 3:00', cls: 'block-afternoon' },
  { type: 'slot', time: '2:05', name: 'Check-in', topicKey: 'checkIn', toggleKey: 'checkIn',
    days: { Monday: { fixed: 'Check in\nChats', cls: 's-checkin', toggleAware: true }, Tuesday: { fixed: 'Check in\nChats', cls: 's-checkin', toggleAware: true }, Wednesday: { fixed: 'Check in\nChats', cls: 's-checkin', toggleAware: true }, Thursday: { fixed: 'Check in\nChats', cls: 's-checkin', toggleAware: true }, Friday: { fixed: 'Check in\nChats', cls: 's-checkin', toggleAware: true } }
  },
  { type: 'slot', time: '2:15', name: 'Afternoon', topicKey: 'afternoon',
    days: { Monday: { plannable: true, subject: 'afternoon' }, Tuesday: { plannable: true, subject: 'afternoon' }, Wednesday: { plannable: true, subject: 'afternoon' }, Thursday: { plannable: true, subject: 'afternoon' }, Friday: { fixed: 'Assembly\n30 mins', cls: 's-assembly' } }
  },
]

export const DEFAULT_PLAN_SUBJECTS = {
  writing:   { label: 'Writing',   days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
  maths:     { label: 'Maths',     days: ['Monday', 'Wednesday', 'Thursday', 'Friday'] },
  reading:   { label: 'Reading',   days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
  afternoon: { label: 'Afternoon', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'] },
}

export const SG_SLOTS = {
  mts: { label: 'Maths to Self', cls: 's-mts', toggleKey: 'mathsToSelf' },
  rts: { label: 'Read to Self', cls: 's-rts', toggleKey: 'readToSelf' },
}

export const SG_CELLS = [
  { id: 'r3a', label: 'Rm3 – Group A' },
  { id: 'r3b', label: 'Rm3 – Group B' },
  { id: 'c2a', label: 'Class 2 – A' },
  { id: 'c3a', label: 'Class 3 – A' },
  { id: 'c2b', label: 'Class 2 – B' },
  { id: 'c3b', label: 'Class 3 – B' },
]

export const SUBJECT_DOT_COLOR = {
  writing: '#2870D4', maths: '#E07820', reading: '#189870', afternoon: '#5060C0',
}

// A recurring, timetable-level declaration: on this day, this whole session
// block (Morning/Middle/Afternoon) is a specialist session — configured once
// in Timetable Setup, applies every week automatically (see
// computeSpecialistSpans in plannerHelpers.js).
export const DEFAULT_SPECIALIST_BLOCKS = {
  Tuesday: { blockCls: 'block-morning', name: 'PE / Art', color: '#D3F0DD' },
  Friday: { blockCls: 'block-middle', name: 'Science / Drama', color: '#F5F0C8' },
}
