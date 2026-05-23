import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell, PieChart, Pie
} from 'recharts';
import './Dashboard.css'; 
import './Analytics.css';

function Analytics() {
  // --- SYSTEM STATE ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [timeRange, setTimeRange] = useState('7D');
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // UNIFIED DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');
  
  // DYNAMIC CURRENCY ENGINE STATE
  const [currency, setCurrency] = useState('USD');
  const [lastUpdate, setLastUpdate] = useState(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  });
  
  // Initialize with fallbacks, these will be overwritten by the Live API
  const [exchangeRates, setExchangeRates] = useState({ 
    USD: 1, PHP: 56.50, EUR: 0.92, JPY: 150.20, GBP: 0.79, 
    AUD: 1.53, CAD: 1.36, CHF: 0.88, CNY: 7.20, HKD: 7.82, NZD: 1.66 
  });
  
  // LIVE DB STATE
  const [trendData, setTrendData] = useState([]);
  const [stats, setStats] = useState({ pending: 0, outForDelivery: 0, delivered: 0 });

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Operative","role":"Operations Lead"}');

  // UNIFIED THEME ENGINE
  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('admin_theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('admin_theme') === 'dark';
    document.documentElement.classList.toggle('dark', saved);
  }, []);

  const t = {
    bg: isDarkMode ? '#020617' : '#f8fafc',
    card: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    text1: isDarkMode ? '#f8fafc' : '#0f172a', 
    text2: isDarkMode ? '#cbd5e1' : '#64748b', 
    text3: isDarkMode ? '#94a3b8' : '#94a3b8',
    headerBg: isDarkMode ? '#0f172a' : 'white',
    inputBg: isDarkMode ? '#1e293b' : '#f8fafc',
    hover: isDarkMode ? '#1e293b' : '#f1f5f9',
  };

  // --- SUPREME DEBUG DATA & LIVE CURRENCY ENGINE ---
  const fetchAnalyticsData = async () => {
    setIsSyncing(true);
    
    try {
      const [trendRes, statsRes, currencyRes] = await Promise.all([
        fetch('http://localhost:5000/api/analytics/trends'),
        fetch('http://localhost:5000/api/stats'),
        // FREE PUBLIC API FOR LIVE EXCHANGE RATES (No API Key Required)
        fetch('https://open.er-api.com/v6/latest/USD').catch(() => null)
      ]);
      
      if (!trendRes.ok) throw new Error(`Trend API failed with status ${trendRes.status}`);
      if (!statsRes.ok) throw new Error(`Stats API failed with status ${statsRes.status}`);

      const trend = await trendRes.json();
      const st = await statsRes.json();
      
      setTrendData(trend);
      setStats(st);

      // Parse Live Exchange Rates and Update Timestamp
      if (currencyRes && currencyRes.ok) {
        const currencyData = await currencyRes.json();
        if (currencyData && currencyData.rates) {
          setExchangeRates(prev => ({
            ...prev,
            ...currencyData.rates
          }));
          
          if (currencyData.time_last_update_unix) {
            const apiDate = new Date(currencyData.time_last_update_unix * 1000);
            setLastUpdate(apiDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
          }
          console.log("💱 Live Exchange Rates Synchronized.");
        }
      }

    } catch (e) {
      console.error("🚨 ANALYTICS CRASH DETAILS:", e.message);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setIsLoading(false);
      }, 800);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    const handleResize = () => {
      if (window.innerWidth <= 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- DYNAMIC DATA MAPPING & CURRENCY ENGINE ---
  const currencySymbols = { USD: '$', PHP: '₱', EUR: '€', JPY: '¥', GBP: '£', AUD: 'A$', CAD: 'C$', CHF: 'Fr', CNY: '¥', HKD: 'HK$', NZD: 'NZ$' };

  // 1. Live Volume Trend (Calculates Revenue based on actual DB shipments + selected currency)
  const volumeTrend = useMemo(() => {
    if (trendData.length > 0) {
      return trendData.map(t => ({
        name: t.date,
        shipments: t.count,
        revenue: (t.count * 125) * (exchangeRates[currency] || 1), // Dynamically scaled
        fuel: t.count * 18
      }));
    }
    // Fallback
    return [
      { name: 'Mon', shipments: 0, revenue: 0 }, { name: 'Tue', shipments: 0, revenue: 0 },
      { name: 'Wed', shipments: 0, revenue: 0 }, { name: 'Thu', shipments: 0, revenue: 0 },
      { name: 'Fri', shipments: 0, revenue: 0 }, { name: 'Sat', shipments: 0, revenue: 0 },
      { name: 'Sun', shipments: 0, revenue: 0 }
    ];
  }, [trendData, currency, exchangeRates]);

  // Calculate live totals for KPI cards
  const totalShipments = useMemo(() => trendData.reduce((acc, curr) => acc + curr.count, 0), [trendData]);
  const totalRevenue = totalShipments * 125 * (exchangeRates[currency] || 1); // Base $125 per shipment converted dynamically

  // 2. Live Pie Chart Data
  const statusPieData = useMemo(() => [
    { name: 'In Transit', value: stats.outForDelivery || 0 },
    { name: 'Pending', value: stats.pending || 0 },
    { name: 'Delivered', value: stats.delivered || 0 }
  ].filter(d => d.value > 0 || (stats.pending + stats.outForDelivery + stats.delivered === 0)), [stats]);

  // Static Regional Data
  const regionalData = [
    { region: 'N. America', domestic: 400, international: 240, color: '#2563eb' },
    { region: 'Europe', domestic: 300, international: 380, color: '#3b82f6' },
    { region: 'Asia Pacific', domestic: 550, international: 420, color: '#60a5fa' },
    { region: 'L. America', domestic: 120, international: 90, color: '#93c5fd' },
  ];

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444'];

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  // --- ENHANCED PDF GENERATION ENGINE ---
  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.text("GILFFC Logistics - In-Depth Analytics Report", 14, 22);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleString()} | Currency: ${currency}`, 14, 30);
      
      // Executive Summary
      doc.setFontSize(14);
      doc.text("Executive Summary", 14, 40);
      doc.setFontSize(11);
      doc.text("This report provides an in-depth analysis of logistics performance over the last 7 days.", 14, 48);
      
      // Trend Table Summary
      const summaryBody = [
        ["Total Shipments", totalShipments.toString()],
        ["Gross Revenue", `${currencySymbols[currency]}${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`],
        ["Status: Pending", stats.pending.toString()],
        ["Status: Delivered", stats.delivered.toString()],
        ["Status: In Transit", stats.outForDelivery.toString()]
      ];
      
      autoTable(doc, { 
        startY: 55, head: [['Metric', 'Value']], body: summaryBody, theme: 'striped' 
      });

      // Deep Dive Page
      doc.addPage();
      doc.setFontSize(16); doc.text("Operational Metrics & Efficiency", 14, 20);
      
      const metricsBody = [
        ['On-Time Ratio', '98.0%', '98.4%', '+0.4%'],
        ['Delivery Cost/km', '$1.20', '$1.14', '-$0.06'],
        ['Load Capacity', '85.0%', '81.2%', '-3.8%'],
        ['Carbon Credit', '1,200', '1,340', '+140']
      ];
      
      autoTable(doc, { 
        startY: 30,
        head: [['Metric', 'Target', 'Actual', 'Variance']], 
        body: metricsBody,
        theme: 'grid',
      });

      // Safely calculate the final Y position after the table to place the analysis text
      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 80;
      doc.setFontSize(10);
      doc.text("Analysis: Operations show steady growth from Mon-Wed, with significant surges towards weekend peak days.", 14, finalY + 15);
      
      doc.save(`GILFFC_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error("PDF Generation Failed: ", err);
      alert("Failed to generate the PDF report. Please check the developer console for details.");
    }
  };

  // --- CUSTOM TOOLTIP (Handles Currency Symbols dynamically) ---
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{ background: t.card, padding: '12px', borderRadius: '8px', border: `1px solid ${t.border}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <p className="tooltip-label" style={{ margin: 0, fontWeight: '800', color: t.text1, fontSize: '12px' }}>{`Timeline: ${label}`}</p>
          <div className="tooltip-divider" style={{ height: '1px', background: t.border, margin: '8px 0' }}></div>
          {payload.map((entry, index) => (
            <div key={index} className="tooltip-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="dot" style={{ backgroundColor: entry.color, width: '8px', height: '8px', borderRadius: '50%' }}></span>
              <span className="name" style={{ fontSize: '11px', color: t.text2, fontWeight: '600' }}>{entry.name}:</span>
              <span className="value" style={{ fontSize: '11px', color: t.text1, fontWeight: '800' }}>
                {entry.name === 'Revenue' ? currencySymbols[currency] : ''}
                {entry.value.toLocaleString(undefined, {
                  minimumFractionDigits: entry.name === 'Revenue' ? 2 : 0, 
                  maximumFractionDigits: entry.name === 'Revenue' ? 2 : 0
                })}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

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
          <span className="nav-label" style={{ color: t.text3 }}>Core Operations</span>
          <nav className="fw-nav">
            <button className="nav-btn" onClick={() => navigate('/dashboard')}>Command Center</button>
            <button className="nav-btn" onClick={() => navigate('/customer-service')}>Comms Terminal</button>
            <button className="nav-btn" onClick={() => navigate('/fleet-assets')}>Fleet Assets</button>
            <button className="nav-btn active" onClick={() => navigate('/analytics')}>Analytics</button>
            <button className="nav-btn" onClick={() => navigate('/account-management')}>Account Settings</button>
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
              <span className={`pulse-dot ${isSyncing ? 'syncing' : ''}`} style={{ background: isSyncing ? '#2563eb' : '#10b981' }}></span> 
              <span style={{ fontSize: '14px', fontWeight: '700', color: t.text2 }}>
                {isSyncing ? 'Synchronizing Intelligence...' : 'System Operational'}
              </span>
            </div>
          </div>
          
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            
            {/* PROFESSIONAL SVG THEME TOGGLE */}
            <button onClick={toggleTheme} className="theme-btn" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.text2, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
              {isDarkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            
            <button className="fw-icon-btn" style={{ color: t.text1 }}>⬦</button>
            <div style={{ position: 'relative' }}>
              <div className="fw-profile hover-pointer" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                <div className="profile-text">
                  <span className="name" style={{ fontSize: '14px', fontWeight: '800', color: t.text1 }}>{user.name || 'Alfrancis'}</span>
                  <span className="role" style={{ fontSize: '11px', fontWeight: '600', color: t.text2 }}>{user.role || 'Administrator'}</span>
                </div>
              </div>

              {isProfileMenuOpen && (
                <div className="profile-dropdown-menu" style={{ position: 'absolute', right: 0, top: '100%', marginTop: '12px', background: t.card, borderRadius: '12px', width: '220px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', border: `1px solid ${t.border}`, zIndex: 1000, padding: '8px' }}>
                  <div className="dropdown-header" style={{ padding: '12px' }}>
                    <strong style={{ display: 'block', fontSize: '14px', color: t.text1 }}>{user.name || 'Alfrancis'}</strong>
                    <span style={{ fontSize: '12px', color: t.text2 }}>{user.email || 'admin@gilffc.global'}</span>
                  </div>
                  <div className="dropdown-divider" style={{ height: '1px', background: t.border, margin: '8px 0' }}></div>
                  <button className="theme-btn" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: t.text1, cursor: 'pointer' }} onClick={() => navigate('/account-management')}>Account Settings</button>
                  <button className="theme-btn" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: t.text1, cursor: 'pointer' }} onClick={() => navigate('/account-management')}>Manage Team</button>
                  <div className="dropdown-divider" style={{ height: '1px', background: t.border, margin: '8px 0' }}></div>
                  <button className="theme-btn text-danger" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#ef4444', cursor: 'pointer' }} onClick={handleLogout}>Secure Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="fw-content-wrapper" style={{ padding: '40px' }}>
          <div className="fw-page-header animate-up">
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: '900', color: t.text1 }}>System Analytics</h1>
              <p style={{ fontSize: '16px', color: t.text2 }}>Global shipping trends, revenue distribution, and operational efficiency telemetry.</p>
            </div>
            <div className="header-actions" style={{ display: 'flex', gap: '16px' }}>
              <div className="fw-search-group" style={{ display: 'flex', gap: '12px' }}>
                <select className="fw-filter-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${t.border}`, background: t.inputBg, color: t.text1, fontWeight: '600' }}>
                  <option value="7D">Last 7 Days</option>
                  <option value="30D">Last 30 Days</option>
                  <option value="YTD">Year to Date</option>
                </select>
                <button 
                  className="fw-btn-primary" 
                  onClick={fetchAnalyticsData} 
                  disabled={isSyncing}
                  style={{ background: isSyncing ? t.text3 : '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: isSyncing ? 'not-allowed' : 'pointer', transition: 'all 0.3s' }}
                >
                  {isSyncing ? 'Syncing...' : 'Sync Live Data'}
                </button>
                <button 
                  className="fw-btn-outline" 
                  onClick={exportToPDF}
                  style={{ background: 'transparent', color: t.text1, padding: '10px 20px', borderRadius: '8px', fontWeight: '700', border: `1px solid ${t.border}`, cursor: 'pointer', transition: 'all 0.3s' }}
                >
                  Export PDF Report
                </button>
              </div>
            </div>
          </div>

          <div className="fw-kpi-grid animate-up" style={{ animationDelay: '0.1s', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
            <div className="fw-kpi-card" style={{ background: t.card, padding: '24px', borderRadius: '16px', border: `1px solid ${t.border}` }}>
              <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span className="kpi-title" style={{ fontSize: '12px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Total Volume (7D)</span><span className="kpi-icon text-blue" style={{ color: '#2563eb' }}>▤</span></div>
              <div className="kpi-value" style={{ fontSize: '28px', fontWeight: '900', color: t.text1 }}>{totalShipments}</div>
              <div className="kpi-trend" style={{ fontSize: '12px', marginTop: '8px', color: t.text2 }}><span className="trend-up" style={{ color: '#10b981', fontWeight: '700' }}>Live DB Sync</span> active</div>
            </div>

            <div className="fw-kpi-card" style={{ background: t.card, padding: '24px', borderRadius: '16px', border: `1px solid ${t.border}` }}>
              <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="kpi-title" style={{ fontSize: '12px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Gross Operational Revenue</span>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)} 
                  style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', background: isDarkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff', border: `1px solid ${isDarkMode ? 'rgba(37,99,235,0.3)' : '#bfdbfe'}`, borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="PHP">PHP (₱)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="CAD">CAD (C$)</option>
                  <option value="CHF">CHF (Fr)</option>
                  <option value="CNY">CNY (¥)</option>
                  <option value="HKD">HKD (HK$)</option>
                  <option value="NZD">NZD (NZ$)</option>
                </select>
              </div>
              <div className="kpi-value" style={{ fontSize: '28px', fontWeight: '900', color: t.text1 }}>
                {currencySymbols[currency]}{totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              
              <div className="kpi-trend" style={{ fontSize: '12px', marginTop: '12px', color: t.text2, lineHeight: '1.5' }}>
                <span style={{ color: '#10b981', fontWeight: '700' }}>Live Rate:</span> 1 USD = {currencySymbols[currency]}{(exchangeRates[currency] || 1).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {currency}
                <br />
                <span style={{ fontSize: '10px', color: t.text3, fontWeight: '600' }}>Effective as of {lastUpdate}</span>
              </div>
            </div>

            <div className="fw-kpi-card" style={{ background: t.card, padding: '24px', borderRadius: '16px', border: `1px solid ${t.border}` }}>
              <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><span className="kpi-title" style={{ fontSize: '12px', fontWeight: '800', color: t.text2, textTransform: 'uppercase' }}>Network Completion</span><span className="kpi-icon text-amber" style={{ color: '#f59e0b' }}>⬱</span></div>
              <div className="kpi-value" style={{ fontSize: '28px', fontWeight: '900', color: t.text1 }}>{stats.delivered} Done</div>
              <div className="kpi-trend" style={{ fontSize: '12px', marginTop: '8px', color: t.text2 }}><span className="trend-neutral" style={{ color: t.text2, fontWeight: '700' }}>Out of {stats.delivered + stats.pending + stats.outForDelivery}</span> total entries</div>
            </div>
          </div>

          <div className="analytics-grid animate-up" style={{ animationDelay: '0.2s', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px' }}>
            <div className="fw-data-panel" style={{ gridColumn: 'span 2', background: t.card, padding: '32px', borderRadius: '20px', border: `1px solid ${t.border}` }}>
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: t.text1 }}>Freight Volume & Revenue Trend</h3>
                <div className="legend-pills" style={{ display: 'flex', gap: '16px' }}>
                  <span className="pill" style={{ fontSize: '12px', fontWeight: '700', color: t.text2, display: 'flex', alignItems: 'center', gap: '6px' }}><span className="dot bg-blue" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }}></span> Shipments</span>
                  <span className="pill" style={{ fontSize: '12px', fontWeight: '700', color: t.text2, display: 'flex', alignItems: 'center', gap: '6px' }}><span className="dot bg-emerald" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span> Revenue ({currency})</span>
                </div>
              </div>
              <div className="chart-container" style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeTrend}>
                    <defs>
                      <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorEmerald" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: '700'}} dy={10} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: '700'}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="left" name="Shipments" type="monotone" dataKey="shipments" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorBlue)" />
                    <Area yAxisId="left" name="Revenue" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorEmerald)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="fw-data-panel" style={{ background: t.card, padding: '32px', borderRadius: '20px', border: `1px solid ${t.border}` }}>
              <div className="panel-header" style={{ marginBottom: '24px' }}><h3 style={{ fontSize: '18px', fontWeight: '800', color: t.text1 }}>Operational Distribution</h3></div>
              <div className="chart-container" style={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="value" stroke="none">
                      {statusPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ outline: 'none' }} />))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontWeight: '700', fontSize: '11px', color: t.text2 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="fw-data-panel" style={{ gridColumn: 'span 2', background: t.card, padding: '32px', borderRadius: '20px', border: `1px solid ${t.border}` }}>
              <div className="panel-header" style={{ marginBottom: '24px' }}><h3 style={{ fontSize: '18px', fontWeight: '800', color: t.text1 }}>Priority Load Analysis</h3></div>
              <div className="table-scroll" style={{maxHeight: '300px'}}>
                <table className="fw-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr><th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', textAlign: 'left' }}>Metric</th><th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', textAlign: 'left' }}>Target</th><th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', textAlign: 'left' }}>Actual</th><th style={{ padding: '16px', fontSize: '11px', fontWeight: '800', color: t.text3, textTransform: 'uppercase', textAlign: 'left' }}>Variance</th></tr>
                  </thead>
                  <tbody>
                    <tr><td style={{ padding: '16px', fontSize: '13px', fontWeight: '700', color: t.text1 }}>On-Time Ratio</td><td style={{ padding: '16px', fontSize: '13px', color: t.text2 }}>98.0%</td><td style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: t.text1 }}>98.4%</td><td className="text-emerald" style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: '#10b981' }}>+0.4%</td></tr>
                    <tr><td style={{ padding: '16px', fontSize: '13px', fontWeight: '700', color: t.text1 }}>Delivery Cost/km</td><td style={{ padding: '16px', fontSize: '13px', color: t.text2 }}>$1.20</td><td style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: t.text1 }}>$1.14</td><td className="text-emerald" style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: '#10b981' }}>-$0.06</td></tr>
                    <tr><td style={{ padding: '16px', fontSize: '13px', fontWeight: '700', color: t.text1 }}>Load Capacity</td><td style={{ padding: '16px', fontSize: '13px', color: t.text2 }}>85.0%</td><td style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: t.text1 }}>81.2%</td><td className="text-danger" style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: '#ef4444' }}>-3.8%</td></tr>
                    <tr><td style={{ padding: '16px', fontSize: '13px', fontWeight: '700', color: t.text1, borderBottom: 'none' }}>Carbon Credit</td><td style={{ padding: '16px', fontSize: '13px', color: t.text2, borderBottom: 'none' }}>1,200</td><td style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: t.text1, borderBottom: 'none' }}>1,340</td><td className="text-emerald" style={{ padding: '16px', fontSize: '13px', fontWeight: '800', color: '#10b981', borderBottom: 'none' }}>+140</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Analytics;