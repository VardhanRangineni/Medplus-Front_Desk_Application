import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import './App.css'

/**
 * Auth check: sessionStorage holds the email (display only).
 * The actual session lives in an HttpOnly cookie — XSS-safe.
 * If the cookie expires, the first API call returns 401 and
 * the axios interceptor redirects to /login automatically.
 */
function PrivateRoute({ children }) {
  const user = sessionStorage.getItem('zimbraUser')
  return user ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
