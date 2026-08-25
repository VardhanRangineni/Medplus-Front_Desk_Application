import { Navigate } from 'react-router-dom';
import { hasAnyRole } from '../../services/locationScope';

/**
 * Role-based route guard.
 * Wraps child routes and checks hasAnyRole(session, allowedRoles).
 * If unauthorized, redirects to /dashboard.
 *
 * Props:
 *   session  – session object from App.jsx
 *   roles    – array of role strings allowed to access this route
 *   children – route content
 */
export default function ProtectedRoute({ session, roles, children }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!hasAnyRole(session, roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
