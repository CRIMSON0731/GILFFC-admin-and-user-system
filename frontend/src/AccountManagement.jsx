import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; 
import './AccountManagement.css';

function AccountManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [activeTab, setActiveTab] = useState('profile');
  
  // UNIFIED DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');
  
  const navigate = useNavigate();

  const sessionUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [profile, setProfile] = useState({ full_name: sessionUser.name || '', email: sessionUser.email || '', role: sessionUser.role || '' });
  const [team, setTeam] = useState([]); 
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [sysMsg, setSysMsg] = useState({ type: '', text: '' }); 
  const [suggestedPass, setSuggestedPass] = useState('');
  const [isPasswordWeak, setIsPasswordWeak] = useState(false);
  
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // UNIFIED THEME ENGINE
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('admin_theme', newTheme ? 'dark' : 'light');
  };

  const t = {
    bg: isDarkMode ? '#020617' : '#f8fafc',
    card: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    text1: isDarkMode ? '#f8fafc' : '#0f172a', 
    text2: isDarkMode ? '#cbd5e1' : '#64748b', 
    text3: isDarkMode ? '#94a3b8' : '#94a3b8',
    headerBg: isDarkMode ? '#0f172a' : 'white',
    inputBg: isDarkMode ? '#1e293b' : '#f8fafc',
    inputDisabled: isDarkMode ? '#020617' : '#f1f5f9',
    hover: isDarkMode ? '#1e293b' : '#f1f5f9',
  };

  const checkPasswordStrength = (pass) => {
    if (!pass) return false;
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])(?=.{12,})/;
    const isStrong = strongRegex.test(pass);
    setIsPasswordWeak(!isStrong);
    if (!isStrong && pass.length > 0) {
      const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
      let retVal = "";
      for (let i = 0; i < 16; ++i) retVal += charset.charAt(Math.floor(Math.random() * charset.length));
      setSuggestedPass(retVal);
    } else setSuggestedPass('');
    return isStrong;
  };

  const generateStrongPassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let strong = "";
    for (let i = 0; i < 16; ++i) strong += charset.charAt(Math.floor(Math.random() * charset.length));
    setPasswords(prev => ({ ...prev, new: strong, confirm: strong }));
    setSuggestedPass(strong);
    setIsPasswordWeak(false);
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users');
      if (res.ok) setTeam(await res.json());
    } catch (err) { console.error("Failed to sync team data."); }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/user/profile/${sessionUser.id}`);
        if (res.ok) setProfile(await res.json());
      } catch (err) { console.error("Failed to sync profile data."); }
    };
    if (sessionUser.id) fetchProfile();
    if (activeTab === 'team') fetchTeam(); 
    const handleResize = () => setIsSidebarOpen(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sessionUser.id, activeTab]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5000/api/user/profile/${sessionUser.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: profile.full_name, email: profile.email })
      });
      if (res.ok) {
        setSysMsg({ type: 'success', text: 'Operative profile updated successfully.' });
        localStorage.setItem('user', JSON.stringify({ ...sessionUser, name: profile.full_name, email: profile.email }));
        setTimeout(() => setSysMsg({ type: '', text: '' }), 3000);
      }
    } catch (err) { setSysMsg({ type: 'error', text: 'Failed to update profile.' }); }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!passwords.current) {
      setSysMsg({ type: 'error', text: 'Please provide current password.' });
      return;
    }
    if (passwords.new !== passwords.confirm) {
      setSysMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    if (!checkPasswordStrength(passwords.new)) {
      setSysMsg({ type: 'error', text: 'Security Violation: Weak password. Please use uppercase + lowercase + digits + special chars + min 12 chars.' });
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email, currentPassword: passwords.current, newPassword: passwords.new })
      });
      if (res.ok) {
        setSysMsg({ type: 'success', text: 'Encryption key updated.' });
        setPasswords({ current: '', new: '', confirm: '' }); setSuggestedPass(''); setIsPasswordWeak(false);
        setTimeout(() => setSysMsg({ type: '', text: '' }), 4000);
      } else {
        const errorData = await res.json();
        setSysMsg({ type: 'error', text: errorData.message || 'Encryption update failed.' });
      }
    } catch (err) {
      setSysMsg({ type: 'error', text: 'Encryption update failed.' });
    }
  };

  const handleAddOperative = async () => {
    const name = window.prompt("New Operative Name:");
    const email = window.prompt("New Operative Email:");
    const pass = window.prompt("Initial Secure Password:");
    if (name && email && pass) {
      const r = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, email, password: pass })
      });
      if (r.ok) {
        setSysMsg({ type: 'success', text: 'New team member synchronized with database.' });
        fetchTeam();
      }
    }
  };

  const handleEditOperative = async (member) => {
    const name = window.prompt("Update Operative Name:", member.full_name);
    const email = window.prompt("Update Operative Email:", member.email);
    if (name && email) {
      try {
        const r = await fetch(`http://localhost:5000/api/user/profile/${member.user_id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name, email: email })
        });
        if (r.ok) {
          setSysMsg({ type: 'success', text: `Operative ${name} updated successfully.` });
          fetchTeam();
          setTimeout(() => setSysMsg({ type: '', text: '' }), 3000);
        }
      } catch (err) { setSysMsg({ type: 'error', text: 'Failed to update operative.' }); }
    }
  };

  const handleLogout = () => { localStorage.removeItem('user'); navigate('/'); };

  return (
    <div className={`fw-layout ${!isSidebarOpen ? 'sidebar-closed' : ''}`} style={{ background: t.bg, color: t.text1, transition: 'all 0.3s ease' }}>
      
      {/* MASTER CSS: GUARANTEES IDENTICAL UI ACROSS ALL PAGES */}
      <style>{`
        .fw-sidebar { background: ${isDarkMode ? '#020617' : '#0f172a'} !important; border-right: 1px solid ${isDarkMode ? '#1e293b' : '#0f172a'} !important; transition: all 0.3s ease; }
        .fw-brand h2 { color: white !important; }
        .fw-brand span { color: #94a3b8 !important; }
        .nav-label { color: #64748b !important; }
        .nav-btn { color: #94a3b8 !important; border-radius: 8px !important; margin-bottom: 4px !important; transition: all 0.2s ease; background: transparent !important; }
        .nav-btn:hover { background: rgba(255,255,255,0.05) !important; color: white !important; }
        .nav-btn.active { background: #2563eb !important; color: white !important; }
        .nav-btn.text-danger { color: #ef4444 !important; }
        .nav-btn.text-danger:hover { background: rgba(239,68,68,0.1) !important; }

        .fw-main { background: ${t.bg} !important; transition: all 0.3s ease; }
        .fw-topbar { background: ${t.headerBg} !important; border-bottom: 1px solid ${t.border} !important; transition: all 0.3s ease; }
        .fw-icon-btn { color: ${t.text1} !important; }
        .fw-search input { background: ${t.inputBg} !important; color: ${t.text1} !important; border: 1px solid ${t.border} !important; }
        .fw-page-header h1 { color: ${t.text1} !important; }
        .fw-page-header p { color: ${t.text2} !important; }
        
        .fw-kpi-card, .fw-data-panel, .settings-card, .settings-sidebar, .fw-board-card { background: ${t.card} !important; border: 1px solid ${t.border} !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .kpi-value, .panel-title-group h3, .card-header h3, .widget-title, .column-title, .card-client, .cell-primary { color: ${t.text1} !important; }
        .fw-table th { background: ${isDarkMode ? '#020617' : '#f8fafc'} !important; color: ${t.text2} !important; border-bottom: 1px solid ${t.border} !important; }
        .fw-table td { border-bottom: 1px solid ${t.border} !important; color: ${t.text1}; }
        .table-row-hover:hover td { background: ${isDarkMode ? '#1e293b' : '#f8fafc'} !important; }
        .cell-id, .cell-secondary, .card-cargo { color: ${t.text2} !important; }
        .fw-board-column { background: ${isDarkMode ? '#020617' : '#f1f5f9'} !important; border: 1px solid ${t.border} !important; }
        
        .fw-modal { background: ${t.card} !important; border: 1px solid ${t.border} !important; color: ${t.text1} !important; }
        .modal-header { border-bottom: 1px solid ${t.border} !important; }
        .modal-footer { border-top: 1px solid ${t.border} !important; background: ${isDarkMode ? '#020617' : '#f8fafc'} !important; }
        .fw-form label { color: ${t.text2} !important; }
        .fw-form input, .fw-form select { background: ${t.inputBg} !important; color: ${t.text1} !important; border: 1px solid ${t.border} !important; }
        
        .profile-dropdown-menu { background: ${t.card} !important; border: 1px solid ${t.border} !important; }
        .dropdown-header { color: ${t.text1} !important; }
        .dropdown-divider { background: ${t.border} !important; }
        .profile-dropdown-menu button { color: ${t.text1} !important; }
        .profile-dropdown-menu button.text-danger { color: #ef4444 !important; }
        .profile-dropdown-menu button:hover, .theme-btn:hover { background: ${t.hover} !important; }
      `}</style>

      <aside className="fw-sidebar">
        <div className="fw-brand">
          <div className="brand-titles"><h2>GILFFC</h2><span>Logistics OS</span></div>
        </div>
        <div className="fw-nav-section">
          <span className="nav-label">Core Operations</span>
          <nav className="fw-nav">
            <button className="nav-btn" onClick={() => navigate('/dashboard')}>Command Center</button>
            <button className="nav-btn" onClick={() => navigate('/customer-service')}>Comms Terminal</button>
            <button className="nav-btn" onClick={() => navigate('/fleet-assets')}>Fleet Assets</button>
            <button className="nav-btn" onClick={() => navigate('/analytics')}>Analytics</button>
            <button className="nav-btn active" onClick={() => navigate('/account-management')}>Account Settings</button>
          </nav>
        </div>
        <div className="fw-sidebar-bottom">
          <button className="nav-btn text-danger" onClick={handleLogout}>Secure Logout</button>
        </div>
      </aside>

      <main className="fw-main">
        <header className="fw-topbar">
          <div className="topbar-left">
            <button className="fw-icon-btn" style={{ color: t.text1 }} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
            <div className="fw-status-indicator ml-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot" style={{ background: '#2563eb' }}></span> 
              <span style={{ fontSize: '14px', fontWeight: '700', color: t.text2 }}>Secure Configuration Mode</span>
            </div>
          </div>
          
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            
            <button onClick={toggleTheme} className="theme-btn" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.text2, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
              {isDarkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            
            <div style={{ position: 'relative' }}>
              <div className="fw-profile hover-pointer" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                <div className="profile-text">
                  <span className="name" style={{ fontSize: '14px', fontWeight: '800', color: t.text1 }}>{profile.full_name || 'Operative'}</span>
                  <span className="role" style={{ fontSize: '11px', fontWeight: '600', color: t.text2 }}>{profile.role || 'Administrator'}</span>
                </div>
              </div>

              {isProfileMenuOpen && (
                <div className="profile-dropdown-menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '12px', background: t.card, borderRadius: '12px', width: '220px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: `1px solid ${t.border}`, zIndex: 1000, padding: '8px' }}>
                  <div className="dropdown-header" style={{ padding: '12px' }}>
                    <strong style={{ display: 'block', fontSize: '14px', color: t.text1 }}>{profile.full_name}</strong>
                    <span style={{ fontSize: '12px', color: t.text2 }}>{profile.email}</span>
                  </div>
                  <div className="dropdown-divider" style={{ height: '1px', background: t.border, margin: '8px 0' }}></div>
                  <button className="theme-btn" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: t.text1, cursor: 'pointer' }} onClick={() => {setActiveTab('profile'); setIsProfileMenuOpen(false);}}>Account Settings</button>
                  <button className="theme-btn" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: t.text1, cursor: 'pointer' }} onClick={() => {setActiveTab('team'); setIsProfileMenuOpen(false);}}>Manage Team</button>
                  <div className="dropdown-divider" style={{ height: '1px', background: t.border, margin: '8px 0' }}></div>
                  <button className="theme-btn text-danger" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }} onClick={handleLogout}>Secure Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="fw-content-wrapper" style={{ padding: '40px' }}>
          <div className="fw-page-header animate-up" style={{ animationDelay: '0.1s', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: '900', color: t.text1 }}>System Configuration</h1>
              <p style={{ fontSize: '16px', color: t.text2 }}>Manage your account parameters, team access, and security policies.</p>
            </div>
          </div>

          {sysMsg.text && (
            <div className={`sys-alert sys-alert-${sysMsg.type} animate-up`} style={{ padding: '16px 24px', borderRadius: '12px', marginBottom: '24px', background: sysMsg.type === 'success' ? (isDarkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5') : (isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2'), color: sysMsg.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${sysMsg.type === 'success' ? '#10b981' : '#ef4444'}`, fontWeight: '700' }}>
              {sysMsg.type === 'success' ? '✓' : '⚠'} {sysMsg.text}
            </div>
          )}

          <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
            <div className="settings-sidebar animate-up" style={{ animationDelay: '0.2s' }}>
              <nav className="settings-nav" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`} style={{ padding: '12px 20px', borderRadius: '10px', textAlign: 'left', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', background: activeTab === 'profile' ? '#2563eb' : t.card, color: activeTab === 'profile' ? 'white' : t.text2, transition: 'all 0.2s' }} onClick={() => setActiveTab('profile')}>Administrator Profile</button>
                <button className={`settings-tab ${activeTab === 'team' ? 'active' : ''}`} style={{ padding: '12px 20px', borderRadius: '10px', textAlign: 'left', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', background: activeTab === 'team' ? '#2563eb' : t.card, color: activeTab === 'team' ? 'white' : t.text2, transition: 'all 0.2s' }} onClick={() => setActiveTab('team')}>Access Control (Team)</button>
              </nav>

              <div className="security-status-widget mt-4" style={{ background: t.card, padding: '24px', borderRadius: '16px', border: `1px solid ${t.border}`, marginTop: '24px' }}>
                <span className="widget-title" style={{ fontSize: '11px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', display: 'block', marginBottom: '16px' }}>System Status</span>
                <div className="widget-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', color: t.text1 }}><span className="dot bg-emerald" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> Network Sync Active</div>
                <div className="widget-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', fontSize: '13px', fontWeight: '600', color: t.text1 }}><span className="dot bg-emerald" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> AES-256 Encryption</div>
                <div className="widget-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '600', color: t.text1 }}><span className="dot bg-blue" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span> Firewall Nominal</div>
              </div>
            </div>

            <div className="settings-content animate-up" style={{ animationDelay: '0.3s' }}>
              {activeTab === 'profile' && (
                <div className="settings-panel fade-in">
                  <div className="settings-card" style={{ background: t.card, borderRadius: '20px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                    <div className="card-header" style={{ padding: '32px', borderBottom: `1px solid ${t.border}` }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: t.text1 }}>Personal Information</h3>
                      <p style={{ color: t.text2, fontSize: '14px', marginTop: '4px' }}>Update your operative details and public profile.</p>
                    </div>
                    <form onSubmit={handleUpdateProfile}>
                      <div className="card-body" style={{ padding: '32px' }}>
                        <div className="fw-form" style={{ marginTop: '0' }}>
                          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div className="form-group half"><label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: t.text2, marginBottom: '8px', textTransform: 'uppercase' }}>Full Name</label><input style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1, fontWeight: '600' }} type="text" value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} required /></div>
                            <div className="form-group half"><label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: t.text2, marginBottom: '8px', textTransform: 'uppercase' }}>Operative ID</label><input style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputDisabled, fontWeight: '800', color: t.text3 }} type="text" value={`OP-${sessionUser.id ? sessionUser.id.toString().padStart(4, '0') : 'XXXX'}`} disabled /></div>
                          </div>
                          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="form-group half"><label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: t.text2, marginBottom: '8px', textTransform: 'uppercase' }}>Email Address</label><input style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1, fontWeight: '600' }} type="email" value={profile.email} onChange={e => setProfile({...profile, email: e.target.value})} required /></div>
                            <div className="form-group half"><label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: t.text2, marginBottom: '8px', textTransform: 'uppercase' }}>Timezone</label><select style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1, fontWeight: '600', cursor: 'pointer' }}><option>Asia/Manila (GMT+8)</option><option>UTC (GMT+0)</option></select></div>
                          </div>
                        </div>
                      </div>
                      <div className="card-footer" style={{ padding: '24px 32px', background: t.hover, borderTop: `1px solid ${t.border}`, textAlign: 'right' }}><button type="submit" style={{ padding: '12px 24px', borderRadius: '10px', background: '#2563eb', color: 'white', border: 'none', fontWeight: '800', cursor: 'pointer' }}>Save Changes</button></div>
                    </form>
                  </div>

                  {/* Password Change Panel */}
                  <div className="settings-card" style={{ background: t.card, borderRadius: '20px', border: `1px solid ${t.border}`, overflow: 'hidden', marginTop: '24px' }}>
                    <div className="card-header" style={{ padding: '24px', borderBottom: `1px solid ${t.border}` }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: t.text1 }}>Change Password</h3>
                      <p style={{ color: t.text2, fontSize: '14px', marginTop: '4px' }}>Requires current password and strong new password.</p>
                    </div>
                    <form onSubmit={handleUpdatePassword} style={{ padding: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        <label style={{ color: t.text2, fontSize: '12px', fontWeight: '700' }}>Current Password</label>
                        <input
                          type="password"
                          value={passwords.current}
                          onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                          required
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1 }}
                        />

                        <label style={{ color: t.text2, fontSize: '12px', fontWeight: '700' }}>New Password</label>
                        <input
                          type="password"
                          value={passwords.new}
                          onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                          required
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1 }}
                          placeholder="Min 12 chars, uppercase, lowercase, digit, special"
                        />

                        <label style={{ color: t.text2, fontSize: '12px', fontWeight: '700' }}>Confirm New Password</label>
                        <input
                          type="password"
                          value={passwords.confirm}
                          onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                          required
                          style={{ width: '100%', padding: '12px', borderRadius: '10px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1 }}
                        />

                        {isPasswordWeak && (
                          <div style={{ color: '#f59e0b', fontWeight: '600' }}>Password not strong enough.</div>
                        )}

                        {suggestedPass && (
                          <div style={{ color: '#10b981', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Suggested Strong Password: {suggestedPass}</span>
                            <button
                              type="button"
                              onClick={generateStrongPassword}
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.card, color: t.text1, cursor: 'pointer' }}
                            >Refresh</button>
                          </div>
                        )}

                        {!suggestedPass && (
                          <button
                            type="button"
                            onClick={generateStrongPassword}
                            style={{ padding: '10px 16px', fontSize: '13px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.card, color: t.text1, cursor: 'pointer' }}
                          >Generate Strong Password</button>
                        )}

                        <button
                          type="submit"
                          style={{ padding: '12px 24px', borderRadius: '10px', background: '#10b981', color: 'white', border: 'none', fontWeight: '800', cursor: 'pointer' }}
                        >Apply Password Change</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'team' && (
                <div className="settings-panel fade-in">
                  <div className="settings-card" style={{ background: t.card, borderRadius: '20px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                    <div className="card-header flex-between" style={{ padding: '32px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><h3 style={{ fontSize: '20px', fontWeight: '800', color: t.text1 }}>Team Management</h3><p style={{ color: t.text2, fontSize: '14px' }}>Manage system access levels for logistics personnel.</p></div>
                      <button style={{ padding: '10px 20px', borderRadius: '8px', background: '#2563eb', color: 'white', border: 'none', fontWeight: '800', cursor: 'pointer' }} onClick={handleAddOperative}>+ Add Operative</button>
                    </div>
                    <div className="card-body p-0">
                      <table className="fw-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr><th style={{ padding: '16px 32px', fontSize: '11px', color: t.text3, textTransform: 'uppercase', textAlign: 'left' }}>User</th><th style={{ padding: '16px 32px', fontSize: '11px', color: t.text3, textTransform: 'uppercase', textAlign: 'left' }}>Role</th><th></th></tr></thead>
                        <tbody>
                          {team.map((member) => (
                          <tr key={member.user_id} className="table-row-hover">
                            <td className="user-cell" style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div>
                                <span className="cell-primary" style={{ display: 'block', fontSize: '14px', fontWeight: '700' }}>{member.full_name}</span>
                                <span className="cell-secondary" style={{ fontSize: '12px', color: t.text2 }}>{member.email}</span>
                              </div>
                            </td>
                            <td style={{ padding: '20px 32px' }}><span style={{ background: isDarkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>{member.role || 'Administrator'}</span></td>
                            <td className="text-right" style={{ padding: '20px 32px', textAlign: 'right' }}><button style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '700', cursor: 'pointer' }} onClick={() => handleEditOperative(member)}>Edit</button></td>
                          </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AccountManagement;