import { useEffect, useState, useCallback } from 'react'
import { calendarApi } from '../services/api'

// ── RSVP helpers ─────────────────────────────────────────────────────────────

const PTST_LABEL = { AC: 'Accepted', DE: 'Declined', TE: 'Tentative', NE: 'No response' }
const PTST_COLOR = { AC: '#188038', DE: '#d93025', TE: '#e37400', NE: '#70757a' }

function PtstBadge({ ptst }) {
  const label = PTST_LABEL[ptst] || 'No response'
  const color = PTST_COLOR[ptst] || PTST_COLOR.NE
  return (
    <span className="gcal-ptst-badge" style={{ color, borderColor: color }}>
      {label}
    </span>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const EVENT_COLORS = [
  '#1a73e8', '#d93025', '#188038', '#e37400', '#8430ce',
  '#00796b', '#c2185b', '#0277bd', '#558b2f', '#ef6c00',
]

// yyyy-MM-dd string from a Date — uses LOCAL date components to avoid UTC offset shift
function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// "2026-04-19 12:00" → "2026-04-19"
function eventDateStr(start) {
  return start ? start.split(' ')[0] : ''
}

// "2026-04-19 12:00" → "12:00"
function eventTime(start) {
  return start ? (start.split(' ')[1] || '') : ''
}

// Stable color per event id
function colorFor(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length]
}

// Build calendar grid: 42 cells (6 weeks × 7 days)
function buildGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()

  const cells = []
  // prev month padding
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), cur: false })
  // current month
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), cur: true })
  // next month padding
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++)
    cells.push({ date: new Date(year, month + 1, d), cur: false })
  return cells
}

export default function CalendarEvents() {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDay, setSelectedDay] = useState(toDateStr(today))
  // { [inviteId]: 'AC'|'DE'|'TE'|null } — null means a request is in-flight
  const [rsvpState, setRsvpState] = useState({})

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const grid = buildGrid(year, month)

  // Group events by date string — skip events the user has declined
  const byDate = {}
  events.forEach(ev => {
    const effectivePtst = rsvpState[ev.invId] ?? ev.ptst
    if (effectivePtst === 'DE') return           // hide declined events everywhere
    const d = eventDateStr(ev.start)
    if (d) { if (!byDate[d]) byDate[d] = []; byDate[d].push(ev) }
  })

  const loadEvents = useCallback(() => {
    setLoading(true)
    const from = toDateStr(new Date(year, month, 1))
    const to = toDateStr(new Date(year, month + 1, 0))
    calendarApi.getEvents(from, to)
      .then(res => setEvents(res.data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { loadEvents() }, [loadEvents])

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))
  const goToday  = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDay(toDateStr(today))
  }

  /**
   * Responds to a meeting invite.
   * Optimistic update: status is set immediately in local state.
   * On failure, the optimistic value is rolled back.
   */
  const handleRsvp = useCallback(async (ev, status) => {
    const invId = ev.invId
    if (!invId) return
    const previous = rsvpState[invId] ?? ev.ptst

    // Optimistic update
    setRsvpState(s => ({ ...s, [invId]: status }))

    try {
      await calendarApi.respondToMeeting(invId, status)
      // Update the events list so the badge is correct after a month refresh too
      setEvents(prev => prev.map(e => e.invId === invId ? { ...e, ptst: status } : e))
    } catch {
      // Rollback on failure
      setRsvpState(s => ({ ...s, [invId]: previous }))
    }
  }, [rsvpState])

  const todayStr = toDateStr(today)
  const selectedEvents = byDate[selectedDay] || []

  return (
    <div className="gcal-root">
      {/* ── Top toolbar ── */}
      <div className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <button className="gcal-today-btn" onClick={goToday}>Today</button>
          <button className="gcal-nav-btn" onClick={prevMonth} aria-label="Previous month">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="gcal-nav-btn" onClick={nextMonth} aria-label="Next month">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 4l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h2 className="gcal-month-label">{MONTHS[month]} {year}</h2>
        </div>
        <div className="gcal-toolbar-right">
          {loading && <span className="gcal-loading-dot" />}
          <button className="gcal-refresh-btn" onClick={loadEvents} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 8a7 7 0 1 0 .9-3.4" strokeLinecap="round" />
              <path d="M1 3v4h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div className="gcal-body">
        {/* ── Calendar grid ── */}
        <div className="gcal-grid-wrap">
          {/* Day headers */}
          <div className="gcal-day-headers">
            {DAYS.map(d => (
              <div key={d} className="gcal-day-header">{d}</div>
            ))}
          </div>

          {/* Cells */}
          <div className="gcal-cells">
            {grid.map(({ date, cur }, idx) => {
              const ds = toDateStr(date)
              const isToday = ds === todayStr
              const isSelected = ds === selectedDay
              const dayEvents = byDate[ds] || []

              return (
                <div
                  key={idx}
                  className={[
                    'gcal-cell',
                    !cur && 'gcal-cell-other',
                    isSelected && 'gcal-cell-selected',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setSelectedDay(ds)}
                >
                  <div className={['gcal-date-num', isToday && 'gcal-today-num'].filter(Boolean).join(' ')}>
                    {date.getDate()}
                  </div>
                  <div className="gcal-event-chips">
                    {dayEvents.slice(0, 3).map(ev => (
                      <div
                        key={ev.id}
                        className="gcal-chip"
                        style={{ background: colorFor(ev.id) }}
                        title={ev.title}
                      >
                        {!ev.allDay && eventTime(ev.start) && (
                          <span className="gcal-chip-time">{eventTime(ev.start)}</span>
                        )}
                        <span className="gcal-chip-title">{ev.title || '(No title)'}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="gcal-chip-more">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Day detail panel ── */}
        <div className="gcal-panel">
          <div className="gcal-panel-header">
            <div className="gcal-panel-day-num">
              {new Date(selectedDay + 'T00:00:00').getDate()}
            </div>
            <div className="gcal-panel-day-info">
              <span className="gcal-panel-weekday">
                {DAYS[new Date(selectedDay + 'T00:00:00').getDay()]}
              </span>
              <span className="gcal-panel-month">
                {MONTHS[new Date(selectedDay + 'T00:00:00').getMonth()]} {new Date(selectedDay + 'T00:00:00').getFullYear()}
              </span>
            </div>
          </div>

          <div className="gcal-panel-events">
            {selectedEvents.length === 0 ? (
              <div className="gcal-panel-empty">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#dadce0" strokeWidth="1.5">
                  <rect x="3" y="6" width="30" height="26" rx="3" />
                  <path d="M3 14h30M12 3v6M24 3v6" strokeLinecap="round" />
                </svg>
                <p>No events</p>
              </div>
            ) : (
              selectedEvents.map(ev => {
                const currentPtst = rsvpState[ev.invId] ?? ev.ptst ?? 'NE'
                const isResponding = rsvpState[ev.invId] === null
                const hasInvite = !!ev.invId

                return (
                  <div key={ev.id} className="gcal-panel-event">
                    <div
                      className="gcal-panel-event-bar"
                      style={{ background: colorFor(ev.id) }}
                    />
                    <div className="gcal-panel-event-body">
                      <div className="gcal-panel-event-title">
                        {ev.title || '(No title)'}
                      </div>

                      {!ev.allDay && ev.start && (
                        <div className="gcal-panel-event-time">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="6" cy="6" r="5" />
                            <path d="M6 3v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          {eventTime(ev.start)}
                          {ev.end && ev.end !== ev.start && ` – ${eventTime(ev.end)}`}
                        </div>
                      )}
                      {ev.allDay && (
                        <div className="gcal-panel-event-time gcal-allday-badge">All day</div>
                      )}
                      {ev.location && (
                        <div className="gcal-panel-event-loc">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M6 1a3.5 3.5 0 0 1 3.5 3.5C9.5 7.5 6 11 6 11S2.5 7.5 2.5 4.5A3.5 3.5 0 0 1 6 1z" />
                            <circle cx="6" cy="4.5" r="1" />
                          </svg>
                          {ev.location}
                        </div>
                      )}

                      {/* ── RSVP section (only for events with an invite) ── */}
                      {hasInvite && (
                        <div className="gcal-rsvp">
                          <PtstBadge ptst={currentPtst} />
                          <div className="gcal-rsvp-btns">
                            <button
                              className={`gcal-rsvp-btn gcal-rsvp-accept${currentPtst === 'AC' ? ' active' : ''}`}
                              disabled={isResponding || currentPtst === 'AC'}
                              onClick={() => handleRsvp(ev, 'AC')}
                              title="Accept"
                            >
                              ✓ Accept
                            </button>
                            <button
                              className={`gcal-rsvp-btn gcal-rsvp-tentative${currentPtst === 'TE' ? ' active' : ''}`}
                              disabled={isResponding || currentPtst === 'TE'}
                              onClick={() => handleRsvp(ev, 'TE')}
                              title="Tentative"
                            >
                              ? Maybe
                            </button>
                            <button
                              className={`gcal-rsvp-btn gcal-rsvp-decline${currentPtst === 'DE' ? ' active' : ''}`}
                              disabled={isResponding || currentPtst === 'DE'}
                              onClick={() => handleRsvp(ev, 'DE')}
                              title="Decline"
                            >
                              ✕ Decline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
