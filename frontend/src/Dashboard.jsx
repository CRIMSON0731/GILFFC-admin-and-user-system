import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import './Dashboard.css';

// ─── Geospatial Math ──────────
const HUB_COORDS = [14.5866, 120.9630];

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Live Weather Telemetry Engine ──────────────────────────────────────────
const fetchLiveWeatherMultiplier = async (lat, lon) => {
  if (!lat || !lon) return { weather: 1.0, context: "No Geodata: Default Weather" };

  try {
    const API_KEY = '2efe8fc4f4c2807debc7c4ebf9ac3e24'; 
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
    
    if (!response.ok) throw new Error("API Connection Failed");
    
    const data = await response.json();
    const condition = data.weather[0].main.toLowerCase();

    if (condition === 'thunderstorm' || condition === 'squall' || condition === 'tornado') {
      return { weather: 1.50, context: "Live API: Severe Weather / Storm Buffer" };
    } else if (condition === 'rain' || condition === 'drizzle') {
      return { weather: 1.35, context: "Live API: Wet Roads / Rain Buffer" };
    } else if (condition === 'mist' || condition === 'fog' || condition === 'haze') {
      return { weather: 1.20, context: "Live API: Low Visibility Buffer" };
    }
    
    return { weather: 1.0, context: "Live API: Nominal Weather Conditions" };
  } catch (error) {
    console.error("Weather API offline or limit reached, falling back to nominal.", error);
    return { weather: 1.0, context: "Weather API Offline (Fallback Nominal)" };
  }
};

// ─── Digital Twin Simulator ─────────────────────────────────────────────────
// Simulates P90 ETA by overlaying external contextual streams including live weather
const runDigitalTwinSimulation = (distKm, address, itemDescription, liveWeatherObj) => {
  if (!distKm) return { p90Eta: 45, confidence: 'Moderate (70%)', contexts: ['Standard Model (No Geodata)'] };
  
  const baseSpeedKmH = 25; 
  let baseMins = (distKm / baseSpeedKmH) * 60;
  
  // Dynamic Multipliers injected from APIs and Time Contexts
  let multipliers = { weather: liveWeatherObj?.weather || 1.0, traffic: 1.0, event: 1.0, port: 1.0 };
  let activeContexts = liveWeatherObj?.context ? [liveWeatherObj.context] : [];
  
  const adr = (address || '').toLowerCase();
  const items = (itemDescription || '').toLowerCase();

  const currentHour = new Date().getHours();
  if ((currentHour >= 7 && currentHour <= 10) || (currentHour >= 16 && currentHour <= 20)) {
    multipliers.traffic = 1.5;
    activeContexts.push("Traffic Layer: Peak Rush Hour Congestion");
  } else if (adr.includes('edsa') || adr.includes('c-5') || adr.includes('bgc')) {
    multipliers.traffic = 1.25;
    activeContexts.push("Traffic Layer: Known Bottleneck Zone");
  }

  const currentDay = new Date().getDate();
  if (currentDay === 15 || currentDay === 30 || currentDay === 31) {
    multipliers.event = 1.2;
    activeContexts.push("Calendar API: Payday Volume Surge");
  }

  if (items.includes('container') || items.includes('bulk') || adr.includes('port') || adr.includes('pier')) {
    multipliers.port = 1.4;
    activeContexts.push("Terminal API: Elevated Port Dwell Time");
  }

  if (activeContexts.length === 0) {
    activeContexts.push("Nominal Conditions: Clear Route");
  }

  const totalMultiplier = multipliers.weather * multipliers.traffic * multipliers.event * multipliers.port;
  const rawEta = Math.max(15, Math.ceil(baseMins * totalMultiplier));

  const p90Eta = Math.ceil(rawEta * 1.20);
  
  let confidence = 'High (>90%)';
  if (totalMultiplier > 1.8) confidence = 'Moderate (75%) - Compounding Delays';
  if (totalMultiplier > 2.5) confidence = 'Low (<60%) - Severe Externalities';

  return { p90Eta, confidence, contexts: activeContexts };
};

function Dashboard() {
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState({ pending: 0, outForDelivery: 0, delivered: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [selectedRows, setSelectedRows] = useState([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showPriorityHelp, setShowPriorityHelp] = useState(false);
  const [isCalculatingDispatch, setIsCalculatingDispatch] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('admin_theme') === 'dark');

  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const [autoPriorityTriggered, setAutoPriorityTriggered] = useState(false);
  const [dispatchAlert, setDispatchAlert] = useState(null);
  
  // LIVE ADMIN NOTIFIER STATES
  const prevDeliveriesRef = useRef([]);
  const [successToast, setSuccessToast] = useState(null);

  const [formData, setFormData] = useState({
    receiver_name: '',
    house_number: '',
    address: '',
    latitude: null,
    longitude: null,
    priority: 'Medium',
    status: 'Pending',
    items: [{ qty: 1, description: '' }] 
  });

  const [dispatchData, setDispatchData] = useState({
    delivery_id: '', 
    plate_number: '', 
    vehicle_type: 'Prime Mover', 
    driver_name: ''
  });
  
  const [dispatchDelivery, setDispatchDelivery] = useState(null);
  const [vehicleRecommendation, setVehicleRecommendation] = useState(null);

  const navigate = useNavigate();

  const getUserSession = () => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : { name: 'Operative', role: 'Operations Lead' };
    } catch (e) {
      return { name: 'Operative', role: 'Operations Lead' };
    }
  };
  const user = getUserSession();

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

  // UPDATED TO ALLOW SILENT POLLING WITHOUT UI FLICKER
  const refreshDashboard = async (isBackgroundPoll = false) => {
    if (!isBackgroundPoll) setIsLoading(true);
    try {
      const [delRes, statRes] = await Promise.all([
        fetch('http://localhost:5000/api/deliveries'),
        fetch('http://localhost:5000/api/stats')
      ]);
      if (!delRes.ok || !statRes.ok) throw new Error('Database Sync Error');
      const delData = await delRes.json();
      const statData = await statRes.json();
      
      const newDeliveries = Array.isArray(delData) ? delData : [];
      setDeliveries(newDeliveries);
      setStats(statData || { pending: 0, outForDelivery: 0, delivered: 0 });
      setError(null);
    } catch (err) {
      setError("Comms link to backend severed.");
      if (!isBackgroundPoll) setDeliveries([]);
    } finally {
      if (!isBackgroundPoll) setIsLoading(false);
    }
  };

  // SILENT POLLING ENGINE FOR AUTO-RESOLVE DETECTION
  useEffect(() => {
    refreshDashboard();
    const interval = setInterval(() => refreshDashboard(true), 2500); 
    return () => clearInterval(interval);
  }, []);

  // LIVE ADMIN NOTIFICATION ENGINE
  useEffect(() => {
    if (prevDeliveriesRef.current.length > 0 && deliveries.length > 0) {
        deliveries.forEach(d => {
            const prevD = prevDeliveriesRef.current.find(p => p.delivery_id === d.delivery_id);
            // IF cargo was "Out for Delivery" and is now "Done" -> Auto-Resolved!
            if (prevD && prevD.status === 'Out for Delivery' && d.status === 'Done') {
                // Play notification from public folder
                new Audio('/mixkit-bell-notification-933.wav').play().catch(() => console.log("Audio blocked by browser"));
                setSuccessToast(`✅ AWB-${String(d.delivery_id).padStart(6, '0')} has been successfully delivered! Target secured.`);
                setTimeout(() => setSuccessToast(null), 8000);
            }
        });
    }
    prevDeliveriesRef.current = deliveries;
  }, [deliveries]);

  // Geocoding via Debouncing
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

  useEffect(() => {
    if (!isModalOpen || formData.items.length === 0) {
      setAutoPriorityTriggered(false);
      return;
    }
    // Priority Triage
    const determinePriority = (combinedText) => {
      const text = combinedText.toLowerCase();

      const tempFlags = ['chilled', 'frozen', 'temperature'];
      const safetyFlags = ['flammable', 'corrosive', 'hazardous', 'un number'];
      const handlingFlags = ['fragile', 'keep dry', 'do not stack'];
      const unRegex = /un\d{4}/;

      if (tempFlags.some(w => text.includes(w)) || 
          safetyFlags.some(w => text.includes(w)) || 
          handlingFlags.some(w => text.includes(w)) || 
          unRegex.test(text)) {
        return 'High';
      }

      const highKeywords = ['medical', 'vaccines', 'insulin', 'ppe', 'dialysis', 'syringes', 'catheters', 'iv fluid', 'gauze', 'cardiac monitor', 'defibrillator', 'stethoscope', 'antibiotics', 'antiseptics', 'emergency', 'aog', 'relief goods', 'first aid', 'fire extinguisher', 'oxygen tank', 'life vest', 'rescue rope', 'shelter kit', 'generator', 'blood bags', 'perishable', 'seafood', 'tuna', 'mangoes', 'pineapple', 'poultry', 'dairy', 'milk', 'butter', 'cheese', 'flowers', 'roses', 'sashimi', 'vegetables', 'contract', 'documents', 'bol', 'bill of lading', 'deeds', 'title', 'notarized', 'signed', 'passport', 'visa', 'tender', 'legal brief', 'corporate seal', 'bond', 'lab', 'reagents', 'specimens', 'samples', 'petri dish', 'microscope', 'centrifuge', 'test tubes', 'pipettes', 'chemical buffer', 'culture media', 'incubator', 'electronics', 'smartphone', 'laptop', 'gpu', 'cpu', 'ssd', 'motherboard', 'tablet', 'semiconductor', 'microchip', 'circuit board', 'ram', 'console'];
      const mediumKeywords = ['retail', 'apparel', 'jeans', 'sneakers', 't-shirts', 'cosmetics', 'lipstick', 'shampoo', 'perfume', 'toys', 'handbags', 'jewelry', 'watches', 'sporting goods', 'gym gear', 'appliance', 'tv', 'refrigerator', 'aircon', 'washer', 'dryer', 'microwave', 'electric fan', 'blender', 'rice cooker', 'oven', 'induction', 'vacuum cleaner', 'office', 'bond paper', 'printer', 'toner', 'ink', 'stationery', 'stapler', 'whiteboard', 'desk', 'ergonomic chair', 'filing cabinet', 'shredder', 'projector', 'inventory', 'sku', 'raw material', 'stock', 'warehouse replenishment', 'spare parts', 'fasteners', 'bolts', 'screws', 'packaging', 'canned goods', 'bottled water'];
      const lowKeywords = ['bulk', 'raw sugar', 'rice', 'corn', 'coal', 'scrap metal', 'mineral ore', 'cement', 'fertilizer', 'animal feed', 'wheat', 'flour', 'sand', 'gravel', 'aggregates', 'crushed stone', 'pebble', 'limestone', 'filling material', 'g1', 's1', 'silica', 'marketing', 'tarpaulin', 'banner', 'booth', 'flyer', 'brochure', 'standee', 'signage', 'merch', 'giveaways', 'tents', 'backdrop', 'stickers', 'storage', 'pallets', 'crates', 'empty container', 'archive box', 'racking', 'shelving', 'salvaged parts', 'old equipment', 'discarded assets'];

      for (const word of highKeywords) if (text.includes(word)) return 'High';
      for (const word of mediumKeywords) if (text.includes(word)) return 'Medium';
      for (const word of lowKeywords) if (text.includes(word)) return 'Low';
      
      return 'Medium'; 
    };

    const combinedText = formData.items.map(i => i.description).join(' ');
    if (combinedText.trim().length === 0) return;

    const calculatedPriority = determinePriority(combinedText);
    if (formData.priority !== calculatedPriority) {
      setFormData(prev => ({ ...prev, priority: calculatedPriority }));
      setAutoPriorityTriggered(true);
    }
  }, [formData.items, isModalOpen]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({ ...formData, items: [...formData.items, { qty: 1, description: '' }] });
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedRows(filteredDeliveries.map(d => d.delivery_id));
    else setSelectedRows([]);
  };

  const handleSelectRow = (id) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]);
  };

  const handleAddDelivery = async (e) => {
    e.preventDefault();
    
    const finalAddress = formData.house_number ? `${formData.house_number}, ${formData.address}` : formData.address;
    const aggregatedItems = formData.items
      .filter(i => i.description.trim() !== '')
      .map(i => `${i.qty}x Box(es) containing ${i.description}`)
      .join(', ');

    const payload = {
      ...formData,
      address: finalAddress,
      item_name: aggregatedItems || 'General Cargo Boxes'
    };

    try {
      const response = await fetch('http://localhost:5000/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        setIsModalOpen(false);
        setFormData({ receiver_name: '', house_number: '', address: '', priority: 'Medium', status: 'Pending', items: [{ qty: 1, description: '' }] });
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

  // Fleet Recommendation Engine
  const getVehicleRecommendation = async (delivery) => {
    if (!delivery) return { type: 'Close Van', reason: 'Standard load.', p90Eta: 45, confidence: 'Moderate', contexts: [] };
    const text = (delivery.item_name || '').toLowerCase();
    
    const qtyMatches = delivery.item_name?.match(/(\d+)x/g) || [];
    const totalQty = qtyMatches.reduce((sum, match) => sum + parseInt(match), 0) || 1;

    let dist = null;
    let etaForecasting = { p90Eta: 45, confidence: 'Standard', contexts: ['Nominal Conditions'] };

    if (delivery.latitude && delivery.longitude) {
       dist = getDistanceFromLatLonInKm(HUB_COORDS[0], HUB_COORDS[1], parseFloat(delivery.latitude), parseFloat(delivery.longitude));
       
       // Async Fetch for Live Weather
       const liveWeather = await fetchLiveWeatherMultiplier(delivery.latitude, delivery.longitude);
       
       etaForecasting = runDigitalTwinSimulation(dist, delivery.address, delivery.item_name, liveWeather);
    }

    let recType = 'Close Van';
    let recReason = `Optimal for secure standard transit (${totalQty} boxes).`;

    if (text.includes('bulk') || text.includes('construction') || text.includes('gravel') || text.includes('coal') || totalQty >= 100) {
      recType = 'Prime Mover';
      recReason = `Heavy/bulk payload detected (${totalQty} boxes).`;
    } else if (text.includes('furniture') || text.includes('appliance') || totalQty >= 30) {
      recType = 'Wing Van';
      recReason = `High volume cargo capacity required (${totalQty} boxes).`;
    } else if (dist && dist < 15 && totalQty === 1 && !text.includes('fragile') && !text.includes('medical') && !text.includes('equipment')) {
      recType = 'Motorcycle';
      recReason = `Short distance (${Math.round(dist)}km) and strict 1-box limit.`;
    }

    return { 
      type: recType, 
      reason: recReason, 
      distance: dist ? Math.round(dist * 10) / 10 : null,
      ...etaForecasting
    };
  };

  const openDispatchModal = async (deliveryId) => {
    setIsCalculatingDispatch(true);
    setDispatchAlert(null); // Clear any old alerts
    
    const selected = deliveries.find(d => d.delivery_id === deliveryId);
    setDispatchDelivery(selected);
    
    const recommendation = await getVehicleRecommendation(selected);
    setVehicleRecommendation(recommendation);

    setDispatchData(prev => ({ 
      ...prev, 
      delivery_id: deliveryId,
      vehicle_type: recommendation.type 
    }));
    
    setIsCalculatingDispatch(false);
    setIsDispatchModalOpen(true);
  };

  // Enforces the strict vehicle selection
  const handleVehicleTypeChange = (e) => {
    const selectedType = e.target.value;
    if (vehicleRecommendation && selectedType !== vehicleRecommendation.type) {
      setDispatchAlert(`System Override Denied: Cargo specifications strictly require a ${vehicleRecommendation.type}.`);
    } else {
      setDispatchAlert(null);
      setDispatchData(prev => ({ ...prev, vehicle_type: selectedType }));
    }
  };

  // Relational Database Emulation and State Management
  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchData.delivery_id) return alert("System Error: Freight ID lost.");

    try {
      const fleetRes = await fetch('http://localhost:5000/api/fleet');
      const currentFleet = await fleetRes.json();
      const existingVehicle = currentFleet.find(v => (v.plate_number || '').trim().toLowerCase() === dispatchData.plate_number.trim().toLowerCase());

      if (existingVehicle) {
        const vehicleId = existingVehicle.vehicle_id || existingVehicle.id;
        const updateRes = await fetch(`http://localhost:5000/api/fleet/${vehicleId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'In Transit', delivery_id: dispatchData.delivery_id })
        });
        if (!updateRes.ok) throw new Error("Could not update vehicle.");
      } else {
        const createRes = await fetch('http://localhost:5000/api/fleet', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...dispatchData, status: 'In Transit' })
        });
        if (!createRes.ok) throw new Error("Could not register vehicle.");
      }

      const cargoRes = await fetch(`http://localhost:5000/api/deliveries/${dispatchData.delivery_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Out for Delivery', total_estimated_time: vehicleRecommendation?.p90Eta || 45 })
      });

      if (!cargoRes.ok) throw new Error("Could not update cargo status.");
      
      setIsDispatchModalOpen(false);
      setDispatchAlert(null);
      setDispatchData({ delivery_id: '', plate_number: '', vehicle_type: 'Prime Mover', driver_name: '' });
      await refreshDashboard();
    } catch (err) { alert(`Dispatch Aborted: ${err.message}`); }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      const response = await fetch(`http://localhost:5000/api/deliveries/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) await refreshDashboard();
    } catch (err) {}
  };

  const handleDelete = async (id) => {
    if (window.confirm("Permanently purge this record?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/deliveries/${id}`, { method: 'DELETE' });
        if (response.ok) await refreshDashboard();
      } catch (err) {}
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Permanently purge ${selectedRows.length} selected records?`)) {
      try {
        const response = await fetch('http://localhost:5000/api/deliveries/bulk-delete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedRows })
        });
        if (response.ok) { setSelectedRows([]); await refreshDashboard(); }
      } catch (err) {}
    }
  };

  const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
  const filteredDeliveries = Array.isArray(deliveries) ? deliveries
    .filter(d => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (d.receiver_name || "").toLowerCase().includes(term) || (d.item_name || "").toLowerCase().includes(term) || (d.delivery_id || "").toString().includes(term);
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
    doc.setFontSize(18); doc.setTextColor(15, 23, 42); doc.text("GILFFC Logistics - Operational Manifest", 14, 22);
    doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.text(`Generated: ${new Date().toLocaleString()} | Auth Operative: ${user.name}`, 14, 30);
    const tableRows = filteredDeliveries.map(d => [ `AWB-${d.delivery_id.toString().padStart(6, '0')}`, d.receiver_name, d.address, d.item_name, d.priority, d.status ]);
    autoTable(doc, { 
      head: [["ID", "Consignee", "Destination", "Cargo Details", "Priority", "Status"]], body: tableRows, startY: 36,
      theme: 'grid', headStyles: { fillColor: [37, 99, 235], textColor: 255 }, alternateRowStyles: { fillColor: [248, 250, 252] }, styles: { cellPadding: 4, fontSize: 9 }
    });
    doc.save(`GILFFC_Manifest_${Date.now()}.pdf`);
  };

  return (
    <div className={`fw-layout ${!isSidebarOpen ? 'sidebar-closed' : ''}`} style={{ background: t.bg, color: t.text1, transition: 'all 0.3s ease' }}>
      
      {/* ADMIN FLOATING SUCCESS TOAST */}
      {successToast && (
        <div style={{ position: 'fixed', top: '24px', right: '50%', transform: 'translateX(50%)', background: '#10b981', color: 'white', padding: '16px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: '800', boxShadow: '0 10px 25px -5px rgba(16,185,129,0.4)', zIndex: 9999, animation: 'slideDown 0.4s ease forwards' }}>
          {successToast}
        </div>
      )}

      <style>{`
        @keyframes slideDown { from { top: -50px; opacity: 0; } to { top: 24px; opacity: 1; } }
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
        
        .fw-search { background: ${t.inputBg} !important; border: 1px solid ${t.border} !important; transition: border-color 0.2s ease; }
        .fw-search:focus-within { border-color: #2563eb !important; }
        .fw-search input { background: transparent !important; color: ${t.text1} !important; border: none !important; }

        .fw-page-header h1 { color: ${t.text1} !important; }
        .fw-page-header p { color: ${t.text2} !important; }

        .fw-kpi-card, .fw-data-panel, .settings-card { background: ${t.card} !important; border: 1px solid ${t.border} !important; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .kpi-value, .panel-title-group h3, .card-header h3, .widget-title, .column-title, .card-client, .cell-primary { color: ${t.text1} !important; }
        .fw-table th { background: ${isDarkMode ? '#020617' : '#f8fafc'} !important; color: ${t.text2} !important; border-bottom: 1px solid ${t.border} !important; }
        .fw-table td { border-bottom: 1px solid ${t.border} !important; color: ${t.text1}; }
        .table-row-hover:hover td { background: ${isDarkMode ? '#1e293b' : '#f8fafc'} !important; }
        .cell-id, .cell-secondary, .card-cargo { color: ${t.text2} !important; }
        
        /* STRICT ALIGNMENT FOR ACTIONS COLUMN */
        .fw-table th.col-actions, .fw-table td.col-actions {
          text-align: right !important;
          padding-right: 24px !important;
        }

        .fw-actions { 
          display: flex; 
          align-items: center; 
          justify-content: flex-end; 
          gap: 8px; 
          width: 100%; 
          margin: 0;
          padding: 0;
        }

        .fw-btn-icon { 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          background: transparent; 
          border: none; 
          font-size: 14px; 
          padding: 4px 0 4px 4px !important; /* Removes right padding so visual edge is flush */
          cursor: pointer; 
          transition: color 0.2s; 
        }
        .fw-btn-icon:hover { color: #ef4444 !important; }
        .fw-select-minimal { padding: 4px 8px; border-radius: 6px; font-size: 12px; outline: none; cursor: pointer; }

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

        .item-spec-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .item-spec-qty { width: 80px !important; }
        .btn-add-item { background: transparent; color: #2563eb; border: 1px dashed #2563eb; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; width: 100%; margin-top: 4px; }
        .btn-add-item:hover { background: rgba(37,99,235,0.1); }
        .btn-remove-item { background: transparent; color: #ef4444; border: none; font-size: 16px; cursor: pointer; padding: 4px; }
      `}</style>

      <aside className="fw-sidebar">
        <div className="fw-brand">
          <div className="brand-titles">
            <h2>GILFFC</h2>
            <span>Logistics OS</span>
          </div>
        </div>
        <div className="fw-nav-section">
          <span className="nav-label" style={{ color: t.text3 }}>Core Operations</span>
          <nav className="fw-nav">
            <button className="nav-btn active" onClick={() => navigate('/dashboard')}>
              Command Center
            </button>
            <button className="nav-btn" onClick={() => navigate('/customer-service')}>
              Comms Terminal
            </button>
            <button className="nav-btn" onClick={() => navigate('/fleet-assets')}>
              Fleet Assets
            </button>
            <button className="nav-btn" onClick={() => navigate('/analytics')}>
              Analytics
            </button>
            <button className="nav-btn" onClick={() => navigate('/account-management')}>
              Account Settings
            </button>
          </nav>
        </div>
        <div className="fw-sidebar-bottom">
          <button className="nav-btn text-danger" onClick={handleLogout}>
            Secure Logout
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
                  <span className="name" style={{ color: t.text1 }}>{user.name || 'Alfrancis'}</span>
                  <span className="role" style={{ color: t.text2 }}>{user.role || 'Administrator'}</span>
                </div>
              </div>
              {isProfileMenuOpen && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-header">
                    <strong>{user.name || 'Alfrancis'}</strong>
                    <span style={{ color: t.text2 }}>{user.email || 'admin@gilffc.global'}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: t.text1, cursor: 'pointer' }} onClick={() => navigate('/account-management')}>Account Settings</button>
                  <button style={{ width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: t.text1, cursor: 'pointer' }} onClick={() => navigate('/account-management')}>Manage Team</button>
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
                <span className="kpi-icon text-amber">◓</span>
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
              </div>
              <div className="panel-actions">
                 {selectedRows.length > 0 && (
                 <>
                   <span className="selection-count" style={{ color: t.text2 }}>{selectedRows.length} selected</span>
                   <button className="fw-btn-outline" style={{color: '#dc2626', borderColor: '#fca5a5', background: isDarkMode ? 'rgba(239,68,68,0.1)' : 'transparent'}} onClick={handleBulkDelete}>✕ Purge Selected</button>
                 </>
                 )}
                <button className="fw-btn-outline" style={{ color: t.text1, borderColor: t.border, background: isDarkMode ? t.bg : 'white' }} onClick={exportToPDF}>Export PDF</button>
              </div>
            </div>
            
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
                    <th className="col-actions">Actions</th>
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
                      <td className="cell-secondary" style={{ color: t.text2 }}>
                        {d.item_name && d.item_name.length > 40 ? `${d.item_name.substring(0, 40)}...` : d.item_name}
                      </td>
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
                      <td className="col-actions">
                        <div className="fw-actions">
                          {d.status === 'Pending' && (
                            <button className="fw-btn-primary" style={{padding: '6px 12px', fontSize: '11px'}} onClick={() => openDispatchModal(d.delivery_id)} disabled={isCalculatingDispatch}>
                              {isCalculatingDispatch && dispatchDelivery?.delivery_id === d.delivery_id ? 'Syncing...' : 'Dispatch'}
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
          </div>
        </div>
      </main>

      {/* GENERATE WAYBILL MODAL */}
      {isModalOpen && (
        <div className="fw-modal-overlay fade-in">
          <div className="fw-modal slide-in" style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h2>Generate New Waybill</h2>
              <button className="fw-icon-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <form onSubmit={handleAddDelivery} className="fw-form">
                <div className="form-group">
                  <label>Consignee (Receiver Name)</label>
                  <input type="text" required placeholder="e.g. Acme Corp" value={formData.receiver_name} onChange={e => setFormData({...formData, receiver_name: e.target.value})} />
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Item Specifications <span style={{color: '#2563eb', fontWeight: 'bold'}}>(AI Priority Enabled)</span></span>
                  </label>
                  
                  {formData.items.map((item, index) => (
                    <div key={index} className="item-spec-row">
                      <input 
                        type="number" 
                        min="1" 
                        required
                        className="item-spec-qty"
                        placeholder="Qty" 
                        value={item.qty} 
                        onChange={e => handleItemChange(index, 'qty', e.target.value)} 
                      />
                      <input 
                        type="text" 
                        required
                        placeholder="Item Name (e.g. Temperature, UN1263...)" 
                        value={item.description} 
                        onChange={e => handleItemChange(index, 'description', e.target.value)} 
                        style={{ flex: 1 }}
                      />
                      {formData.items.length > 1 && (
                        <button type="button" className="btn-remove-item" onClick={() => removeItem(index)} title="Remove Item">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-add-item" onClick={addItem}>+ Add Line Item</button>
                </div>

                <div className="form-row">
                  <div className="form-group half" style={{ position: 'relative' }}>
                    <label>
                      System-Assigned Priority
                      <span 
                        onMouseEnter={() => setShowPriorityHelp(true)} 
                        onMouseLeave={() => setShowPriorityHelp(false)}
                        style={{ marginLeft: '6px', color: '#94a3b8', cursor: 'help', fontSize: '11px', border: '1px solid #94a3b8', borderRadius: '50%', padding: '0 4px' }}
                      >?</span>
                      {showPriorityHelp && (
                        <div style={{ position: 'absolute', bottom: '100%', left: '0', background: isDarkMode ? '#1e293b' : '#0f172a', color: 'white', padding: '12px', borderRadius: '8px', fontSize: '12px', width: '280px', zIndex: 10, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', marginBottom: '8px', lineHeight: '1.5' }}>
                          <strong style={{ color: '#fca5a5' }}>High:</strong> Medical, Emergency, Perishable, Contract, Lab, Electronics<br/>
                          <strong style={{ color: '#fde047' }}>Medium:</strong> Retail, Appliance, Office, Inventory<br/>
                          <strong style={{ color: '#86efac' }}>Low:</strong> Bulk, Sand, Gravel, Marketing, Storage
                        </div>
                      )}
                    </label>
                    <div style={{ padding: '10px 12px', background: formData.priority === 'High' ? (isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2') : formData.priority === 'Low' ? (isDarkMode ? 'rgba(16,185,129,0.1)' : '#ecfdf5') : (isDarkMode ? 'rgba(245,158,11,0.1)' : '#fffbeb'), border: `1px solid ${formData.priority === 'High' ? (isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca') : formData.priority === 'Low' ? (isDarkMode ? 'rgba(16,185,129,0.2)' : '#a7f3d0') : (isDarkMode ? 'rgba(245,158,11,0.2)' : '#fde68a')}`, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

                <div className="form-row">
                  <div className="form-group half">
                    <label>House / Unit No. (Optional)</label>
                    <input type="text" placeholder="e.g. Unit 4B" value={formData.house_number} onChange={e => setFormData({...formData, house_number: e.target.value})} />
                  </div>
                  <div className="form-group half" style={{ position: 'relative' }}>
                    <label>Geocode Street / City</label>
                    <input type="text" required placeholder="Search street or city..." value={addressQuery} onChange={e => setAddressQuery(e.target.value)} />
                    {isSearchingAddress && <div className="address-loader" style={{ color: t.text2 }}>Verifying...</div>}
                    {addressSuggestions.length > 0 && (
                      <div className="address-suggestions" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10 }}>
                        {addressSuggestions.map((item, i) => (
                          <div key={i} className="suggestion-item" onClick={() => selectAddress(item)} style={{ padding: '8px', cursor: 'pointer' }}>
                            ⌖ {item.display_name.substring(0, 45)}...
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="modal-footer" style={{ marginTop: '20px' }}>
                  <button type="button" className="fw-btn-ghost" style={{ color: t.text2 }} onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="fw-btn-primary" disabled={!formData.latitude}>Commit Manifest</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ✅ DISPATCH MODAL */}
      {isDispatchModalOpen && (
        <div className="fw-modal-overlay fade-in">
          <div className="fw-modal slide-in">
            <div className="modal-header">
              <h2>Assign Fleet Unit</h2>
              <button className="fw-icon-btn" onClick={() => { setIsDispatchModalOpen(false); setDispatchAlert(null); }}>✕</button>
            </div>
            
            {vehicleRecommendation && (
              <div style={{ background: isDarkMode ? 'rgba(37,99,235,0.1)' : '#eff6ff', padding: '16px 24px', borderBottom: `1px solid ${isDarkMode ? 'rgba(37,99,235,0.2)' : '#bfdbfe'}`, display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '20px', color: '#38bdf8' }}>◈</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Digital Twin Smart Dispatch</div>
                  <div style={{ fontSize: '13px', color: t.text1, marginTop: '4px', lineHeight: '1.4' }}>
                    Deploy a <strong>{vehicleRecommendation.type}</strong>. {vehicleRecommendation.reason}
                  </div>
                  <div style={{ marginTop: '12px', padding: '12px', background: isDarkMode ? 'rgba(0,0,0,0.3)' : 'white', borderRadius: '8px', border: `1px solid ${isDarkMode ? 'rgba(56,189,248,0.1)' : '#e2e8f0'}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: t.text2, fontWeight: '700', textTransform: 'uppercase' }}>P90 Probabilistic Forecast</span>
                      <span style={{ fontSize: '16px', color: '#10b981', fontWeight: '900' }}>{vehicleRecommendation.p90Eta} mins</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: t.text2, fontWeight: '600' }}>Confidence Interval</span>
                      <span style={{ fontSize: '11px', color: vehicleRecommendation.confidence.includes('Low') ? '#ef4444' : '#38bdf8', fontWeight: '700' }}>{vehicleRecommendation.confidence}</span>
                    </div>
                    <div style={{ height: '1px', background: isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0', margin: '4px 0' }}></div>
                    <div>
                      <span style={{ fontSize: '10px', color: t.text3, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Active Context Layers</span>
                      {vehicleRecommendation.contexts.map((ctx, i) => (
                         <div key={i} style={{ fontSize: '11px', color: t.text1, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                           <span style={{ color: '#2563eb' }}>⌖</span> {ctx}
                         </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-body">
              {dispatchAlert && (
                <div style={{ background: isDarkMode ? 'rgba(239,68,68,0.1)' : '#fef2f2', color: '#ef4444', padding: '12px', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '16px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠</span> {dispatchAlert}
                </div>
              )}

              <form onSubmit={handleDispatch} className="fw-form">
                <div className="form-row">
                  <div className="form-group half">
                    <label>Plate Number</label>
                    <input type="text" placeholder="e.g. ABC-1234" value={dispatchData.plate_number} onChange={e => setDispatchData(prev => ({...prev, plate_number: e.target.value}))} required />
                  </div>
                  <div className="form-group half">
                    <label>Vehicle Type</label>
                    <select className="fw-select" value={dispatchData.vehicle_type} onChange={handleVehicleTypeChange}>
                      <option value="Prime Mover">Prime Mover</option>
                      <option value="Wing Van">Wing Van</option>
                      <option value="Close Van">Close Van</option>
                      <option value="Motorcycle">Motorcycle</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Assigned Driver Name</label>
                  <input type="text" placeholder="Driver Full Name" value={dispatchData.driver_name} onChange={e => setDispatchData(prev => ({...prev, driver_name: e.target.value}))} required />
                </div>
                <div className="modal-footer">
                  <button type="button" className="fw-btn-ghost" style={{ color: t.text2 }} onClick={() => { setIsDispatchModalOpen(false); setDispatchAlert(null); }}>Cancel</button>
                  <button type="submit" className="fw-btn-primary">Launch Unit</button>
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