import axios from 'axios'

const api = axios.create({
  baseURL: '/zimbra',
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the HttpOnly zimbraSessionId cookie on every request
  withCredentials: true,
})

// Redirect to login on 401 (session expired / not found)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('zimbraUser')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login:  (email, password) => api.post('/auth/login', { email, password }),
  logout: ()                => api.post('/auth/logout'),
}

export const mailApi = {
  getInbox:  (limit = 20) => api.get('/mails/inbox', { params: { limit } }),
  getMail:   (id)          => api.get(`/mails/${id}`),
  markRead:  (id)          => api.put(`/mails/${id}/read`),
}

export const calendarApi = {
  getEvents: (fromDate, toDate) => api.get('/calendar/events', { params: { fromDate, toDate } }),

  /**
   * Respond to a meeting invite.
   * @param {string} inviteId   - the `invId` field from the CalendarEventDto
   * @param {'AC'|'DE'|'TE'} status - participation status
   * @param {string|null} eventStart - event start string (e.g. "2026-04-20 10:00"),
   *   required when status='DE' so the backend can free the DB slot immediately
   */
  respondToMeeting: (inviteId, status, eventStart = null) =>
    api.post(`/calendar/events/${encodeURIComponent(inviteId)}/respond`,
      { status, ...(eventStart ? { eventStart } : {}) }),
}

export const dashboardApi = {
  getDashboard: () => api.get('/dashboard'),
}

export default api
