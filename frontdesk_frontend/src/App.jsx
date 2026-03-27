import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login          from './pages/Login/Login';
import Dashboard      from './pages/Dashboard/Dashboard';
import DashboardHome  from './pages/Dashboard/DashboardHome';
import LocationMaster from './pages/LocationMaster/LocationMaster';

const PrivateRoute = ({ children }) => {
  const token =
    localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Dashboard layout shell wraps all authenticated pages */}
        <Route
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard"        element={<DashboardHome />} />
          <Route path="/location-master"  element={<LocationMaster />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
