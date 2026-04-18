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
  getInbox: (limit = 20) => api.get('/mails/inbox', { params: { limit } }),
  getMail:  (id)          => api.get(`/mails/${id}`),
}

export const calendarApi = {
  getEvents: (fromDate, toDate) => api.get('/calendar/events', { params: { fromDate, toDate } }),
}

export const dashboardApi = {
  getDashboard: () => api.get('/dashboard'),
}

export default api
