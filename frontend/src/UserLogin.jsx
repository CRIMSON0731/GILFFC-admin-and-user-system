import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function UserLogin() {
  const [waybillId, setWaybillId] = useState('');
  const [consigneeName, setConsigneeName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');

  const toggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem('admin_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const t = {
    bg: isDarkMode ? '#020617' : '#f8fafc',
    sideBg: isDarkMode ? '#0f172a' : '#0f172a',
    text1: isDarkMode ? '#f8fafc' : '#0f172a',
    text2: isDarkMode ? '#cbd5e1' : '#64748b',
    card: isDarkMode ? '#0f172a' : 'white',
    inputBg: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#334155' : '#cbd5e1'
  };

  const navigate = useNavigate();

  const handleTrackingLogin = async (e) => {
    e.preventDefault();
    if (!waybillId || !consigneeName) return alert("Please fill in all fields.");

    setIsLoading(true);
    try {
      // Extract only digits from AWB (e.g., "AWB-000016" becomes "16")
      const cleanId = waybillId.replace(/\D/g, '');
      
      const params = new URLSearchParams({
        id: cleanId,
        name: consigneeName.trim()
      });

      const response = await fetch(`http://localhost:5000/api/user/track?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        // 1. Save the secure session for the portal to use
        localStorage.setItem('consignee_session', JSON.stringify({
          delivery_id: data.delivery_id,
          receiver_name: data.receiver_name
        }));

        // 2. Redirect specifically to the Client Tracking Portal
        console.log("Login successful, navigating to portal...");
        navigate('/user-portal');
      } else {
        alert(data.error || "Authentication Failed: Waybill not found.");
      }
    } catch (error) {
      alert("System Link Error: Ensure your backend is running on port 5000.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: t.bg, color: t.text1 }}>
      
      {/* Branding Side */}
      <div style={{ flex: 1, background: t.sideBg, color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px' }}>
        <img src="/gilffc-logo-globe.png" alt="Logo" style={{ width: '48px', marginBottom: '32px' }} />
        <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '16px', letterSpacing: '-1px' }}>GILFFC Client Portal</h1>
        <p style={{ color: '#94a3b8', fontSize: '18px', lineHeight: '1.6' }}>Real-time telemetry and direct operative support for your freight.</p>
      </div>

      {/* Form Side */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px', background: t.bg }}>
        <div style={{ maxWidth: '400px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button type="button" onClick={toggleTheme} style={{ border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 14px', background: 'transparent', color: t.text1, cursor: 'pointer' }}>
              {isDarkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: t.text1, marginBottom: '8px' }}>Track Your Shipment</h2>
          <p style={{ color: t.text2, marginBottom: '32px' }}>Initialize secure telemetry sync via waybill verification.</p>

          <form onSubmit={handleTrackingLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: t.text2 }}>Waybill ID</label>
              <input 
                type="text" 
                placeholder="e.g. AWB-000016" 
                value={waybillId}
                onChange={(e) => setWaybillId(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}`, outline: 'none', boxSizing: 'border-box', background: t.inputBg, color: t.text1 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: t.text2 }}>Consignee Name</label>
              <input 
                type="text" 
                placeholder="Registered Consignee Name" 
                value={consigneeName}
                onChange={(e) => setConsigneeName(e.target.value)}
                style={{ width: '100%', padding: '14px', borderRadius: '8px', border: `1px solid ${t.border}`, outline: 'none', boxSizing: 'border-box', background: t.inputBg, color: t.text1 }}
              />
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              style={{ 
                padding: '16px', 
                background: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: '700', 
                fontSize: '15px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                marginTop: '10px'
              }}
            >
              {isLoading ? 'Syncing...' : 'Initialize Telemetry'}
            </button>
          </form>

          {/* Development Switcher */}
          <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
            Accessing the Hub? <span onClick={() => navigate('/')} style={{ color: '#2563eb', fontWeight: '700', cursor: 'pointer' }}>Admin Sign In</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserLogin;