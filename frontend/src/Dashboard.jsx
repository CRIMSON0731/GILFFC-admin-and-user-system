import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Dashboard.css';

function Dashboard() {
  // --- 1. SYSTEM & DATA STATE ---
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({ 
    pending: 0, 
    outForDelivery: 0, 
    delivered: 0 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- 2. UI CONTROL STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [selectedRows, setSelectedRows] = useState([]);
  const [viewMode, setViewMode] = useState('list'); 
  const [draggedItem, setDraggedItem] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  // ✅ NEW: Dark Mode State (Persists in localStorage)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');

  // NEW: Address Search States
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Track if the algorithm took action
  const [autoPriorityTriggered, setAutoPriorityTriggered] = useState(false);

  // --- 3. FORM STATE ---
  const [formData, setFormData] = useState({
    receiver_name: '',
    item_name: '',
    address: '',
    latitude: null,
    longitude: null,
    priority: 'Medium',
    status: 'Pending'
  });

  const [dispatchData, setDispatchData] = useState({
    delivery_id: '', 
    plate_number: '', 
    vehicle_type: 'Prime Mover', 
    driver_name: ''
  });

  const navigate = useNavigate();

  // --- 4. AUTH & SESSION LOGIC ---
  const getUserSession = () => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : { name: 'Operative', role: 'Operations Lead' };
    } catch (e) {
      return { name: 'Operative', role: 'Operations Lead' };
    }
  };
  const user = getUserSession();

  // --- THEME ENGINE ---
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

  // --- 5. DATA FETCHING ENGINE ---
  const refreshDashboard = async () => {
    setIsLoading(true);
    try {
      const [delRes, statRes] = await Promise.all([
        fetch('http://localhost:5000/api/deliveries'),
        fetch('http://localhost:5000/api/stats')
      ]);

      if (!delRes.ok || !statRes.ok) throw new Error('Database Sync Error');

      const delData = await delRes.json();
      const statData = await statRes.json();

      setDeliveries(Array.isArray(delData) ? delData : []);
      setStats(statData || { pending: 0, outForDelivery: 0, delivered: 0 });
      setError(null);
    } catch (err) {
      console.error("Critical System Sync Error:", err);
      setError("Comms link to backend severed.");
      setDeliveries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshDashboard();
    const handleResize = () => {
      if (window.innerWidth > 1024) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- 6. ADDRESS AUTO-COMPLETE ENGINE ---
  useEffect(() => {
    if (addressQuery.length < 5) {
      setAddressSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingAddress(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}&addressdetails=1&limit=5&countrycodes=ph`
        );
        const data = await response.json();
        setAddressSuggestions(data);
      } catch (error) {
        console.error("Geocoding service unavailable");
      } finally {
        setIsSearchingAddress(false);
      }
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [addressQuery]);

  const selectAddress = (item) => {
    setFormData({
      ...formData,
      address: item.display_name,
      latitude: item.lat,
      longitude: item.lon
    });
    setAddressQuery(item.display_name);
    setAddressSuggestions([]);
  };

  // --- 7. META-DRIVEN PRIORITY ALGORITHM ---
  useEffect(() => {
    if (!isModalOpen || !formData.item_name) {
      setAutoPriorityTriggered(false);
      return;
    }

    const determinePriority = (cargoStr) => {
      const text = cargoStr.toLowerCase();
      
      const highKeywords = [
        'medical', 'blood', 'organ', 'drug', 'emergency', 'equipment',
        'perishable', 'dairy', 'frozen', 'fresh', 'food',
        'electronics', 'smartphone', 'jewelry', 'fragile', 'lab', 'instrument',
        'factory', 'shutdown', 'aog', 'aircraft', 'component', 'critical',
        'legal', 'contract', 'bidding', 'confidential', 'document'
      ];
      
      const lowKeywords = [
        'construction', 'sand', 'gravel', 'coal', 'chemical', 'bulk',
        'promotional', 'marketing', 'brochure', 'banner', 'giveaway',
        'administrative', 'paperwork', 'records',
        'stock', 'storage', 'excess', 'fulfillment'
      ];
      
      const mediumKeywords = [
        'laptop', 'appliance', 'consumer',
        'retail', 'apparel', 'clothing', 'fashion',
        'business', 'office', 'restocking', 'inventory',
        'maintenance', 'spare parts', 'servicing'
      ];

      for (const word of highKeywords) {
        if (text.includes(word)) return 'High';
      }
      for (const word of lowKeywords) {
        if (text.includes(word)) return 'Low';
      }
      for (const word of mediumKeywords) {
        if (text.includes(word)) return 'Medium';
      }
      return 'Medium'; 
    };

    const calculatedPriority = determinePriority(formData.item_name);
    
    if (formData.priority !== calculatedPriority) {
      setFormData(prev => ({ ...prev, priority: calculatedPriority }));
      setAutoPriorityTriggered(true);
    }
  }, [formData.item_name, isModalOpen]);

  // --- 8. ACTION HANDLERS ---
  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(filteredDeliveries.map(d => d.delivery_id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedRows(prev => 
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleAddDelivery = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        setFormData({ 
          receiver_name: '', 
          item_name: '', 
          address: '', 
          priority: 'Medium', 
          status: 'Pending' 
        });
        setAddressQuery('');
        setAutoPriorityTriggered(false);
        await refreshDashboard();
      } else {
        const errorData = await response.json();
        alert(`Server Error: ${errorData.error}`);
      }
    } catch (err) {
      alert("Database Commit Failed. System Link Error.");
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    try {
      await fetch('http://localhost:5000/api/fleet', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dispatchData, status: 'In Transit' })
      });
      await fetch(`http://localhost:5000/api/deliveries/${dispatchData.delivery_id}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Out for Delivery' })
      });
      setIsDispatchModalOpen(false);
      setDispatchData({ 
        delivery_id: '', 
        plate_number: '', 
        vehicle_type: 'Prime Mover', 
        driver_name: '' 
      });
      await refreshDashboard();
    } catch (err) { 
      alert("Dispatch Sequence Failed."); 
    }
  };

  const openDispatchModal = (deliveryId) => {
    setDispatchData({ ...dispatchData, delivery_id: deliveryId });
    setIsDispatchModalOpen(true);
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) await refreshDashboard();
    } catch (err) {
      console.error("Status Update Failed");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Permanently purge this record from logistics history?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/deliveries/${id}`, { method: 'DELETE' });
        if (response.ok) await refreshDashboard();
      } catch (err) {
        alert("Purge failed.");
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Permanently purge ${selectedRows.length} selected records?`)) {
      try {
        const response = await fetch('http://localhost:5000/api/deliveries/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedRows })
        });
        if (response.ok) {
          setSelectedRows([]);
          await refreshDashboard();
        }
      } catch (err) {
        alert("Bulk purge failed.");
      }
    }
  };

  const handleDragStart = (e, item) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.status === newStatus) return;
    handleStatusUpdate(draggedItem.delivery_id, newStatus);
    setDraggedItem(null);
  };

  const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };

  const filteredDeliveries = Array.isArray(deliveries) ? deliveries
    .filter(d => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (d.receiver_name || "").toLowerCase().includes(term) || 
        (d.item_name || "").toLowerCase().includes(term) ||
        (d.delivery_id || "").toString().includes(term);
      
      const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const weightDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      if (weightDiff !== 0) return weightDiff;
      return b.delivery_id - a.delivery_id;
    }) : [];

  const exportToPDF = () => {
    if (filteredDeliveries.length === 0) return alert("Manifest is empty.");
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text("GILFFC Logistics - Operational Freight Manifest", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()} | Auth Operative: ${user.name}`, 14, 30);
    const tableRows = filteredDeliveries.map(d => [
      `AWB-${d.delivery_id.toString().padStart(6, '0')}`,
      d.receiver_name,
      d.address,
      d.item_name,
      d.priority,
      d.status
    ]);
    autoTable(doc, { 
      head: [["ID", "Consignee", "Destination", "Cargo Details", "Priority", "Status"]], 
      body: tableRows, 
      startY: 36,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 4, fontSize: 9 }
    });
    doc.save(`GILFFC_Manifest_${Date.now()}.pdf`);
  };

  return (
    <div className={`fw-layout ${!isSidebarOpen ? 'sidebar-closed' : ''}`} style={{ background: t.bg, color: t.text1, transition: 'all 0.3s ease' }}>
      
      {/* ✅ UNIFIED MASTER CSS — IDENTICAL ACROSS ALL PAGES */}
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
        
        /* UPDATED: Search Bar Dark Mode Styles */
        .fw-search { 
          background: ${t.inputBg} !important; 
          border: 1px solid ${t.border} !important; 
          transition: border-color 0.2s ease;
        }
        .fw-search:focus-within {
          border-color: #2563eb !important;
        }
        .fw-search input { 
          background: transparent !important; 
          color: ${t.text1} !important; 
          border: none !important; 
        }

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
        .address-suggestions { background: ${t.card} !important; border: 1px solid ${t.border} !important; }
        .suggestion-item { color: ${t.text1} !important; border-bottom: 1px solid ${t.border} !important; }
        .suggestion-item:hover { background: ${t.hover} !important; }

        .profile-dropdown-menu { background: ${t.card} !important; border: 1px solid ${t.border} !important; }
        .dropdown-header { color: ${t.text1} !important; }
        .dropdown-divider { background: ${t.border} !important; }
        .profile-dropdown-menu button { color: ${t.text1} !important; }
        .profile-dropdown-menu button.text-danger { color: #ef4444 !important; }
        .profile-dropdown-menu button:hover, .theme-btn:hover { background: ${t.hover} !important; }

        /* UPDATED: View Toggles Dark Mode Styles */
        .view-toggles {
           background: ${isDarkMode ? '#1e293b' : '#f1f5f9'} !important;
           border: 1px solid ${t.border} !important;
        }
        .view-btn {
           transition: all 0.2s ease;
        }
        .view-btn.active {
           background: ${isDarkMode ? '#0f172a' : 'white'} !important;
           box-shadow: ${isDarkMode ? '0 4px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.1)'} !important;
        }
      `}</style>

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
          <span className="nav-label" style={{ color: t.text3 }}>Core Operations</span>
          <nav className="fw-nav">
            <button className="nav-btn active" onClick={() => navigate('/dashboard')}>
              <span className="icon">❖</span> Command Center
            </button>
            <button className="nav-btn" onClick={() => navigate('/customer-service')}>
              <span className="icon">⌗</span> Comms Terminal
            </button>
            <button className="nav-btn" onClick={() => navigate('/fleet-assets')}>
              <span className="icon">▤</span> Fleet Assets
            </button>
            <button className="nav-btn" onClick={() => navigate('/analytics')}>
              <span className="icon">◠</span> Analytics
            </button>
            <button className="nav-btn" onClick={() => navigate('/account-management')}>
              <span className="icon">⚙</span> Account Settings
            </button>
          </nav>
        </div>
        <div className="fw-sidebar-bottom">
          <button className="nav-btn text-danger" onClick={handleLogout}>
            <span className="icon">⏻</span> Secure Logout
          </button>
        </div>
      </aside>

      <main className="fw-main">
        <header className="fw-topbar">
          <div className="topbar-left">
            <button className="fw-icon-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              ☰
            </button>
            <div className="fw-search ml-4">
              <span className="search-icon" style={{ color: t.text3 }}>⌕</span>
              <input 
                type="text" 
                placeholder="Search Client or Cargo Item..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="fw-status-indicator ml-4" style={{ color: t.text2 }}>
              <span className="pulse-dot"></span> System Operational
            </div>
          </div>
          
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            
            {/* ✅ PROFESSIONAL SVG THEME TOGGLE */}
            <button onClick={toggleTheme} className="theme-btn" style={{ background: 'transparent', border: `1px solid ${t.border}`, color: t.text2, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
              {isDarkMode ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
            
            <button className="fw-icon-btn">⬦</button>
            <div style={{ position: 'relative' }}>
              <div className="fw-profile hover-pointer" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                <div className="profile-text">
                  <span className="name" style={{ color: t.text1 }}>{user.name || 'Alfrancis'}</span>
                  <span className="role" style={{ color: t.text2 }}>{user.role || 'Administrator'}</span>
                </div>
                <img src={localStorage.getItem('user_avatar') || '/avatar-placeholder.png'} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
              </div>
              {isProfileMenuOpen && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-header">
                    <strong>{user.name || 'Alfrancis'}</strong>
                    <span style={{ color: t.text2 }}>{user.email || 'admin@gilffc.global'}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }} onClick={() => navigate('/account-management')}>Account Settings</button>
                  <button style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }} onClick={() => navigate('/account-management')}>Manage Team</button>
                  <div className="dropdown-divider"></div>
                  <button className="text-danger" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }} onClick={handleLogout}>Secure Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="fw-content-wrapper">
          <div className="fw-page-header animate-up">
            <div>
              <h1>Network Overview</h1>
              <p>Real-time telemetry and freight forwarding status.</p>
            </div>
            <div className="header-actions">
              <button className="fw-btn-primary" onClick={() => setIsModalOpen(true)}>
                + Generate Waybill
              </button>
            </div>
          </div>

          <div className="fw-kpi-grid">
            <div className="fw-kpi-card animate-up" style={{ animationDelay: '0.1s' }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ color: t.text2 }}>Awaiting Dispatch</span>
                <span className="kpi-icon text-amber">◑</span>
              </div>
              <div className="kpi-value">{stats.pending}</div>
              <div className="kpi-progress">
                <div className="fill bg-amber" style={{width: `${(stats.pending / (deliveries.length || 1)) * 100}%`}}></div>
              </div>
            </div>
            <div className="fw-kpi-card animate-up" style={{ animationDelay: '0.2s' }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ color: t.text2 }}>Active Transit</span>
                <span className="kpi-icon text-blue">⇁</span>
              </div>
              <div className="kpi-value">{stats.outForDelivery}</div>
              <div className="kpi-progress">
                <div className="fill bg-blue" style={{width: `${(stats.outForDelivery / (deliveries.length || 1)) * 100}%`}}></div>
              </div>
            </div>
            <div className="fw-kpi-card animate-up" style={{ animationDelay: '0.3s' }}>
              <div className="kpi-header">
                <span className="kpi-title" style={{ color: t.text2 }}>Successfully Delivered</span>
                <span className="kpi-icon text-emerald">✓</span>
              </div>
              <div className="kpi-value">{stats.delivered}</div>
              <div className="kpi-progress">
                <div className="fill bg-emerald" style={{width: `${(stats.delivered / (deliveries.length || 1)) * 100}%`}}></div>
              </div>
            </div>
          </div>

          <div className="fw-data-panel animate-up" style={{ animationDelay: '0.4s' }}>
            <div className="panel-header">
              <div className="panel-title-group">
                <h3>Freight Manifest</h3>
                <div className="view-toggles">
                  <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} style={viewMode === 'list' ? { color: isDarkMode ? '#38bdf8' : '#2563eb' } : { color: t.text2 }} onClick={() => setViewMode('list')}>
                    <span className="icon">≣</span> List
                  </button>
                  <button className={`view-btn ${viewMode === 'board' ? 'active' : ''}`} style={viewMode === 'board' ? { color: isDarkMode ? '#38bdf8' : '#2563eb' } : { color: t.text2 }} onClick={() => setViewMode('board')}>
                    <span className="icon">◫</span> Pipeline
                  </button>
                </div>
              </div>
              <div className="panel-actions">
                 {selectedRows.length > 0 && viewMode === 'list' && (
                 <>
                   <span className="selection-count" style={{ color: t.text2 }}>{selectedRows.length} selected</span>
                   <button className="fw-btn-outline" style={{color: '#dc2626', borderColor: '#fca5a5', background: isDarkMode ? 'rgba(239,68,68,0.1)' : 'transparent'}} onClick={handleBulkDelete}>✕ Purge Selected</button>
                 </>
                 )}
                <button className="fw-btn-outline" style={{ color: t.text1, borderColor: t.border, background: isDarkMode ? t.bg : 'white' }} onClick={exportToPDF}>Export PDF</button>
              </div>
            </div>
            
            {viewMode === 'list' ? (
              <div className="table-scroll fade-in">
                <table className="fw-table">
                  <thead>
                    <tr>
                      <th className="checkbox-cell">
                        <input type="checkbox" className="fw-checkbox" onChange={handleSelectAll} checked={selectedRows.length === filteredDeliveries.length && filteredDeliveries.length > 0} />
                      </th>
                      <th>Waybill ID</th>
                      <th>Consignee</th>
                      <th>Destination</th>
                      <th>Cargo Details</th>
                      <th>Priority</th>
                      <th>Network Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.length > 0 ? filteredDeliveries.map((d, index) => (
                      <tr key={d.delivery_id} className={`animate-row ${selectedRows.includes(d.delivery_id) ? 'row-selected' : 'table-row-hover'}`} style={{ animationDelay: `${0.05 * index}s`, background: selectedRows.includes(d.delivery_id) ? (isDarkMode ? 'rgba(37,99,235,0.1)' : '#eff6ff') : 'transparent' }}>
                        <td className="checkbox-cell">
                          <input type="checkbox" className="fw-checkbox" checked={selectedRows.includes(d.delivery_id)} onChange={() => handleSelectRow(d.delivery_id)} />
                        </td>
                        <td className="cell-id" style={{ color: t.text2 }}>AWB-{d.delivery_id.toString().padStart(6, '0')}</td>
                        <td className="cell-primary">{d.receiver_name}</td>
                        <td className="cell-secondary" style={{ color: t.text2 }}>{d.address}</td>
                        <td className="cell-secondary" style={{ color: t.text2 }}>{d.item_name}</td>
                        <td className="cell-secondary">
                           <span className={`fw-badge prio-${(d.priority || 'medium').toLowerCase()}`}>
                             {d.priority || 'Medium'}
                           </span>
                        </td>
                        <td>
                          <span className={`fw-badge badge-${(d.status || 'pending').toLowerCase().replace(/ /g, '-')}`}>
                            {d.status}
                          </span>
                        </td>
                        <td>
                          <div className="fw-actions">
                            {d.status === 'Pending' && (
                              <button className="fw-btn-primary" style={{padding: '6px 12px', fontSize: '11px', marginRight: '8px'}} onClick={() => openDispatchModal(d.delivery_id)}>
                                Dispatch
                              </button>
                            )}
                            <select className="fw-select-minimal" style={{ background: t.inputBg, color: t.text1, border: `1px solid ${t.border}` }} value={d.status} onChange={(e) => handleStatusUpdate(d.delivery_id, e.target.value)}>
                              <option value="Pending">Pending</option>
                              <option value="Out for Delivery">In Transit</option>
                              <option value="Done">Delivered</option>
                            </select>
                            <button className="fw-btn-icon" style={{ color: t.text3 }} onClick={() => handleDelete(d.delivery_id)} title="Purge Record">✕</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="8" className="empty-table" style={{ color: t.text3 }}>No active freight data matching criteria.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="fw-board-layout fade-in">
                {['Pending', 'Out for Delivery', 'Done'].map(columnStatus => (
                  <div key={columnStatus} className="fw-board-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, columnStatus)}>
                    <div className="column-header">
                      <span className="column-title">{columnStatus === 'Done' ? 'Delivered' : columnStatus === 'Out for Delivery' ? 'In Transit' : 'Awaiting Dispatch'}</span>
                      <span className="column-count" style={{ background: t.card, color: t.text1, border: `1px solid ${t.border}` }}>{filteredDeliveries.filter(d => d.status === columnStatus).length}</span>
                    </div>
                    <div className="column-body">
                      {filteredDeliveries.filter(d => d.status === columnStatus).map(d => (
                        <div key={d.delivery_id} className="fw-board-card" draggable onDragStart={(e) => handleDragStart(e, d)}>
                          <div className="card-top">
                            <span className="cell-id" style={{ color: t.text2 }}>AWB-{d.delivery_id.toString().padStart(6, '0')}</span>
                            <span className={`priority-tag p-${(d.priority || 'medium').toLowerCase()}`}>{d.priority || 'Medium'}</span>
                          </div>
                          <h4 className="card-client">{d.receiver_name}</h4>
                          <p className="card-cargo">{d.item_name}</p>
                          <div className="card-footer"><span className="card-dest" style={{ color: t.text3 }}>⚲ {d.address}</span></div>
                          {d.status === 'Pending' && (
                            <button className="fw-btn-primary" style={{width: '100%', marginTop: '12px', padding: '6px'}} onClick={() => openDispatchModal(d.delivery_id)}>
                              Assign Vehicle
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* GENERATE WAYBILL MODAL */}
      {isModalOpen && (
        <div className="fw-modal-overlay fade-in">
          <div className="fw-modal slide-in">
            <div className="modal-header">
              <h2>Generate New Waybill</h2>
              <button className="fw-icon-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddDelivery} className="fw-form">
                <div className="form-group">
                  <label>Consignee (Receiver Name)</label>
                  <input type="text" required placeholder="e.g. Acme Corp" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Cargo Description <span style={{color: t.text3, fontWeight: 'normal', marginLeft: '6px'}}>(AI Priority Enabled)</span></label>
                  <input type="text" required placeholder="e.g. Medical Supplies, Servers, Furniture..." value={formData.item_name} onChange={e => setFormData({...formData, item_name: e.target.value})} />
                </div>

                <div className="form-group" style={{position: 'relative'}}>
                  <label>Exact Destination Address</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="Search street, building, or city..." 
                    value={addressQuery} 
                    onChange={e => setAddressQuery(e.target.value)} 
                  />
                  {isSearchingAddress && <div className="address-loader" style={{ color: t.text2 }}>Verifying coordinates...</div>}
                  {addressSuggestions.length > 0 && (
                    <div className="address-suggestions">
                      {addressSuggestions.map((item, i) => (
                        <div key={i} className="suggestion-item" onClick={() => selectAddress(item)}>
                          <span className="marker-icon">📍</span>
                          <span className="address-text">{item.display_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group half">
                    <label>System-Assigned Priority</label>
                    <div style={{
                      padding: '10px 12px',
                      background: formData.priority === 'High' ? (isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2') : formData.priority === 'Low' ? (isDarkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5') : (isDarkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb'),
                      border: `1px solid ${formData.priority === 'High' ? (isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca') : formData.priority === 'Low' ? (isDarkMode ? 'rgba(16,185,129,0.2)' : '#a7f3d0') : (isDarkMode ? 'rgba(245,158,11,0.2)' : '#fde68a')}`,
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span className={`fw-badge prio-${formData.priority.toLowerCase()}`}>{formData.priority}</span>
                      {autoPriorityTriggered && <span style={{fontSize: '10px', color: t.text3, fontWeight: '600'}}>AUTO-CALCULATED</span>}
                    </div>
                  </div>
                  <div className="form-group half">
                    <label>Initial Status</label>
                    <select className="fw-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="Pending">Awaiting Dispatch</option>
                      <option value="Out for Delivery">In Transit</option>
                      <option value="Done">Delivered</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="fw-btn-ghost" style={{ color: t.text2 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="fw-btn-primary" disabled={!formData.latitude}>Commit to Database</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH MODAL */}
      {isDispatchModalOpen && (
        <div className="fw-modal-overlay fade-in">
          <div className="fw-modal slide-in">
            <div className="modal-header">
              <h2>Assign Vehicle & Driver</h2>
              <button className="fw-icon-btn" onClick={() => setIsDispatchModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleDispatch} className="fw-form">
                <div className="form-row">
                  <div className="form-group half"><label>Plate Number</label><input type="text" placeholder="e.g. ABC-1234" onChange={e => setDispatchData({...dispatchData, plate_number: e.target.value})} required /></div>
                  <div className="form-group half"><label>Vehicle Type</label><select className="fw-select" onChange={e => setDispatchData({...dispatchData, vehicle_type: e.target.value})}><option>Prime Mover</option><option>Wing Van</option><option>Close Van</option><option>Motorcycle</option></select></div>
                </div>
                <div className="form-group"><label>Assigned Driver</label><input type="text" placeholder="Driver Full Name" onChange={e => setDispatchData({...dispatchData, driver_name: e.target.value})} required /></div>
                <div className="modal-footer">
                  <button type="button" className="fw-btn-ghost" style={{ color: t.text2 }} onClick={() => setIsDispatchModalOpen(false)}>Cancel</button>
                  <button type="submit" className="fw-btn-primary">Execute Dispatch</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;