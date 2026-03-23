import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');

  // ✅ UNIFIED DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    localStorage.setItem('admin_theme', nextMode ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const t = {
    bg: isDarkMode ? '#020617' : '#f8fafc',
    pane: isDarkMode ? '#0f172a' : '#0f172a',
    text1: isDarkMode ? '#f8fafc' : '#0f172a',
    text2: isDarkMode ? '#cbd5e1' : '#64748b',
    card: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    inputBg: isDarkMode ? '#1e293b' : '#f8fafc',
    inputBorder: isDarkMode ? '#334155' : '#cbd5e1',
    button: isDarkMode ? '#2563eb' : '#2563eb'
  };

  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // 1. Determine Endpoint
    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';

    // 2. Determine Payload
    const payload = isRegistering 
      ? { full_name: fullName, email, password } 
      : { email, password };

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegistering) {
          alert("Registration successful! Please sign in.");
          setIsRegistering(false);
          setPassword('');
        } else {
          // Login Success
          localStorage.setItem('user', JSON.stringify(data.user));
          navigate('/dashboard');
        }
      } else {
        alert(data.message || data.error || "Authentication failed");
      }
    } catch (error) {
      alert("Critical Error: Connection to Security Server failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ background: t.bg, color: t.text1 }}>
      {/* LEFT: Branding Pane */}
      <div className="login-brand-pane" style={{ backgroundColor: isDarkMode ? '#0f172a' : '#0f172a' }}>
        <div className="brand-overlay"></div>
        <div className="brand-content">
          <div className="brand-logo-large">
            <img src="/gilffc-logo-globe.png" alt="GILFFC" />
          </div>
          <h1>GILFFC Logistics OS</h1>
          <p>Enterprise freight forwarding, real-time telemetry, and global supply chain management.</p>
          
          <div className="system-status">
            <span className="pulse-dot"></span>
            Security Layer: BCRYPT-AES-256
          </div>
        </div>
      </div>

      {/* RIGHT: Auth Pane */}
      <div className="login-auth-pane" style={{ background: t.card, color: t.text1 }}>
        <div className="auth-wrapper animate-up">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                background: 'transparent',
                border: `1px solid ${t.border}`,
                color: t.text1,
                cursor: 'pointer',
                borderRadius: 8,
                padding: '8px 12px'
              }}
            >
              {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
            </button>
          </div>
          <div className="auth-header">
            <h2>
              {isRegistering ? 'Create Operative Account' : 'Welcome back'}
            </h2>
            <p>
              {isRegistering 
                ? 'Register a new administrator to the logistics network.' 
                : 'Enter your operative credentials to access the command center.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="auth-form">
            {isRegistering && (
              <div className="form-group">
                <label>Full Name</label>
                <input 
                  type="text" 
                  placeholder="Enter your name" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                placeholder="admin@gilffc.global" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <div className="form-group">
              <div className="flex-between">
                <label>Password</label>
              </div>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn-login" disabled={isLoading}>
              {isLoading 
                ? 'Processing...' 
                : (isRegistering ? 'Register Operative' : 'Sign In to Workspace')}
            </button>
          </form>

          <div className="auth-footer">
            <button className="fw-btn-ghost mini-text" onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? "Already have an account? Sign In" : "Need a new operative account? Register"}
            </button>
            <p className="mt-4">
              Protected by end-to-end enterprise encryption. <br/> 
              Unauthorized access is strictly prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;