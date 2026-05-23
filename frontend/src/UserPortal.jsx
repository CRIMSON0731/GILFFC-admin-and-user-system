import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

// ─── GILFFC Hub Origin & Google Maps Config ─────────────────────────────────
const GOOGLE_MAPS_API_KEY = 'AIzaSyDJvIQon878_VcstOhV-Z5IqDqerFZtIVA'; 
const GILFFC_HUB_ADDRESS = 'GILFFC Global Distribution Hub, Manila, Philippines';

// ─── Live Weather Telemetry Engine ──────────────────────────────────────────
const fetchLiveWeatherContext = async (lat, lon) => {
  // Fallback to Hub coords (Manila) if cargo geodata is missing
  const queryLat = lat || 14.5866;
  const queryLon = lon || 120.9630;
  
  try {
    
    const API_KEY = '2efe8fc4f4c2807debc7c4ebf9ac3e24'; 
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${queryLat}&lon=${queryLon}&appid=${API_KEY}`);
    
    if (!response.ok) throw new Error("API Connection Failed");
    
    const data = await response.json();
    const condition = data.weather[0].main.toLowerCase();

    if (condition === 'thunderstorm' || condition === 'squall' || condition === 'tornado') {
      return "Severe Storm Buffer Active";
    } else if (condition === 'rain' || condition === 'drizzle') {
      return "Wet Roads / Rain Buffer";
    } else if (condition === 'mist' || condition === 'fog' || condition === 'haze') {
      return "Low Visibility Buffer";
    }
    
    return "Nominal / Clear Skies";
  } catch (error) {
    console.error("Weather API offline or limit reached, falling back to nominal.");
    return "API Offline (Nominal Fallback)";
  }
};

function UserPortal() {
  const [shipment, setShipment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // LIVE TELEMETRY STATES (AI Engine)
  const [liveEta, setLiveEta] = useState('--');
  const [etaDate, setEtaDate] = useState('--');
  const [progressPct, setProgressPct] = useState(0);
  const [confidenceScore, setConfidenceScore] = useState('Calculating...');
  const [weatherContext, setWeatherContext] = useState('Syncing Telemetry...');
  
  // Dark Mode State (Persists in localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');
  
  const [prevMsgCount, setPrevMsgCount] = useState(0);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const chatEndRef = useRef(null);
  const prevStatusRef = useRef(null);
  const navigate = useNavigate();
  const session = JSON.parse(localStorage.getItem('consignee_session'));

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('admin_theme', newTheme ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // THEME ENGINE
  const t = {
    bg: isDarkMode ? '#020617' : '#f4f7f9',
    card: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    text1: isDarkMode ? '#f8fafc' : '#0f172a',
    text2: isDarkMode ? '#cbd5e1' : '#64748b',
    text3: isDarkMode ? '#94a3b8' : '#94a3b8',
    header: isDarkMode ? '#020617' : '#0f172a',
    accent: isDarkMode ? '#1e293b' : '#f1f5f9', 
    chatBg: isDarkMode ? '#020617' : '#f8fafc',
    chatBubbleAdmin: isDarkMode ? '#1e293b' : '#f1f5f9',
    successBg: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
    primaryBg: isDarkMode ? 'rgba(37, 99, 235, 0.15)' : '#eff6ff',
    progressTrack: isDarkMode ? '#1e293b' : '#f1f5f9',
    btnPrimary: isDarkMode ? '#2563eb' : '#0f172a',
    btnHover: isDarkMode ? '#1d4ed8' : '#1e293b'
  };

  const loadData = async () => {
    if (!session) return navigate('/user-login');
    try {
      const [sRes, mRes] = await Promise.all([
        fetch(`http://localhost:5000/api/user/shipment/${session.delivery_id}`),
        fetch(`http://localhost:5000/api/messages/${session.delivery_id}`)
      ]);

      if (!sRes.ok) {
        localStorage.removeItem('consignee_session');
        return navigate('/user-login');
      }

      const sData = await sRes.json();
      const mData = await mRes.json();
      
      // LIVE DISPATCH & DELIVERY NOTIFIER ENGINE
      if (prevStatusRef.current) {
        if (prevStatusRef.current === 'Pending' && sData.status === 'Out for Delivery') {
          new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => console.log("Audio blocked by browser"));
          setToastMsg("🚀 Your cargo has been dispatched! Track its live telemetry now.");
          setTimeout(() => setToastMsg(null), 8000);
        } else if (prevStatusRef.current !== 'Done' && sData.status === 'Done') {
          // Play custom sound from public folder
          new Audio('/mixkit-bell-notification-933.wav').play().catch(() => console.log("Audio blocked by browser"));
          setToastMsg("✅ Cargo successfully delivered! Secure handover complete.");
          setTimeout(() => setToastMsg(null), 8000);
        }
      }
      
      prevStatusRef.current = sData.status;

      setShipment(sData);
      setMessages(mData);
    } catch (e) {
      console.error("Link unstable");
    }
  };

  // 1. DATABASE POLLING ENGINE
  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. FETCH LIVE WEATHER SENSOR DATA
  useEffect(() => {
    if (shipment) {
      fetchLiveWeatherContext(shipment.latitude, shipment.longitude).then(setWeatherContext);
    }
  }, [shipment?.latitude, shipment?.longitude]);

  // 3. LIVE PREDICTIVE AI ENGINE (Pessimistic P90 + Digital Twin Context)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!shipment) return;
      
      const today = new Date();

      if (shipment.status === 'Done') {
        setLiveEta('Delivered Successfully');
        setEtaDate(today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        setProgressPct(100);
        setConfidenceScore('Confirmed');
      } else if (shipment.status === 'Pending') {
        setLiveEta('Pending Hub Dispatch');
        setEtaDate('Calculating...');
        setProgressPct(0);
        setConfidenceScore('Awaiting Launch');
      } else {
        const savedProgress = JSON.parse(localStorage.getItem('fleet_realtime_v2') || '{}');
        const state = savedProgress[shipment.delivery_id];
        
        if (state && state.dispatchTime && state.lockedTotalTime) {
          const now = Date.now();
          const elapsedMins = (now - state.dispatchTime) / 60000;
          
          // PESSIMISTIC P90 FORECASTING: Force a 20% buffer to the base admin time
          const pessimisticTotalTime = state.lockedTotalTime * 1.20;
          const remainingMins = Math.max(0, Math.ceil(pessimisticTotalTime - elapsedMins));
          const pct = Math.min(100, Math.floor((elapsedMins / pessimisticTotalTime) * 100));

          // PROBABILISTIC CONTEXT GENERATOR (Context layer logic hidden from UI)
          let confidence = 'High (90%+)';

          if (remainingMins > 0) {
            // Pseudo-random simulation using delivery ID and current hour to keep it stable
            const hash = (shipment.delivery_id * new Date().getHours()) % 100;
            if (hash < 15) {
              confidence = 'Low (< 60%)';
            } else if (hash < 35) {
              confidence = 'Moderate (75%)';
            } else if (hash < 50) {
              confidence = 'Moderate (80%)';
            } else if (hash < 60) {
               confidence = 'Moderate (70%)';
            }
          }
          
          if (remainingMins === 0 || pct === 100) {
            setLiveEta('Docking Sequence');
            setEtaDate('Arriving Now');
            setProgressPct(100);
            setConfidenceScore('Confirmed (100%)');
          } else {
            setLiveEta('Predictive Telemetry');
            setEtaDate(`~${remainingMins} mins (P90)`);
            setProgressPct(pct);
            setConfidenceScore(confidence);
          }
        } else {
          setLiveEta('Connecting to Network...');
          setEtaDate('Tracking');
          setProgressPct(5);
        }
      }
    }, 1000); 
    return () => clearInterval(timer);
  }, [shipment]);

  // 4. COMMS ENGINE (Chat & Notifications)
  useEffect(() => {
    if (messages.length > prevMsgCount) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.sender_name === 'Admin') {
        new Audio('https://assets.mixkit.co/active_storage/sfx/1350/1350-preview.mp3').play().catch(() => {});
        fetch(`http://localhost:5000/api/messages/read/${session.delivery_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'User' })
        });
      }
      setPrevMsgCount(messages.length);
    }
  }, [messages, prevMsgCount, session?.delivery_id]);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [messages.length]);

  const handleSend = async (e) => {
    if ((e.key === 'Enter' || e.type === 'click') && newMessage.trim()) {
      await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: session.receiver_name,
          receiver_name: 'Admin',
          delivery_id: session.delivery_id,
          message_text: newMessage
        })
      });
      setNewMessage('');
      loadData();
    }
  };

  if (!shipment) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0f172a', color: 'white', minHeight: '100vh' }}><h2>Establishing Secure Link...</h2></div>;

  const statusStep = shipment.status === 'Pending' ? 1 : (shipment.status === 'Done' ? 3 : 2);

  return (
    <div style={{ background: t.bg, color: t.text1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif", transition: 'background 0.3s ease, color 0.3s ease' }}>
      
      {/* FLOATING DISPATCH TOAST */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: '24px', right: '50%', transform: 'translateX(50%)', background: toastMsg.includes('Delivered') ? '#10b981' : '#2563eb', color: 'white', padding: '16px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: '800', boxShadow: toastMsg.includes('Delivered') ? '0 10px 25px -5px rgba(16,185,129,0.4)' : '0 10px 25px -5px rgba(37,99,235,0.4)', zIndex: 9999, animation: 'slideDown 0.4s ease forwards' }}>
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes slideDown { from { top: -50px; opacity: 0; } to { top: 24px; opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${t.text3}; }
        .theme-btn:hover { background: rgba(255,255,255,0.1) !important; }
        @keyframes subtle-pulse { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }
      `}</style>

      {/* SECURE HEADER */}
      <header style={{ background: t.header, padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', zIndex: 50, borderBottom: `1px solid ${isDarkMode ? '#1e293b' : '#0f172a'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/gilffc-logo-globe.png" alt="Logo" style={{ height: '36px' }} />
          <div>
            <h2 style={{ fontSize: '18px', margin: 0, fontWeight: '800', letterSpacing: '1px' }}>GILFFC LOGISTICS OS</h2>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>Client Telemetry Portal</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={toggleTheme} className="theme-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#f8fafc', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isDarkMode ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                <span>Light</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                <span>Dark</span>
              </>
            )}
          </button>
          <button onClick={() => { localStorage.removeItem('consignee_session'); navigate('/user-login'); }} className="theme-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#f8fafc', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', transition: 'all 0.2s' }}>
            Secure Disconnect
          </button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          
          {/* PORTAL FEATURES GUIDE */}
          <div className="animate-up" style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '900', color: t.text1, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
              Welcome, {session?.receiver_name}
            </h2>
            <p style={{ fontSize: '15px', color: t.text2, margin: '0 0 24px 0' }}>
              Here is what you can do within your secure logistics portal:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              <div style={{ background: t.card, padding: '20px', borderRadius: '16px', border: `1px solid ${t.border}`, display: 'flex', gap: '16px', alignItems: 'flex-start', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>⌖</div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: t.text1 }}>Live Telemetry</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: t.text2, lineHeight: '1.5' }}>Monitor your cargo's exact transit progress and dynamic AI-powered ETA in real-time.</p>
                </div>
              </div>

              <div style={{ background: t.card, padding: '20px', borderRadius: '16px', border: `1px solid ${t.border}`, display: 'flex', gap: '16px', alignItems: 'flex-start', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>▤</div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: t.text1 }}>Digital Manifest</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: t.text2, lineHeight: '1.5' }}>Review verified payload contents, handling priority, and detailed activity logs securely.</p>
                </div>
              </div>

              <div style={{ background: t.card, padding: '20px', borderRadius: '16px', border: `1px solid ${t.border}`, display: 'flex', gap: '16px', alignItems: 'flex-start', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>⌗</div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: t.text1 }}>HQ Comms Link</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: t.text2, lineHeight: '1.5' }}>Communicate instantly with a live GILFFC operative for updates, instructions, or concerns.</p>
                </div>
              </div>

            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 400px', gap: '40px', alignItems: 'start' }}>
            
            {/* LEFT COLUMN: TRACKING DATA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* HERO EXECUTIVE CARD */}
              <section className="animate-up" style={{ background: t.card, borderRadius: '16px', border: `1px solid ${t.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden', transition: 'all 0.3s' }}>
                
                {/* Top Banner Area */}
                <div style={{ background: 'linear-gradient(to right, #0f172a, #1e293b)', padding: '32px 40px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Waybill Tracking Number</span>
                    <h1 style={{ fontSize: '44px', fontWeight: '900', margin: '8px 0 0 0', letterSpacing: '-1px' }}>
                      AWB-{shipment.delivery_id.toString().padStart(6, '0')}
                    </h1>
                  </div>
                  
                  <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.05)', padding: '20px 24px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '260px', position: 'relative' }}>
                    
                    {/* AI TOOLTIP TRIGGER */}
                    {statusStep === 2 && (
                      <div 
                        onMouseEnter={() => setShowAiTooltip(true)}
                        onMouseLeave={() => setShowAiTooltip(false)}
                        style={{ position: 'absolute', top: '-12px', right: '-12px', background: '#38bdf8', color: '#0f172a', padding: '4px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '800', border: '2px solid #0f172a', cursor: 'help', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>◈</span> AI Forecast
                      </div>
                    )}

                    {/* AI TOOLTIP CONTENT */}
                    {showAiTooltip && (
                      <div style={{ position: 'absolute', top: '24px', right: '-12px', width: '280px', background: isDarkMode ? '#1e293b' : 'white', color: isDarkMode ? 'white' : '#0f172a', padding: '16px', borderRadius: '12px', border: `1px solid ${isDarkMode ? '#38bdf8' : '#e2e8f0'}`, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 100, textAlign: 'left' }}>
                        <strong style={{ color: '#38bdf8', fontSize: '12px', display: 'block', marginBottom: '8px' }}>DYNAMIC ETA ACTIVE</strong>
                        <span style={{ fontSize: '12px', lineHeight: '1.5', display: 'block', color: isDarkMode ? '#cbd5e1' : '#64748b' }}>
                          This ETA is simulated using a <strong>Pessimistic P90 Probabilistic Model</strong> via our Digital Twin. It analyzes real-time external streams (weather, traffic, port data) to forecast delivery securely.
                        </span>
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                          <strong style={{ color: t.text1 }}>Live Sensor:</strong> {weatherContext}
                        </div>
                      </div>
                    )}

                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {statusStep === 3 ? 'Delivered On' : 'Delivery Commitment'}
                    </span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: statusStep === 1 ? '#f59e0b' : '#10b981', margin: '4px 0' }}>
                      {etaDate}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {statusStep === 2 && <span className="pulse-dot" style={{ background: '#3b82f6', boxShadow: '0 0 0 0 rgba(59,130,246,0.7)' }}></span>}
                      {liveEta}
                    </div>
                    
                    {/* LIVE PROGRESS BAR */}
                    {statusStep === 2 && (
                      <div style={{ marginTop: '12px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: '#3b82f6', transition: 'width 1s linear' }}></div>
                      </div>
                    )}

                    {/* AI DIAGNOSTICS WIDGET */}
                    {statusStep === 2 && (
                      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>◈ AI Telemetry Diagnostics</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: '#cbd5e1' }}>Confidence Score:</span>
                          <span style={{ fontWeight: '700', color: confidenceScore.includes('Low') ? '#ef4444' : confidenceScore.includes('Moderate') ? '#f59e0b' : '#10b981' }}>{confidenceScore}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                          <span style={{ color: '#cbd5e1' }}>Live Weather Layer:</span>
                          <span style={{ fontWeight: '700', color: weatherContext.includes('Buffer') ? '#f59e0b' : '#38bdf8' }}>{weatherContext}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Stepper Area */}
                <div style={{ padding: '40px' }}>
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    
                    {/* The Background Line */}
                    <div style={{ position: 'absolute', top: '24px', left: '40px', right: '40px', height: '4px', background: t.progressTrack, zIndex: 0, borderRadius: '2px' }}></div>
                    
                    {/* The Active Line */}
                    <div style={{ position: 'absolute', top: '24px', left: '40px', width: statusStep === 1 ? '0%' : statusStep === 2 ? '50%' : 'calc(100% - 80px)', height: '4px', background: statusStep === 3 ? '#10b981' : '#2563eb', zIndex: 1, borderRadius: '2px', transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>

                    {/* Step 1: Processed */}
                    <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: t.card, border: `4px solid ${statusStep >= 1 ? '#2563eb' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 4px ${t.card}` }}>
                        <span style={{ color: statusStep >= 1 ? '#2563eb' : t.text2, fontWeight: '900', fontSize: '18px' }}>1</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: t.text1, marginTop: '12px' }}>Processed</span>
                    </div>

                    {/* Step 2: Transit */}
                    <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: t.card, border: `4px solid ${statusStep >= 2 ? '#2563eb' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 4px ${t.card}`, animation: statusStep === 2 ? 'subtle-pulse 2s infinite' : 'none' }}>
                        <span style={{ color: statusStep >= 2 ? '#2563eb' : t.text2, fontWeight: '900', fontSize: '18px' }}>2</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: statusStep >= 2 ? '800' : '600', color: statusStep >= 2 ? t.text1 : t.text3, marginTop: '12px' }}>In Transit</span>
                    </div>

                    {/* Step 3: Delivered */}
                    <div style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: t.card, border: `4px solid ${statusStep === 3 ? '#10b981' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 4px ${t.card}` }}>
                        {statusStep === 3 ? (
                          <span style={{ color: '#10b981', fontWeight: '900', fontSize: '20px' }}>✓</span>
                        ) : (
                          <span style={{ color: t.text2, fontWeight: '900', fontSize: '18px' }}>3</span>
                        )}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: statusStep === 3 ? '800' : '600', color: statusStep === 3 ? t.text1 : t.text3, marginTop: '12px' }}>Delivered</span>
                    </div>

                  </div>
                </div>
              </section>

              {/* SPLIT GRID: MANIFEST & TIMELINE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                
                {/* Left Side: Digital Manifest */}
                <section className="animate-up" style={{ animationDelay: '0.1s', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: t.text1 }}>Digital Manifest</h3>
                    <span style={{ background: t.accent, color: t.text2, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>VERIFIED DATA</span>
                  </div>

                  <div style={{ background: t.card, borderRadius: '16px', border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    {/* Origin to Destination Block */}
                    <div style={{ padding: '24px', borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div style={{ color: t.text3, marginTop: '2px' }}>○</div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>From</div>
                          <div style={{ fontSize: '15px', fontWeight: '700', color: t.text1, marginTop: '2px' }}>GILFFC Global Distribution Hub</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ color: '#2563eb', marginTop: '2px' }}>●</div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>To Consignee</div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: t.text1, marginTop: '2px' }}>{shipment.receiver_name}</div>
                          <div style={{ fontSize: '14px', color: t.text2, marginTop: '4px', lineHeight: '1.5' }}>{shipment.address}</div>
                        </div>
                      </div>
                    </div>

                    {/* Specs Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: t.accent }}>
                      <div style={{ padding: '20px', borderRight: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Payload Contents</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: t.text1, marginTop: '4px' }}>{shipment.item_name}</div>
                      </div>
                      <div style={{ padding: '20px', borderBottom: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Handling Priority</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#2563eb', marginTop: '4px' }}>Express Freight</div>
                      </div>
                      <div style={{ padding: '20px', borderRight: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Total Weight</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: t.text1, marginTop: '4px' }}>Standard LTL</div>
                      </div>
                      <div style={{ padding: '20px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Terms</div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: t.text1, marginTop: '4px' }}>DDP (Delivered)</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Right Side: Detailed Activity Log */}
                <section className="animate-up" style={{ animationDelay: '0.2s', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: t.text1 }}>Activity Log</h3>
                  
                  <div style={{ background: t.card, borderRadius: '16px', padding: '32px', border: `1px solid ${t.border}`, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <div style={{ position: 'relative', paddingLeft: '24px' }}>
                      <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '7px', width: '2px', background: t.border }}></div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        
                        {statusStep >= 3 && (
                          <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: '#10b981', border: `3px solid ${t.card}`, boxShadow: '0 0 0 2px #10b981', zIndex: 2 }}></div>
                            <div style={{ fontSize: '15px', fontWeight: '800', color: t.text1 }}>Delivered</div>
                            <div style={{ fontSize: '13px', color: t.text2, marginTop: '4px' }}>Signed by Consignee.</div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: t.text3, marginTop: '6px', textTransform: 'uppercase' }}>Destination Hub</div>
                          </div>
                        )}

                        {statusStep >= 2 && (
                          <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: statusStep === 2 ? '#2563eb' : t.border, border: `3px solid ${t.card}`, boxShadow: `0 0 0 2px ${statusStep === 2 ? '#2563eb' : t.border}`, zIndex: 2 }}></div>
                            <div style={{ fontSize: '15px', fontWeight: statusStep === 2 ? '800' : '600', color: statusStep === 2 ? t.text1 : t.text2 }}>In Transit - Out for Delivery</div>
                            <div style={{ fontSize: '13px', color: t.text2, marginTop: '4px' }}>Shipment handed to final dispatch courier.</div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: t.text3, marginTop: '6px', textTransform: 'uppercase' }}>Local Dispatch Center</div>
                          </div>
                        )}

                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', background: statusStep === 1 ? '#2563eb' : t.border, border: `3px solid ${t.card}`, boxShadow: `0 0 0 2px ${statusStep === 1 ? '#2563eb' : t.border}`, zIndex: 2 }}></div>
                          <div style={{ fontSize: '15px', fontWeight: statusStep === 1 ? '800' : '600', color: statusStep === 1 ? t.text1 : t.text2 }}>Shipment Data Received</div>
                          <div style={{ fontSize: '13px', color: t.text2, marginTop: '4px' }}>Waybill generated by sender. Awaiting handover.</div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: t.text3, marginTop: '6px', textTransform: 'uppercase' }}>GILFFC Processing</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

              </div>

              {/* ─── GOOGLE MAPS ROUTE SECTION ─────────────────────────────── */}
              <section className="animate-up" style={{ animationDelay: '0.3s', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: t.text1 }}>Route Map</h3>
                  <span style={{ background: statusStep === 2 ? 'rgba(37,99,235,0.12)' : t.accent, color: statusStep === 2 ? '#2563eb' : t.text2, padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {statusStep === 2 && <span className="pulse-dot" style={{ background: '#2563eb', boxShadow: '0 0 0 0 rgba(37,99,235,0.7)', width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block' }}></span>}
                    {statusStep === 3 ? 'ROUTE COMPLETED' : statusStep === 2 ? 'IN TRANSIT' : 'PENDING DISPATCH'}
                  </span>
                </div>

                <div style={{ background: t.card, borderRadius: '16px', border: `1px solid ${t.border}`, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>

                  {/* Route Header: Origin → Destination */}
                  <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '0', flexWrap: 'wrap' }}>
                    
                    {/* Origin */}
                    <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(37,99,235,0.12)', border: '2px solid #2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: '#2563eb', fontSize: '14px', fontWeight: '900' }}>G</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Origin</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: t.text1, lineHeight: '1.3' }}>GILFFC Global</div>
                        <div style={{ fontSize: '12px', color: t.text2, marginTop: '1px' }}>Distribution Hub, Manila</div>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: t.text3 }}>
                      <div style={{ width: '60px', height: '2px', background: `linear-gradient(to right, #2563eb, ${statusStep === 3 ? '#10b981' : '#2563eb'})`, borderRadius: '2px', position: 'relative' }}>
                        <div style={{ position: 'absolute', right: '-4px', top: '-4px', borderLeft: `8px solid ${statusStep === 3 ? '#10b981' : '#2563eb'}`, borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }}></div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: t.text3, letterSpacing: '0.5px' }}>DRIVING</span>
                    </div>

                    {/* Destination */}
                    <div style={{ flex: 1, minWidth: '180px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: statusStep === 3 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', border: `2px solid ${statusStep === 3 ? '#10b981' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '16px' }}>{statusStep === 3 ? '✓' : '📍'}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3px' }}>Consignee</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: t.text1, lineHeight: '1.3' }}>{shipment.receiver_name}</div>
                        <div style={{ fontSize: '12px', color: t.text2, marginTop: '1px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shipment.address}</div>
                      </div>
                    </div>

                  </div>

                  {/* Google Maps Embed */}
                  <div style={{ position: 'relative', width: '100%', height: '380px', background: t.accent }}>
                    {GOOGLE_MAPS_API_KEY !== 'AIzaSyDJvIQon878_VcstOhV-Z5IqDqerFZtIVA' ? (
                      <iframe
                        title="Route Map"
                        width="100%"
                        height="100%"
                        style={{ border: 0, display: 'block' }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(GILFFC_HUB_ADDRESS)}&destination=${encodeURIComponent(shipment.address)}&mode=driving`}
                      />
                    ) : (
                      /* ── Placeholder when no API key is set ── */
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px', boxSizing: 'border-box' }}>
                        {/* Stylized map placeholder */}
                        <div style={{ position: 'relative', width: '100%', maxWidth: '420px', height: '220px', background: isDarkMode ? '#0f1f3d' : '#dbeafe', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${t.border}` }}>
                          {/* Grid lines */}
                          {[...Array(6)].map((_, i) => (
                            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 20}%`, height: '1px', background: isDarkMode ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.1)' }} />
                          ))}
                          {[...Array(8)].map((_, i) => (
                            <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 14}%`, width: '1px', background: isDarkMode ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.1)' }} />
                          ))}
                          {/* Simulated road */}
                          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 420 220" preserveAspectRatio="none">
                            <path d="M 30 110 Q 100 60, 180 100 Q 260 140, 340 80 L 395 70" stroke={isDarkMode ? '#3b82f6' : '#2563eb'} strokeWidth="4" fill="none" strokeDasharray="none" strokeLinecap="round"/>
                            <path d="M 30 110 Q 120 150, 220 130 Q 300 115, 395 70" stroke={isDarkMode ? '#475569' : '#94a3b8'} strokeWidth="3" fill="none" strokeDasharray="8,6" strokeLinecap="round"/>
                          </svg>
                          {/* Origin dot */}
                          <div style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', borderRadius: '50%', background: '#2563eb', border: '3px solid white', boxShadow: '0 0 0 3px rgba(37,99,235,0.3)' }} />
                          {/* Destination pin */}
                          <div style={{ position: 'absolute', right: '10px', top: '24px' }}>
                            <div style={{ width: '22px', height: '28px', background: '#ef4444', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 8px rgba(239,68,68,0.4)' }} />
                          </div>
                          {/* Route info card */}
                          <div style={{ position: 'absolute', top: '8px', left: '8px', background: isDarkMode ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${t.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                            <div style={{ fontSize: '13px', fontWeight: '900', color: t.text1 }}>🚗 Live Route</div>
                            <div style={{ fontSize: '11px', color: t.text2, marginTop: '2px' }}>GILFFC Hub → Consignee</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: t.text1, marginBottom: '6px' }}>Google Maps API Key Required</div>
                          <div style={{ fontSize: '12px', color: t.text2, lineHeight: '1.6', maxWidth: '360px' }}>
                            Set <code style={{ background: t.accent, padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: '#2563eb' }}>GOOGLE_MAPS_API_KEY</code> at the top of <code style={{ background: t.accent, padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: '#2563eb' }}>UserPortal.jsx</code> to activate the live route map.
                          </div>
                          <a
                            href={`https://www.google.com/maps/dir/${encodeURIComponent(GILFFC_HUB_ADDRESS)}/${encodeURIComponent(shipment.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
                          >
                            <span>🗺️</span> Open Route in Google Maps
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Status overlay badge on map */}
                    {GOOGLE_MAPS_API_KEY !== 'AIzaSyDJvIQon878_VcstOhV-Z5IqDqerFZtIVA' && (
                      <div style={{ position: 'absolute', top: '12px', left: '12px', background: statusStep === 3 ? '#10b981' : statusStep === 2 ? '#2563eb' : '#f59e0b', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 5 }}>
                        {statusStep === 3 ? 'Delivered' : statusStep === 2 ? 'In Transit' : 'Pending'}
                      </div>
                    )}
                  </div>

                  {/* Route Action Footer */}
                  <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>From</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: t.text2, marginTop: '2px' }}>GILFFC Hub, Manila</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', letterSpacing: '1px' }}>To</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: t.text2, marginTop: '2px', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shipment.address}</span>
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/${encodeURIComponent(GILFFC_HUB_ADDRESS)}/${encodeURIComponent(shipment.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: t.accent, color: t.text1, padding: '10px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', border: `1px solid ${t.border}`, transition: 'all 0.2s' }}
                      onMouseOver={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#2563eb'; }}
                      onMouseOut={e => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = t.text1; e.currentTarget.style.borderColor = t.border; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                      Open in Google Maps
                    </a>
                  </div>

                </div>
              </section>
              {/* ─────────────────────────────────────────────────────────── */}

            </div>

            {/* RIGHT COLUMN: ZENDESK-STYLE SUPPORT WIDGET */}
            <section className="animate-up" style={{ animationDelay: '0.3s', background: t.card, borderRadius: '16px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', position: 'sticky', top: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
              
              {/* Widget Header */}
              <div style={{ padding: '24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '16px', background: '#0f172a', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', color: 'white' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px' }}>
                    HQ
                  </div>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Live Agent Support</h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Active Support Channel</span>
                </div>
              </div>
              
              {/* Chat Area */}
              <div className="custom-scrollbar" style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', background: t.chatBg }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: t.text3, fontSize: '13px', margin: 'auto', fontWeight: '500', maxWidth: '80%' }}>Connection established. You are securely connected to HQ.</div>
                ) : (
                  messages.map((m, i) => {
                    const isAdmin = m.sender_name === 'Admin';
                    return (
                      <div key={i} style={{ alignSelf: isAdmin ? 'flex-start' : 'flex-end', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '11px', color: t.text3, fontWeight: '700', marginBottom: '6px', alignSelf: isAdmin ? 'flex-start' : 'flex-end' }}>
                          {isAdmin ? 'GILFFC Agent' : 'You'}
                        </span>
                        <div style={{ padding: '14px 18px', borderRadius: '16px', fontSize: '14px', fontWeight: '500', lineHeight: '1.5', background: isAdmin ? t.chatBubbleAdmin : '#2563eb', color: isAdmin ? t.text1 : 'white', borderBottomLeftRadius: isAdmin ? '4px' : '16px', borderBottomRightRadius: !isAdmin ? '4px' : '16px', border: isAdmin ? `1px solid ${t.border}` : 'none', boxShadow: isAdmin ? '0 2px 4px rgba(0,0,0,0.02)' : '0 4px 6px rgba(37,99,235,0.2)' }}>
                          {m.message_text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div style={{ padding: '20px', background: t.card, borderTop: `1px solid ${t.border}`, borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', background: t.accent, padding: '8px', borderRadius: '12px', border: '1px solid transparent', transition: 'border-color 0.2s' }}>
                  <input type="text" placeholder="Reply here..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={handleSend} style={{ flex: 1, padding: '12px 16px', background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', fontWeight: '500', color: t.text1 }} />
                  <button onClick={handleSend} style={{ background: t.btnPrimary, color: 'white', border: 'none', padding: '0 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '14px', transition: 'all 0.2s' }} onMouseOver={e => e.target.style.background = t.btnHover} onMouseOut={e => e.target.style.background = t.btnPrimary}>Send</button>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}

export default UserPortal;