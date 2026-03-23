import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import all Enterprise Modules (Admin)
import Login from './Login';
import Dashboard from './Dashboard';
import CustomerService from './CustomerService';
import FleetAssets from './FleetAssets';
import Analytics from './Analytics';
import AccountManagement from './AccountManagement';

// Import Client Portal Modules (User End)
import UserLogin from './UserLogin';
import UserPortal from './UserPortal';

// Admin Security Gatekeeper
const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Client Security Gatekeeper
const UserProtectedRoute = ({ children }) => {
  const session = localStorage.getItem('consignee_session');
  if (!session) {
    return <Navigate to="/user-login" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* --- PUBLIC ADMIN ROUTES --- */}
        <Route path="/" element={<Login />} />
        
        {/* --- PUBLIC CLIENT ROUTES --- */}
        <Route path="/user-login" element={<UserLogin />} />
        
        {/* --- PROTECTED ADMIN ROUTES --- */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/customer-service" element={
          <ProtectedRoute><CustomerService /></ProtectedRoute>
        } />
        <Route path="/fleet-assets" element={
          <ProtectedRoute><FleetAssets /></ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute><Analytics /></ProtectedRoute>
        } />
        <Route path="/account-management" element={
          <ProtectedRoute><AccountManagement /></ProtectedRoute>
        } />

        {/* --- PROTECTED CLIENT ROUTES --- */}
        {/* FIXED: Changed path from /track to /user-portal to match UserLogin navigation */}
        <Route path="/user-portal" element={
          <UserProtectedRoute><UserPortal /></UserProtectedRoute>
        } />

        {/* Catch-all: Redirect unknown paths to Admin Login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;