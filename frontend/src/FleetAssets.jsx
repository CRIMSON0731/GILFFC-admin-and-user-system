import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import './FleetAssets.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const HUB_COORDS = [14.5866, 120.9630];

const ROUTE_COLORS = [
  '#2563eb', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'
];

// ─── Digital Twin Anticipation Engine (Synced with Dashboard V3.0) ────────────
const runDigitalTwinMultiplier = (address, itemDescription) => {
  let multipliers = { weather: 1.0, traffic: 1.0, event: 1.0, port: 1.0 };
  const adr = (address || '').toLowerCase();
  const items = (itemDescription || '').toLowerCase();

  // 1. Hyper-Local Weather (Flood Buffer)
  if (adr.includes('espana') || adr.includes('taft') || adr.includes('marikina')) {
    multipliers.weather = 1.35;
  }

  // 2. Real-Time Traffic Layers
  const currentHour = new Date().getHours();
  if ((currentHour >= 7 && currentHour <= 10) || (currentHour >= 16 && currentHour <= 20)) {
    multipliers.traffic = 1.5;
  } else if (adr.includes('edsa') || adr.includes('c-5') || adr.includes('bgc')) {
    multipliers.traffic = 1.25;
  }

  // 3. Public Event & Holiday Calendars (Payday Surges)
  const currentDay = new Date().getDate();
  if (currentDay === 15 || currentDay === 30 || currentDay === 31) {
    multipliers.event = 1.2;
  }

  // 4. Port & Custom Status (Dwell Time)
  if (items.includes('container') || items.includes('bulk') || adr.includes('port') || adr.includes('pier')) {
    multipliers.port = 1.4;
  }

  return multipliers.weather * multipliers.traffic * multipliers.event * multipliers.port;
};

// Deterministic Coordinate Generator
const getDestinationCoords = (delivery) => {
  if (delivery.latitude && delivery.longitude) {
    return [parseFloat(delivery.latitude), parseFloat(delivery.longitude)];
  }

  const adr = delivery.address?.toLowerCase() || '';
  if (adr.includes('quezon')) return [14.6760, 121.0437];
  if (adr.includes('makati')) return [14.5547, 121.0244];
  if (adr.includes('taguig') || adr.includes('bgc')) return [14.5176, 121.0509];
  if (adr.includes('pasig')) return [14.5764, 121.0851];
  if (adr.includes('marikina')) return [14.6507, 121.1029];
  if (adr.includes('mandaluyong')) return [14.5794, 121.0359];
  if (adr.includes('las pinas')) return [14.4453, 120.9834];
  if (adr.includes('paranaque')) return [14.4793, 121.0198];
  
  const id = delivery.delivery_id || 1;
  const pseudoRandomLat = (id * 0.01) % 0.12 - 0.06;
  const pseudoRandomLng = (id * 0.02) % 0.12 - 0.06;

  return [
    14.5866 + pseudoRandomLat,
    120.9630 + pseudoRandomLng,
  ];
};

function FleetAssets() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [vehicles, setVehicles] = useState([]);
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(null);
  const [toast, setToast] = useState(null);

  // ✅ UNIFIED DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('admin_theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  };

  const t = {
    bg: isDarkMode ? '#020617' : '#f8fafc',
    card: isDarkMode ? '#0f172a' : 'white',
    border: isDarkMode ? '#1e293b' : '#e2e8f0',
    text1: isDarkMode ? '#f8fafc' : '#0f172a',
    text2: isDarkMode ? '#cbd5e1' : '#64748b',
    headerBg: isDarkMode ? '#0f172a' : 'white',
    inputBg: isDarkMode ? '#1e293b' : '#f8fafc',
    hover: isDarkMode ? '#1e293b' : '#f1f5f9',
    toastError: '#ef4444',
    toastSuccess: '#10b981'
  };

  // LIVE SYSTEM CLOCK STATE
  const [currentTime, setCurrentTime] = useState(new Date());

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // REAL-TIME CLOCK ENGINE
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // PERSISTENCE ENGINE
  useEffect(() => {
    if (activeDeliveries.length > 0) {
      const progressMap = {};
      activeDeliveries.forEach(d => {
        if (d.dispatchTime && d.totalEstimatedTime && !isNaN(d.totalEstimatedTime)) {
          progressMap[d.delivery_id] = {
            dispatchTime: d.dispatchTime,
            lockedTotalTime: d.totalEstimatedTime
          };
        }
      });
      if (Object.keys(progressMap).length > 0) {
        localStorage.setItem('fleet_realtime_v2', JSON.stringify(progressMap));
      }
    }
  }, [activeDeliveries]);

  const fetchRoute = useCallback(async (delivery, colorIdx) => {
    const dest = getDestinationCoords(delivery);
    const trafficMultiplier = runDigitalTwinMultiplier(delivery.address, delivery.item_name);
    
    // Retrieve true timeline
    const savedProgress = JSON.parse(localStorage.getItem('fleet_realtime_v2') || '{}');
    const state = savedProgress[delivery.delivery_id];
    const now = Date.now();
    
    // Failsafe checks
    const dispatchTime = (state && state.dispatchTime) ? state.dispatchTime : now;

    const url = `https://router.project-osrm.org/route/v1/driving/${HUB_COORDS[1]},${HUB_COORDS[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;
    
    try {
      const r = await fetch(url);
      const data = await r.json();
      
      if (data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        const rawMinutes = Math.ceil(data.routes[0].duration / 60);
        
        // Apply Digital Twin Multiplier + Pessimistic P90 Padding (20%)
        const rawEta = Math.max(15, Math.ceil(rawMinutes * trafficMultiplier));
        const calcTime = Math.ceil(rawEta * 1.20);
        
        const totalAdjustedTime = (state && state.lockedTotalTime) ? state.lockedTotalTime : calcTime;
        
        // Calculate true elapsed time based on system clock
        const elapsedMins = Math.max(0, (now - dispatchTime) / 60000);
        const remainingMins = Math.max(0, Math.ceil(totalAdjustedTime - elapsedMins));
        const progressPct = Math.min(1, elapsedMins / totalAdjustedTime);
        const startStep = Math.floor(progressPct * (coords.length - 1));

        return {
          ...delivery,
          routePath: coords,
          currentStep: startStep, 
          dispatchTime: dispatchTime,
          isMoving: true,
          color: ROUTE_COLORS[colorIdx % ROUTE_COLORS.length],
          trafficFactor: trafficMultiplier,
          baseEta: rawMinutes,
          etaMins: remainingMins,
          totalEstimatedTime: totalAdjustedTime,
          arrived: remainingMins <= 0,
          isCompleting: false
        };
      }
    } catch (_) {}
    
    return {
      ...delivery,
      routePath: [HUB_COORDS, dest],
      currentStep: 0,
      dispatchTime: Date.now(),
      isMoving: true,
      color: ROUTE_COLORS[colorIdx % ROUTE_COLORS.length],
      etaMins: 45,
      totalEstimatedTime: 45,
      arrived: false,
      isCompleting: false
    };
  }, []);

  const loadSystemData = useCallback(async () => {
    try {
      const [fleetRes, delRes] = await Promise.all([
        fetch('http://localhost:5000/api/fleet'),
        fetch('http://localhost:5000/api/deliveries'),
      ]);
      const fleetData = await fleetRes.json();
      const delData = await delRes.json();

      setVehicles(Array.isArray(fleetData) ? fleetData : []);
      const active = (Array.isArray(delData) ? delData : []).filter(
        d => d.status === 'Out for Delivery'
      );

      setActiveDeliveries(prev => {
        const prevIds = new Set(prev.map(d => d.delivery_id));
        const newOnes = active.filter(d => !prevIds.has(d.delivery_id));

        if (newOnes.length > 0) {
          Promise.all(newOnes.map((d, i) => fetchRoute(d, prev.length + i))).then(routed => {
            setActiveDeliveries(cur => {
              const curIds = new Set(cur.map(d => d.delivery_id));
              return [
                ...cur,
                ...routed.filter(r => !curIds.has(r.delivery_id))
              ];
            });
          });
        }
        return prev;
      });
    } catch (e) {
      console.error('Telemetry link offline.', e);
    }
  }, [fetchRoute]);

  useEffect(() => {
    loadSystemData();
    const handleResize = () => setIsSidebarOpen(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [loadSystemData]);

  // REAL-TIME SYNCHRONIZED PROGRESS UPDATER
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveDeliveries(prev =>
        prev.map(del => {
          if (!del.routePath?.length || !del.dispatchTime || !del.totalEstimatedTime) return del;
          
          const elapsedMins = (now - del.dispatchTime) / 60000;
          
          // 100% REACHED FLAG
          if (elapsedMins >= del.totalEstimatedTime) {
            return { 
              ...del, 
              currentStep: del.routePath.length - 1, 
              etaMins: 0, 
              isMoving: false,
              arrived: true
            };
          }

          let moving = del.isMoving;
          if (!moving) moving = Math.random() > 0.3; 
          else moving = Math.random() > 0.05; 
          
          const currentEta = Math.max(1, Math.ceil(del.totalEstimatedTime - elapsedMins));
          const progressPct = Math.max(0, Math.min(1, elapsedMins / del.totalEstimatedTime));
          const currentStep = Math.floor(progressPct * (del.routePath.length - 1));
          
          return {
            ...del,
            currentStep,
            etaMins: currentEta,
            isMoving: moving,
            arrived: false
          };
        })
      );
    }, 1000); 
    
    return () => clearInterval(interval);
  }, []);

  // AUTO-RESOLVE ENGINE FOR 100% DELIVERIES
  useEffect(() => {
    const completedDeliveries = activeDeliveries.filter(d => d.arrived && !d.isCompleting);

    if (completedDeliveries.length > 0) {
      completedDeliveries.forEach(del => {
        // Mark as completing to prevent firing multiple API calls
        setActiveDeliveries(prev => prev.map(p => p.delivery_id === del.delivery_id ? { ...p, isCompleting: true } : p));

        // Wait 3 seconds so the admin sees the "ARRIVED" status visually
        setTimeout(async () => {
          try {
            // Update Delivery Table to Done
            await fetch(`http://localhost:5000/api/deliveries/${del.delivery_id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'Done' })
            });

            // Auto-Resolve the Fleet Vehicle
            const vehicle = vehicles.find(v => 
              v.delivery_id === del.delivery_id || 
              (v.driver_name || v.driver || "").trim().toLowerCase() === (del.driver_name || "").trim().toLowerCase()
            );

            if (vehicle) {
              const vId = vehicle.vehicle_id || vehicle.id;
              await fetch(`http://localhost:5000/api/fleet/${vId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Available', delivery_id: null })
              });
            }

            showToast(`Cargo AWB-${String(del.delivery_id).padStart(6, '0')} Delivered! Fleet Unit returned to hub.`);
            
            // Reload data to clear the row from the screen
            loadSystemData();

          } catch (e) {
            console.error("Auto-resolve failed", e);
          }
        }, 3000);
      });
    }
  }, [activeDeliveries, vehicles, loadSystemData]);

  // MANUAL GHOST TRUCK RECALL SYSTEM
  const handleRecallVehicle = async (vehicleId) => {
    try {
      await fetch(`http://localhost:5000/api/fleet/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Available', delivery_id: null })
      });
      
      // Update local state instantly
      setVehicles(prev => prev.map(v => 
        (v.vehicle_id || v.id) === vehicleId ? { ...v, status: 'Available', delivery_id: null } : v
      ));
      
      showToast(`Fleet unit VHL-${String(vehicleId).padStart(4, '0')} recalled to Hub.`);
    } catch (e) {
      showToast("Recall failed. Network error.", "error");
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    setDeleteLoading(vehicleId);
    try {
      const response = await fetch(`http://localhost:5000/api/fleet/${vehicleId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setVehicles(prev => prev.filter(v => (v.vehicle_id || v.id) !== vehicleId));
        showToast(`Fleet unit VHL-${String(vehicleId).padStart(4, '0')} removed.`);
      }
    } catch (error) {
      showToast("Network Error", "error");
    } finally {
      setDeleteConfirm(null);
      setDeleteLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('fleet_realtime_v2'); 
    navigate('/');
  };

  // Only show active vehicles on this board
  const activeVehicles = vehicles.filter(
    v => ['In Transit', 'Out for Delivery', 'En Route'].includes(v.status)
  );

  // --- Unified Dispatch Roster ------------------------------------------------
  const dispatchRoster = [];
  const matchedDeliveryIds = new Set();

  activeVehicles.forEach(asset => {
    const fleetDriver = (asset.driver_name || asset.driver || "").trim().toLowerCase();
    const tracked = activeDeliveries.find(d => {
      const deliveryDriver = (d.driver_name || "").trim().toLowerCase();
      return (deliveryDriver === fleetDriver && fleetDriver !== "") || 
             (d.delivery_id === asset.delivery_id);
    });

    if (tracked) {
      matchedDeliveryIds.add(tracked.delivery_id);
    }

    dispatchRoster.push({ asset, tracked });
  });

  // Append Orphaned / Ghost Units
  activeDeliveries.forEach(del => {
    if (!matchedDeliveryIds.has(del.delivery_id)) {
      dispatchRoster.push({ asset: null, tracked: del });
    }
  });

  return (
    <div
      className={`fw-layout ${!isSidebarOpen ? 'sidebar-closed' : ''}`}
      style={{ background: t.bg, color: t.text1, transition: 'all 0.3s ease' }}
    >
      {/* ✅ UNIFIED MASTER CSS — SYNCED WITH DASHBOARD */}
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
        .fw-page-header h1 { color: ${t.text1} !important; }
        .fw-page-header p { color: ${t.text2} !important; }

        .fw-kpi-card, .fw-data-panel, .settings-card, .settings-sidebar { background: ${t.card} !important; border: 1px solid ${t.border} !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .kpi-value, .panel-title-group h3, .card-header h3 { color: ${t.text1} !important; }
        .fw-table th { background: ${isDarkMode ? '#020617' : '#f8fafc'} !important; color: ${t.text2} !important; border-bottom: 1px solid ${t.border} !important; }
        .fw-table td { border-bottom: 1px solid ${t.border} !important; color: ${t.text1}; }
        .table-row-hover:hover td { background: ${isDarkMode ? '#1e293b' : '#f8fafc'} !important; }

        .profile-dropdown-menu { background: ${t.card} !important; border: 1px solid ${t.border} !important; }
        .dropdown-header { color: ${t.text1} !important; }
        .dropdown-divider { background: ${t.border} !important; }
        .profile-dropdown-menu button { color: ${t.text1} !important; }
        .profile-dropdown-menu button.text-danger { color: #ef4444 !important; }
        .profile-dropdown-menu button:hover, .theme-btn:hover { background: ${t.hover} !important; }
      `}</style>
      
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            background: toast.type === 'error' ? t.toastError : t.toastSuccess,
            color: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
          }}
        >
          {toast.type === 'error' ? '✕ ' : '✓ '}
          {toast.msg}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: '16px',
              padding: '40px',
              maxWidth: '450px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <h3 style={{ color: t.text1, margin: '0 0 12px', fontSize: '20px', fontWeight: '800' }}>Remove Fleet Unit?</h3>
            <p style={{ color: t.text2, fontSize: '16px', lineHeight: '1.6', margin: '0 0 32px' }}>
              Confirm removal of transport asset <strong style={{ color: t.text1 }}>VHL-{String(deleteConfirm).padStart(4, '0')}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  background: t.hover,
                  border: `1px solid ${t.border}`,
                  color: t.text2,
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '700'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteVehicle(deleteConfirm)}
                disabled={deleteLoading !== null}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  background: '#ef4444',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '700'
                }}
              >
                {deleteLoading ? 'Processing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="fw-sidebar">
        <div className="fw-brand">
          <div className="brand-logo-container">
            <img src="/gilffc-logo-globe.png" alt="GILFFC" />
          </div>
          <div className="brand-titles">
            <h2>GILFFC</h2>
            <span>Logistics OS</span>
          </div>
        </div>

        <div className="fw-nav-section">
          <span className="nav-label" style={{ fontSize: '11px' }}>Core Operations</span>
          <nav className="fw-nav">
            <button className="nav-btn" onClick={() => navigate('/dashboard')}>
              <span className="icon">◈</span> Command Center
            </button>
            <button className="nav-btn" onClick={() => navigate('/customer-service')}>
              <span className="icon">⌗</span> Comms Terminal
            </button>
            <button className="nav-btn active" onClick={() => navigate('/fleet-assets')}>
              <span className="icon">▤</span> Fleet Assets
            </button>
            <button className="nav-btn" onClick={() => navigate('/analytics')}>
              <span className="icon">◓</span> Analytics
            </button>
            <button className="nav-btn" onClick={() => navigate('/account-management')}>
              <span className="icon">⌖</span> Account Settings
            </button>
          </nav>
        </div>

        <div className="fw-sidebar-bottom">
          <button className="nav-btn text-danger" onClick={handleLogout}>
            <span className="icon">⇁</span> Secure Logout
          </button>
        </div>
      </aside>

      <main className="fw-main">
        <header className="fw-topbar">
          <div className="topbar-left">
            <button className="fw-icon-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
            <div className="fw-status-indicator ml-4" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="pulse-dot"></span>
              <span style={{ fontSize: '14px', fontWeight: '600', color: t.text2 }}>
                System Time • {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
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
            <button className="fw-icon-btn" style={{ color: t.text1 }}>◈</button>
            <div style={{ position: 'relative' }}>
              <div className="fw-profile hover-pointer" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                <div className="profile-text">
                  <span className="name" style={{ color: t.text1 }}>{user.name || 'Alfrancis'}</span>
                  <span className="role" style={{ color: t.text2 }}>{user.role || 'Operations Lead'}</span>
                </div>
                <img 
                  src={localStorage.getItem('user_avatar') || '/avatar-placeholder.png'} 
                  alt="Profile" 
                  style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', background: '#e2e8f0' }} 
                  onError={(e) => { e.target.onerror = null; e.target.src = '/avatar-placeholder.png'; }} 
                />
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
              <h1 style={{ fontSize: '32px', fontWeight: '900', color: t.text1 }}>Active Fleet Telemetry</h1>
              <p style={{ fontSize: '16px', color: t.text2 }}>Self-Healing Auto-Resolution Engine Online.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '20px' }}>
              <div className="fw-kpi-card" style={{ background: t.card, textAlign: 'center', padding: '16px 32px', border: `1px solid ${t.border}`, borderRadius: '12px' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#2563eb' }}>{activeDeliveries.length}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: t.text2, textTransform: 'uppercase' }}>In Transit</div>
              </div>
              <div className="fw-kpi-card" style={{ background: t.card, textAlign: 'center', padding: '16px 32px', border: `1px solid ${t.border}`, borderRadius: '12px' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>{activeVehicles.length}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Active Units</div>
              </div>
            </div>
          </div>

          <div className="fw-data-panel animate-up" style={{ background: t.card, borderRadius: '16px', border: `1px solid ${t.border}` }}>
            <div className="panel-header" style={{ padding: '24px 32px', borderBottom: `1px solid ${t.border}` }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Real-Time Dispatch Roster</h3>
            </div>

            <div className="table-scroll">
              <table className="fw-table">
                <thead>
                  <tr>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Fleet ID</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Assigned Driver</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Vehicle Class</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Status</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', textAlign: 'center', color: t.text2 }}>Total Estimated Time</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', textAlign: 'right', color: t.text2 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchRoster.length > 0 ? (
                    dispatchRoster.map(({ asset, tracked }) => {
                      const rowKey = asset ? (asset.vehicle_id || asset.id) : `ghost-del-${tracked.delivery_id}`;
                      const vehicleIdDisplay = asset ? `VHL-${String(asset.vehicle_id || asset.id).padStart(4, '0')}` : '⚠ UNLINKED';
                      const driverDisplay = asset ? (asset.driver_name || asset.driver) : (tracked.driver_name || 'Unassigned');
                      const classDisplay = asset ? (asset.vehicle_type || asset.vehicle) : 'Ghost Unit';
                      const statusDisplay = asset ? asset.status : 'System Tracking';

                      return (
                        <tr key={rowKey} className="table-row-hover">
                          <td style={{ padding: '20px 32px', fontSize: '15px', fontWeight: '700', color: asset ? '#2563eb' : '#f59e0b', fontFamily: 'monospace' }}>
                            {vehicleIdDisplay}
                          </td>
                          <td style={{ padding: '20px 32px', fontSize: '15px', fontWeight: '600' }}>
                            {driverDisplay}
                          </td>
                          <td style={{ padding: '20px 32px', fontSize: '15px', color: '#64748b' }}>
                            {classDisplay}
                          </td>
                          <td style={{ padding: '20px 32px' }}>
                            <span 
                              className="fw-badge" 
                              style={{ 
                                fontSize: '12px',
                                background: tracked?.arrived ? '#dcfce7' : (asset ? '#eff6ff' : '#fef3c7'), 
                                color: tracked?.arrived ? '#16a34a' : (asset ? '#2563eb' : '#d97706'),
                                border: `1px solid ${tracked?.arrived ? '#bbf7d0' : (asset ? '#dbeafe' : '#fde68a')}`,
                                padding: '4px 8px',
                                borderRadius: '4px'
                              }}
                            >
                              {tracked?.arrived ? 'Unloading' : statusDisplay}
                            </span>
                          </td>
                          <td style={{ padding: '20px 32px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {tracked ? (
                                  <>
                                    <span style={{ fontSize: '16px', fontWeight: '800', color: tracked.arrived ? '#10b981' : t.text1 }}>
                                      {tracked.arrived ? 'ARRIVED' : `${tracked.etaMins} mins`}
                                    </span>
                                    {/* ✅ GRANULAR TRAFFIC WARNINGS SYNCED WITH DIGITAL TWIN MULTIPLIER */}
                                    <span style={{ fontSize: '10px', fontWeight: '700', color: tracked.arrived ? '#10b981' : (tracked.trafficFactor >= 1.8 ? '#ef4444' : (tracked.trafficFactor >= 1.3 ? '#f59e0b' : '#64748b')) }}>
                                      {tracked.arrived ? 'DOCKING SEQUENCE' : (tracked.trafficFactor >= 1.8 ? '⚠ SEVERE DELAYS' : (tracked.trafficFactor >= 1.3 ? '⚠ ROUTE CONGESTION' : '◈ NOMINAL ROUTE'))}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '700' }}>⚠ Ghost Link</span>
                                )}
                            </div>
                          </td>
                          <td className="text-right" style={{ padding: '20px 32px', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            {!tracked && asset && (
                              <button 
                                onClick={() => handleRecallVehicle(asset.vehicle_id || asset.id)}
                                style={{
                                  background: '#fef3c7',
                                  color: '#d97706',
                                  border: '1px solid #fde68a',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                              >
                                RECALL
                              </button>
                            )}
                            {asset && (
                              <button 
                                className="fw-btn-icon" 
                                style={{ color: '#ef4444', fontSize: '18px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                onClick={() => setDeleteConfirm(asset.vehicle_id || asset.id)}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty-table" style={{ padding: '60px', fontSize: '16px', color: t.text2, textAlign: 'center' }}>
                        No transport assets currently deployed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {activeDeliveries.length > 0 && (
              <div style={{ padding: '32px', background: t.bg, borderTop: `1px solid ${t.border}`, borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '800', color: t.text2, textTransform: 'uppercase', marginBottom: '20px' }}>
                  Live Route Telemetry
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                  {activeDeliveries.map(del => {
                    const elapsedMins = Math.max(0, (currentTime.getTime() - del.dispatchTime) / 60000);
                    const validTotalTime = del.totalEstimatedTime || 45;
                    const pct = Math.min(100, Math.floor((elapsedMins / validTotalTime) * 100));
                    
                    return (
                      <div key={del.delivery_id} style={{ background: t.card, borderRadius: '12px', padding: '20px', border: `1px solid ${del.arrived ? '#10b981' : t.border}`, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', transition: 'border-color 0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '800', color: t.text1 }}>AWB-{String(del.delivery_id).padStart(6, '0')}</span>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: del.arrived ? '#10b981' : (del.isMoving ? '#2563eb' : '#f59e0b') }}>
                            {del.arrived ? '✓ ARRIVED' : `${del.etaMins} mins left`}
                          </span>
                        </div>
                        <div style={{ height: '8px', background: isDarkMode ? '#1e293b' : '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: del.arrived ? '#10b981' : del.color, transition: 'width 1s linear, background 0.5s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{del.arrived ? 'Unloading Cargo' : 'Terminal Progress'}</span>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: del.arrived ? '#10b981' : t.text1 }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default FleetAssets;