import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Dashboard.css';
import './CustomerService.css';

function CustomerService() {
  // --- SYSTEM & DATA STATE ---
  const [deliveries, setDeliveries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- UI CONTROL STATE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeChatClient, setActiveChatClient] = useState(null);
  const [activeDeliveryId, setActiveDeliveryId] = useState(null); 
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [newMessage, setNewMessage] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // ✅ UNIFIED DARK MODE STATE
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');

  const toggleTheme = () => {
    setIsDarkMode(prev => {
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
    text3: isDarkMode ? '#94a3b8' : '#94a3b8',
    headerBg: isDarkMode ? '#0f172a' : 'white',
    inputBg: isDarkMode ? '#1e293b' : '#f8fafc',
    inputBorder: isDarkMode ? '#334155' : '#e2e8f0',
    chatBg: isDarkMode ? '#0b1220' : '#f8fafc',
    panelHeaderBg: isDarkMode ? '#020617' : '#f8fafc',
    mutedBorder: isDarkMode ? '#334155' : '#f1f5f9'
  };

  // ✅ ADDED: Notification Tracking State
  const [prevMsgCount, setPrevMsgCount] = useState(0);

  const chatEndRef = useRef(null);
  const navigate = useNavigate();

  const getUserSession = () => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : { name: 'Operative', role: 'Support Lead' };
    } catch (e) {
      return { name: 'Operative', role: 'Support Lead' };
    }
  };
  const user = getUserSession();

  // --- UPGRADED DATA ENGINE (ROBUST ERROR HANDLING) ---
  const loadTerminalData = async () => {
    try {
      const [delRes, msgRes] = await Promise.all([
        fetch('http://localhost:5000/api/deliveries'),
        fetch('http://localhost:5000/api/messages')
      ]);

      // Step-by-step verification to pinpoint the failure
      if (!delRes.ok) {
        throw new Error(`Deliveries API failed with status: ${delRes.status}`);
      }
      if (!msgRes.ok) {
        throw new Error(`Messages API failed with status: ${msgRes.status}`);
      }

      const delData = await delRes.json();
      const msgData = await msgRes.json();

      setDeliveries(Array.isArray(delData) ? delData : []);
      setMessages(Array.isArray(msgData) ? msgData : []);
      
      // Clear error if sync is successful
      setError(null);
    } catch (err) {
      // Detailed error logging as suggested
      console.error("Communications Link Error Details:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toLocaleTimeString()
      });

      // Providing specific user feedback based on the error
      if (err.message.includes('Failed to fetch')) {
        setError("Network Error: Cannot reach the backend server.");
      } else {
        setError(`System Error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTerminalData();
    const syncInterval = setInterval(loadTerminalData, 1000);
    
    const handleResize = () => setIsSidebarOpen(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // ✅ ADDED: Notification Sound Logic
  useEffect(() => {
    if (messages.length > prevMsgCount) {
      const lastMsg = messages[messages.length - 1];
      // Only ping if message is incoming from a Client
      if (lastMsg && lastMsg.sender_name !== 'Admin') {
        new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3').play().catch(() => {});
      }
      setPrevMsgCount(messages.length);
    }
  }, [messages, prevMsgCount]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isChatOpen]);

  // ✅ UPDATED: Count unread based on is_read column
  const getUnreadCount = (deliveryId) => {
    return messages.filter(m => m.delivery_id === deliveryId && m.sender_name !== 'Admin' && !m.is_read).length;
  };

  // ✅ UPDATED: Mark as read when opening session
  const startChatSession = async (clientName, deliveryId) => {
    setActiveChatClient(clientName);
    setActiveDeliveryId(deliveryId);
    setIsChatOpen(true);

    // API: Clear notifications for this delivery node
    try {
      await fetch(`http://localhost:5000/api/messages/read/${deliveryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'Admin' })
      });
      loadTerminalData(); // Refresh UI to remove badge
    } catch (err) {
      console.error("Failed to clear notifications");
    }

    setTimeout(() => {
      const input = document.getElementById('chat-terminal-input');
      if (input) input.focus();
    }, 300);
  };

  const closeChatSession = () => {
    setIsChatOpen(false);
    setActiveChatClient(null);
    setActiveDeliveryId(null);
    setNewMessage('');
  };

  const handleSendMessage = async (e) => {
    if ((e.key === 'Enter' || e.type === 'click') && newMessage.trim() && activeChatClient) {
      const payload = {
        sender_name: 'Admin',
        receiver_name: activeChatClient,
        delivery_id: activeDeliveryId,
        message_text: newMessage.trim()
      };

      try {
        const response = await fetch('http://localhost:5000/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          setNewMessage('');
          loadTerminalData(); 
        }
      } catch (err) {
        console.error("Transmission failed.");
      }
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) loadTerminalData();
    } catch (err) {
      console.error("Status Update Failed");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Permanently purge this communication node and associated cargo record?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/deliveries/${id}`, { method: 'DELETE' });
        if (response.ok) loadTerminalData();
      } catch (err) {
        alert("Purge failed.");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const exportChatHistory = () => {
    const doc = new jsPDF();
    const chatLogs = messages.filter(m => m.delivery_id === activeDeliveryId);

    doc.setFontSize(18);
    doc.text(`Comms Audit: ${activeChatClient}`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Auth User: ${user.name} | Export Date: ${new Date().toLocaleString()}`, 14, 30);

    const tableRows = chatLogs.map(m => [
      new Date(m.timestamp).toLocaleString(),
      m.sender_name === 'Admin' ? 'SYSTEM' : 'CLIENT',
      m.message_text
    ]);

    autoTable(doc, {
      head: [['Timestamp', 'Origin', 'Message']],
      body: tableRows,
      startY: 36,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    doc.save(`Audit_Log_${activeChatClient}_AWB${activeDeliveryId}.pdf`);
  };

  const filteredNodes = deliveries.filter(node => {
    const searchLower = searchTerm.toLowerCase().trim();
    const receiver = (node.receiver_name || "").toLowerCase();
    const item = (node.item_name || "").toLowerCase();
    const deliveryIdStr = String(node.delivery_id);
    const paddedIdStr = deliveryIdStr.padStart(6, '0');
    
    const matchesSearch = 
      receiver.includes(searchLower) ||
      item.includes(searchLower) ||
      deliveryIdStr.includes(searchLower) ||
      paddedIdStr.includes(searchLower);
    
    const matchesStatus = statusFilter === 'All' || node.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={`fw-layout ${!isSidebarOpen ? 'sidebar-closed' : ''}`} style={{ background: t.bg, color: t.text1 }}>
      
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
        .fw-search input { background: ${t.inputBg} !important; color: ${t.text1} !important; border: 1px solid ${t.border} !important; }
        .fw-page-header h1 { color: ${t.text1} !important; }
        .fw-page-header p { color: ${t.text2} !important; }

        .fw-kpi-card, .fw-data-panel, .settings-card, .settings-sidebar, .fw-board-card { background: ${t.card} !important; border: 1px solid ${t.border} !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .kpi-value, .panel-title-group h3, .card-header h3, .widget-title, .column-title, .card-client, .cell-primary { color: ${t.text1} !important; }
        .fw-table th { background: ${isDarkMode ? '#020617' : '#f8fafc'} !important; color: ${t.text2} !important; border-bottom: 1px solid ${t.border} !important; }
        .fw-table td { border-bottom: 1px solid ${t.border} !important; color: ${t.text1}; }
        .table-row-hover:hover td { background: ${isDarkMode ? '#1e293b' : '#f8fafc'} !important; }
        .cell-id, .cell-secondary, .card-cargo { color: ${t.text2} !important; }

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
              <span className="icon">❖</span> Command Center
            </button>
            <button className="nav-btn active" onClick={() => navigate('/customer-service')}>
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
            <button className="fw-icon-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>☰</button>
            <div className="fw-status-indicator ml-4">
              <span className={`pulse-dot ${error ? 'error-bg' : ''}`} style={{ background: error ? '#ef4444' : '#10b981' }}></span> 
              <span style={{ fontSize: '14px', fontWeight: '600', color: error ? '#ef4444' : t.text2 }}>
                {error || 'Comms Link Operational'}
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
            <button className="fw-icon-btn" style={{ color: t.text1 }}>⬦</button>
            <div style={{ position: 'relative' }}>
              <div className="fw-profile hover-pointer" onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}>
                <div className="profile-text">
                  <span className="name" style={{ color: t.text1 }}>{user.name || 'Alfrancis'}</span>
                  <span className="role" style={{ color: t.text2 }}>{user.role || 'Operations Lead'}</span>
                </div>
                <img src={localStorage.getItem('user_avatar') || '/avatar-placeholder.png'} alt="Profile" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = '/avatar-placeholder.png'; }} />
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
          <div className="fw-page-header animate-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: '900', color: t.text1 }}>Communications Terminal</h1>
              <p style={{ fontSize: '16px', color: t.text2 }}>Direct encrypted channel for client support and logistics resolution.</p>
            </div>
            
            <div className="header-actions" style={{ display: 'flex', gap: '16px' }}>
              <input 
                type="text"
                placeholder="Search Client or Cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${t.inputBorder}`,
                  width: '250px',
                  fontSize: '14px',
                  outline: 'none',
                  background: t.inputBg,
                  color: t.text1
                }}
              />
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: `1px solid ${t.inputBorder}`,
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: t.inputBg,
                  color: t.text1
                }}
              >
                <option value="All">All Ticket Statuses</option>
                <option value="Pending">Pending / Awaiting Dispatch</option>
                <option value="Out for Delivery">Active Transit</option>
                <option value="Done">Resolved / Delivered</option>
              </select>
            </div>
          </div>

          {/* ACTIVE NODES TABLE */}
          <div className="fw-data-panel animate-up" style={{ background: t.card, borderRadius: '16px', border: `1px solid ${t.border}` }}>
            <div className="panel-header" style={{ padding: '24px 32px', borderBottom: `1px solid ${t.mutedBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: t.text1 }}>Support Nodes</h3>
              <div style={{ background: isDarkMode ? '#1e3a8a' : '#eff6ff', color: isDarkMode ? '#a5b4fc' : '#2563eb', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
                {filteredNodes.length} Sessions Available
              </div>
            </div>
            <div className="table-scroll">
              <table className="fw-table">
                <thead>
                  <tr>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Ticket ID</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Consignee</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>Cargo Association</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', color: t.text2 }}>System Status</th>
                    <th style={{ fontSize: '13px', padding: '16px 32px', textAlign: 'right', color: t.text2 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNodes.length > 0 ? filteredNodes.map((node) => {
                    const unread = getUnreadCount(node.delivery_id);
                    return (
                      <tr key={node.delivery_id} className="table-row-hover">
                        <td style={{ padding: '20px 32px', fontSize: '15px', fontWeight: '700', color: t.text2, fontFamily: 'monospace' }}>
                          TKT-{node.delivery_id.toString().padStart(5, '0')}
                        </td>
                        <td style={{ padding: '20px 32px', fontSize: '15px', fontWeight: '700', color: t.text1 }}>
                          {node.receiver_name}
                          {unread > 0 && (
                            <span style={{ marginLeft: '8px', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                              {unread} New
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '20px 32px', fontSize: '15px', color: t.text2 }}>{node.item_name}</td>
                        <td style={{ padding: '20px 32px' }}>
                          <select 
                            value={node.status} 
                            onChange={(e) => handleStatusUpdate(node.delivery_id, e.target.value)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: `1px solid ${t.inputBorder}`,
                              fontSize: '13px',
                              fontWeight: '600',
                              color: node.status === 'Done' ? '#10b981' : (node.status === 'Out for Delivery' ? '#2563eb' : '#f59e0b'),
                              background: isDarkMode ? '#1e293b' : (node.status === 'Done' ? '#dcfce7' : (node.status === 'Out for Delivery' ? '#eff6ff' : '#fef3c7')),
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Out for Delivery">In Transit</option>
                            <option value="Done">Delivered</option>
                          </select>
                        </td>
                        <td style={{ padding: '20px 32px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => startChatSession(node.receiver_name, node.delivery_id)}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              border: unread > 0 ? 'none' : `1px solid ${t.inputBorder}`,
                              background: unread > 0 ? '#2563eb' : t.card,
                              color: unread > 0 ? 'white' : t.text1,
                              transition: 'all 0.2s'
                            }}
                          >
                            {unread > 0 ? 'Respond Now' : 'Open Terminal'}
                          </button>
                          <button 
                            className="fw-btn-icon" 
                            onClick={() => handleDelete(node.delivery_id)} 
                            style={{ color: '#ef4444', fontSize: '16px' }}
                            title="Purge Node"
                          >✕</button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan="5" className="empty-table" style={{ padding: '60px', fontSize: '16px', color: t.text2 }}>
                        No active communication nodes matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* FLOATING PREMIUM CHAT POPUP */}
      {isChatOpen && (
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '380px',
            height: '500px',
            background: t.card,
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: `1px solid ${t.border}`,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ background: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#f8fafc' : '#0f172a', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.2)' }}></div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{activeChatClient}</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>AWB-{activeDeliveryId?.toString().padStart(6, '0')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={exportChatHistory} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '16px' }} title="Export Transcript">⤓</button>
              <button onClick={closeChatSession} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
          </div>
          
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: t.chatBg, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.filter(m => m.delivery_id === activeDeliveryId).length > 0 ? (
              messages.filter(m => m.delivery_id === activeDeliveryId).map((msg) => {
                const isAdmin = msg.sender_name === 'Admin';
                return (
                  <div key={msg.message_id} style={{ display: 'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start' }}>
                    <div style={{ 
                      maxWidth: '80%', 
                      background: isAdmin ? '#2563eb' : (isDarkMode ? '#1e293b' : 'white'), 
                      color: isAdmin ? 'white' : (isDarkMode ? '#e2e8f0' : '#0f172a'),
                      padding: '12px 16px',
                      borderRadius: isAdmin ? '16px 16px 0 16px' : '16px 16px 16px 0',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      border: isAdmin ? 'none' : `1px solid ${t.inputBorder}`
                    }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: isAdmin ? '#bfdbfe' : '#94a3b8', marginBottom: '4px' }}>
                        {isAdmin ? 'System Admin' : msg.sender_name} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '14px', lineHeight: '1.5' }}>{msg.message_text}</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <span style={{ fontSize: '32px', marginBottom: '12px' }}>✉</span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>Initializing encrypted link...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '16px', background: t.card, borderTop: `1px solid ${t.border}`, display: 'flex', gap: '12px' }}>
            <input 
              id="chat-terminal-input"
              type="text" 
              placeholder="Draft encrypted response..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleSendMessage}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '20px',
                border: `1px solid ${t.inputBorder}`,
                background: t.inputBg,
                color: t.text1,
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button 
              onClick={handleSendMessage}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: '900',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerService;