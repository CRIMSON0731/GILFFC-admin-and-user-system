import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function UserPortal() {
  const [shipment, setShipment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [liveEta, setLiveEta] = useState('--');
  const [etaDate, setEtaDate] = useState('--');
  
  // Dark Mode State (Persists in localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');
  
  const [prevMsgCount, setPrevMsgCount] = useState(0);
  const chatEndRef = useRef(null);
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

  // THEME ENGINE: Dynamically maps colors based on toggle state
  const t = {
    bg: isDarkMode ? '#020617' : '#f4f7f9',
    card: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    text1: isDarkMode ? '#f8fafc' : '#0f172a', // Primary Text
    text2: isDarkMode ? '#cbd5e1' : '#64748b', // Secondary Text
    text3: isDarkMode ? '#94a3b8' : '#94a3b8', // Muted Text
    header: isDarkMode ? '#020617' : '#0f172a',
    accent: isDarkMode ? '#1e293b' : '#f1f5f9', // Light gray/dark slate background
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
      setShipment(sData);
      setMessages(mData);

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (sData.status === 'Done') {
        setLiveEta('Delivered Successfully');
        setEtaDate(today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
      } else if (sData.status === 'Pending') {
        setLiveEta('Pending Hub Dispatch');
        setEtaDate('Calculating...');
      } else {
        setLiveEta('By 8:00 PM Local Time');
        setEtaDate(tomorrow.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
      }
    } catch (e) {
      console.error("Link unstable");
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 1000);
    return () => clearInterval(timer);
  }, []);

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
      
      <style>{`
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
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1.2fr 400px', gap: '40px', alignItems: 'start' }}>
          
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
                
                <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.1)', padding: '20px 24px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {statusStep === 3 ? 'Delivered On' : 'Delivery Commitment'}
                  </span>
                  <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981', margin: '4px 0' }}>
                    {etaDate}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc' }}>
                    {liveEta}
                  </div>
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
          </div>

          {/* RIGHT COLUMN: ZENDESK-STYLE SUPPORT WIDGET */}
          <section className="animate-up" style={{ animationDelay: '0.3s', background: t.card, borderRadius: '16px', border: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', position: 'sticky', top: '0', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            
            {/* Widget Header */}
            <div style={{ padding: '24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '16px', background: '#0f172a', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', color: 'white' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '18px' }}>
                  HQ
                </div>
                <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '14px', height: '14px', background: '#10b981', borderRadius: '50%', border: '3px solid #0f172a' }}></div>
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
      </main>
    </div>
  );
}

export default UserPortal;