import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // ✅ UNIFIED DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('admin_theme');
    return saved ? saved === 'dark' : true; // Default to dark for a premium feel
  });

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    localStorage.setItem('admin_theme', nextMode ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Enterprise Theme Palette
  const t = {
    bg: isDarkMode ? '#0f172a' : '#ffffff',
    text1: isDarkMode ? '#f8fafc' : '#0f172a',
    text2: isDarkMode ? '#cbd5e1' : '#64748b',
    inputBg: isDarkMode ? '#1e293b' : '#f8fafc',
    inputBorder: isDarkMode ? '#334155' : '#e2e8f0',
    inputPlaceholder: isDarkMode ? '#64748b' : '#94a3b8',
    primary: '#2563eb',
    primaryHover: '#1d4ed8'
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:5000/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/dashboard');
      } else {
        alert(data.message || data.error || "Authentication failed. Invalid credentials.");
      }
    } catch (error) {
      alert("Critical Error: Connection to Security Server failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>
      
      {/* SCOPED CSS FOR PREMIUM UI */}
      <style>{`
        .auth-input {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          transition: all 0.2s ease;
          outline: none;
          box-sizing: border-box;
          border: 1px solid ${t.inputBorder};
          background-color: ${t.inputBg};
          color: ${t.text1};
        }
        .auth-input::placeholder {
          color: ${t.inputPlaceholder};
        }
        .auth-input:focus {
          border-color: ${t.primary} !important;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
        }
        .auth-btn {
          width: 100%;
          padding: 16px;
          background: ${t.primary};
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 16px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        }
        .auth-btn:hover {
          background: ${t.primaryHover};
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
        }
        .auth-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
        .theme-toggle-btn {
          position: absolute;
          top: 32px;
          right: 32px;
          background: transparent;
          border: 1px solid ${t.inputBorder};
          color: ${t.text2};
          padding: 10px 16px;
          border-radius: 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.2s;
        }
        .theme-toggle-btn:hover {
          background: ${isDarkMode ? '#1e293b' : '#f1f5f9'};
          color: ${t.text1};
        }
      `}</style>

      {/* LEFT PANE: BRANDING (Always Dark/Premium) */}
      <div style={{ 
        flex: 1.2, 
        background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '0 8%', 
        position: 'relative',
        borderRight: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
        color: 'white'
      }}>
        {/* Decorative Glow */}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '80%', height: '80%', background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 60%)', pointerEvents: 'none' }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ width: '64px', height: '64px', background: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <img src="/gilffc-logo-globe.png" alt="GILFFC" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          </div>
          
          <h1 style={{ fontSize: '48px', fontWeight: '900', letterSpacing: '-1px', margin: '0 0 16px 0', lineHeight: '1.1' }}>
            GILFFC <br/> Logistics OS
          </h1>
          <p style={{ fontSize: '18px', color: '#94a3b8', maxWidth: '450px', lineHeight: '1.6', margin: 0 }}>
            Enterprise freight forwarding, real-time telemetry, and global supply chain management.
          </p>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', color: '#34d399', marginTop: '48px' }}>
            <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px #10b981' }}></span>
            Security Layer: BCRYPT-AES-256
          </div>
        </div>
      </div>

      {/* RIGHT PANE: AUTHENTICATION */}
      <div style={{ 
        flex: 1, 
        background: t.bg, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        position: 'relative',
        transition: 'background 0.3s ease'
      }}>
        
        {/* Theme Toggle Button */}
        <button onClick={toggleTheme} className="theme-toggle-btn">
          {isDarkMode ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              Switch to Light
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              Switch to Dark
            </>
          )}
        </button>

        <div style={{ width: '100%', maxWidth: '400px', padding: '20px' }}>
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '32px', fontWeight: '900', color: t.text1, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              Welcome back
            </h2>
            <p style={{ color: t.text2, fontSize: '15px', margin: 0, lineHeight: '1.5' }}>
              Enter your operative credentials to access the command center.
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: t.text2, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email Address
              </label>
              <input 
                type="email" 
                className="auth-input"
                placeholder="admin@gilffc.global" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: t.text2, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Secure Password
              </label>
              <input 
                type="password" 
                className="auth-input"
                placeholder="••••••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="auth-btn" disabled={isLoading}>
              {isLoading ? 'Authenticating...' : 'Sign In to Workspace'}
            </button>
          </form>

          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: t.text2, lineHeight: '1.6' }}>
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