const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');

/**
 * GILFFC LOGISTICS OS - BACKEND ENGINE
 * Version: 2.9.0 (Enterprise Full Stack)
 * Status: Operational
 * Description: Real-time logistics management with Geocoding and Traffic Analytics.
 */

const app = express();

// --- MIDDLEWARE CONFIGURATION ---
// Enable Cross-Origin Resource Sharing for frontend communication
app.use(cors());

// Configure Body Parser for large JSON payloads
app.use(bodyParser.json({ 
  limit: '50mb' 
}));

// Standard JSON parsing middleware
app.use(express.json());

// URL-encoded data handling
app.use(express.urlencoded({ 
  extended: true 
}));

// --- DATABASE INFRASTRUCTURE ---
// Establish high-performance connection pool to MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '#GROUP1PROFELECT',
  database: 'gilffc_db',
  port: 3306
});

// Database Connectivity Check
db.connect((err) => {
  if (err) {
    console.log('--------------------------------------------------');
    console.error('CRITICAL SYSTEM FAILURE: MySQL Connection Refused');
    console.error('Error Code:', err.code);
    console.error('Message:', err.message);
    console.log('--------------------------------------------------');
  } else {
    console.log('--------------------------------------------------');
    console.log('✓ SYSTEM ONLINE: GILFFC MySQL Database Link Active');
    console.log('✓ Port: 3306');
    console.log('✓ Host: localhost');
    console.log('--------------------------------------------------');
  }
});

/* -------------------------------------------------------------------------- */
/* 1. AUTHENTICATION & SECURITY MODULE                                        */
/* -------------------------------------------------------------------------- */

// Administrative Login Endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const q = 'SELECT * FROM users WHERE email = ?';

  db.query(q, [email], async (err, results) => {
    if (err) {
      console.error("AUTH_ERROR:", err.message);
      return res.status(500).json({ 
        error: "Secure Vault Error" 
      });
    }

    if (results.length === 0) {
      return res.status(401).json({ 
        message: "Invalid Operative Credentials" 
      });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      console.log(`✓ SESSION STARTED: ${user.full_name} | Role: ${user.role}`);
      res.json({
        user: {
          id: user.user_id,
          name: user.full_name,
          email: user.email,
          role: user.role || 'Administrator'
        }
      });
    } else {
      res.status(401).json({ 
        message: "Invalid Operative Credentials" 
      });
    }
  });
});

// New Operative Registration
app.post('/api/auth/register', async (req, res) => {
  const { full_name, email, password } = req.body;
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const q = `INSERT INTO users 
               (full_name, email, password_hash, role) 
               VALUES (?, ?, ?, ?)`;

    db.query(q, [full_name, email, hashedPassword, 'Administrator'], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ 
            message: "Email already registered." 
          });
        }
        return res.status(500).json({ 
          error: err.message 
        });
      }
      console.log(`✓ OPERATIVE CREATED: ${full_name}`);
      res.status(201).json({ 
        message: "Account Synchronized" 
      });
    });
  } catch (err) {
    res.status(500).json({ 
      error: "Encryption Layer Failure" 
    });
  }
});

// ADDED: Secure Password Reset Endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    const q = 'UPDATE users SET password_hash = ? WHERE email = ?';
    db.query(q, [hashedPassword, email], (err) => {
      if (err) {
        console.error("RESET_PWD_ERROR:", err.message);
        return res.status(500).json({ error: "Vault Update Failed" });
      }
      console.log(`✓ SECURITY UPDATE: Password changed for ${email}`);
      res.json({ message: "Encryption Key Re-generated" });
    });
  } catch (e) {
    res.status(500).json({ error: "Server Encryption Error" });
  }
});

/* -------------------------------------------------------------------------- */
/* 2. FREIGHT OPERATIONS (ADMINISTRATIVE)                                      */
/* -------------------------------------------------------------------------- */

// Global Manifest Fetch
app.get('/api/deliveries', (req, res) => {
  const q = 'SELECT * FROM deliveries ORDER BY delivery_id DESC';
  
  db.query(q, (err, results) => {
    if (err) {
      console.error("FETCH_ERROR:", err.message);
      return res.status(500).json([]);
    }
    res.json(results);
  });
});

// Waybill Generation Endpoint
app.post('/api/deliveries', (req, res) => {
  const { 
    receiver_name, 
    item_name, 
    address, 
    priority, 
    status, 
    latitude, 
    longitude 
  } = req.body;
  
  const q = `INSERT INTO deliveries 
             (receiver_name, item_name, address, priority, status, latitude, longitude) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`;
  
  const values = [
    receiver_name, 
    item_name, 
    address, 
    priority || 'Medium', 
    status || 'Pending',
    latitude || null,
    longitude || null
  ];

  db.query(q, values, (err, result) => {
    if (err) {
      console.error("COMMIT_ERROR:", err.message);
      return res.status(500).json({ 
        error: err.message 
      });
    }
    console.log(`✓ AWB GENERATED: ${result.insertId} | Geotag: ${latitude ? 'Active' : 'None'}`);
    res.status(201).json({ 
      id: result.insertId, 
      message: "Committed to Manifest" 
    });
  });
});

// Logistics Status Migration
app.put('/api/deliveries/:id', (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  const q = 'UPDATE deliveries SET status = ? WHERE delivery_id = ?';

  db.query(q, [status, id], (err) => {
    if (err) {
      return res.status(500).json({ 
        error: err.message 
      });
    }
    console.log(`✓ AWB-${id}: Transitioned to ${status}`);
    res.json({ 
      message: 'Status Synchronized' 
    });
  });
});

// Single Record Purge
app.delete('/api/deliveries/:id', (req, res) => {
  const q = 'DELETE FROM deliveries WHERE delivery_id = ?';
  
  db.query(q, [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ 
        error: err.message 
      });
    }
    console.log(`⚠ DATA PURGE: AWB-${req.params.id} removed.`);
    res.json({ 
      message: 'Record Purged' 
    });
  });
});

// ADDED: Bulk Data Wipe Endpoint (Danger Zone)
app.post('/api/deliveries/bulk-delete', (req, res) => {
  if (req.body.ids === 'ALL_WIPE_COMMAND') {
    db.query('DELETE FROM deliveries', (err) => {
      if (err) return res.status(500).json({ error: err.message });
      console.log('⚠ CRITICAL: Database Manifest Wiped by Admin');
      res.json({ message: "System Purged" });
    });
  } else {
    res.status(403).json({ error: "Unauthorized Purge" });
  }
});

/* -------------------------------------------------------------------------- */
/* 3. FLEET ASSET MANAGEMENT                                                   */
/* -------------------------------------------------------------------------- */

// Fleet Status Retrieval
app.get('/api/fleet', (req, res) => {
  const q = 'SELECT * FROM fleet ORDER BY vehicle_id DESC';
  
  db.query(q, (err, results) => {
    if (err) {
      return res.status(500).json([]);
    }
    res.json(results);
  });
});

// Active Deployment & Driver Link
app.post('/api/fleet', (req, res) => {
  const { 
    plate_number, 
    vehicle_type, 
    driver_name, 
    status, 
    delivery_id 
  } = req.body;
  
  const dbStatus = status || 'Available';
  
  const q = `INSERT INTO fleet 
             (plate_number, vehicle_type, driver_name, status, delivery_id) 
             VALUES (?, ?, ?, ?, ?)`;

  db.query(q, [plate_number, vehicle_type, driver_name, dbStatus, delivery_id || null], (err, result) => {
    if (err) {
      console.error("FLEET_ERROR:", err.message);
      return res.status(500).json({ 
        error: err.message 
      });
    }
    console.log(`✓ DISPATCH: VHL-${result.insertId} assigned to AWB-${delivery_id}`);
    res.status(201).json({ 
      id: result.insertId, 
      message: "Deployment Successful" 
    });
  });
});

// Full Fleet Synchronization (Handles Status & Delivery Link clearing)
app.put('/api/fleet/:id', (req, res) => {
  const { status, delivery_id } = req.body;
  
  const q = 'UPDATE fleet SET status = ?, delivery_id = ? WHERE vehicle_id = ?';

  db.query(q, [status, delivery_id !== undefined ? delivery_id : null, req.params.id], (err, result) => {
    if (err) {
      console.error("FLEET UPDATE FAILURE:", err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✓ FLEET RECALIBRATED: VHL-${req.params.id} marked as ${status}`);
    res.json({ message: 'Fleet unit synchronized.' });
  });
});

// Asset Decommissioning
app.delete('/api/fleet/:id', (req, res) => {
  const q = 'DELETE FROM fleet WHERE vehicle_id = ?';
  
  db.query(q, [req.params.id], (err) => {
    if (err) {
      return res.status(500).json({ 
        error: err.message 
      });
    }
    res.json({ 
      message: 'Unit Removed from Roster' 
    });
  });
});

/* -------------------------------------------------------------------------- */
/* 4. CLIENT INTERFACE (USER PORTAL)                                           */
/* -------------------------------------------------------------------------- */

// Public Tracking Verification via POST
app.post('/api/user/verify', (req, res) => {
  const { tracking_number, receiver_name } = req.body;
  
  // Smart filter: Strips "AWB-" and leading zeros (e.g. 000016 -> 16)
  const deliveryId = String(tracking_number).replace(/^AWB-/i, '').replace(/^0+/, '');
  const q = 'SELECT * FROM deliveries WHERE delivery_id = ? AND LOWER(receiver_name) = LOWER(?)';
  
  db.query(q, [deliveryId, (receiver_name || "").trim()], (err, results) => {
    if (err) {
      console.error("VERIFY_ERROR:", err.message);
      return res.status(500).json({ error: "Database Link Error" });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ error: "Invalid Waybill ID or Consignee Name" });
    }

    console.log(`✓ CLIENT SECURE LOGIN: AWB-${deliveryId} accessed by ${receiver_name}`);
    res.json({ 
      delivery_id: results[0].delivery_id, 
      receiver_name: results[0].receiver_name 
    });
  });
});

// Public Tracking Verification via GET (Standardized for Leading Zeros)
app.get('/api/user/track', (req, res) => {
  const { id, name } = req.query;

  if (!id || !name) {
    return res.status(400).json({ error: "Missing Waybill ID or Consignee Name" });
  }

  // Normalization: Strips "AWB-" and leading zeros (e.g. 000016 -> 16)
  const deliveryId = String(id).replace(/^AWB-/i, '').replace(/^0+/, '');
  console.log(`🔍 LOGISTICS QUERY: Normalized ID: ${deliveryId} | Name: ${name}`);

  const q = 'SELECT * FROM deliveries WHERE delivery_id = ? AND LOWER(receiver_name) = LOWER(?)';
  
  db.query(q, [deliveryId, name.trim()], (err, results) => {
    if (err) {
      console.error("TRACK_ERROR:", err.message);
      return res.status(500).json({ error: "Database Link Error" });
    }
    
    if (results.length === 0) {
      console.log(`✕ TRACKING FAILED: No record for ID ${deliveryId}`);
      return res.status(404).json({ error: "Invalid Waybill ID or Consignee Name" });
    }

    console.log(`✓ TRACKING SUCCESS: AWB-${deliveryId} verified.`);
    res.json({ 
      delivery_id: results[0].delivery_id, 
      receiver_name: results[0].receiver_name 
    });
  });
});


// Live Telemetry Sync for Consignee
app.get('/api/user/shipment/:id', (req, res) => {
  const q = 'SELECT * FROM deliveries WHERE delivery_id = ?';
  
  db.query(q, [req.params.id], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ 
        error: "Link Terminated" 
      });
    }
    res.json(results[0]);
  });
});

// SUPREME DEBUG TRENDS ENDPOINT (Updated to fix ONLY_FULL_GROUP_BY)
app.get('/api/analytics/trends', (req, res) => {
  console.log("📊 ANALYTICS TRENDS REQUEST RECEIVED");
  
  const q = `
    SELECT 
      DATE_FORMAT(MIN(created_at), '%a') as date, 
      COUNT(*) as count 
    FROM deliveries 
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
    GROUP BY DATE(created_at)
    ORDER BY MIN(created_at) ASC
  `;

  db.query(q, (err, results) => {
    if (err) {
      console.error("❌ SQL ERROR IN TRENDS:", err.code, err.message);
      return res.status(500).json({ error: err.message, code: err.code });
    }
    console.log(`✅ TRENDS SYNCED: Outputting ${results.length} results.`);
    res.json(results);
  });
});

// ADDED: Fetch Global Team Roster
app.get('/api/users', (req, res) => {
  const q = 'SELECT user_id, full_name, email, role FROM users ORDER BY user_id DESC';
  db.query(q, (err, results) => {
    if (err) {
      console.error("ROSTER_FETCH_ERROR:", err.message);
      return res.status(500).json({ error: "Roster Sync Failed" });
    }
    res.json(results);
  });
});

// ADDED: Fetch Specific Operative Profile
app.get('/api/user/profile/:id', (req, res) => {
  const q = 'SELECT user_id, full_name, email, role FROM users WHERE user_id = ?';
  db.query(q, [req.params.id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(results[0]);
  });
});

// ADDED: Update Operative Profile Details
app.put('/api/user/profile/:id', (req, res) => {
  const { full_name, email } = req.body;
  const q = 'UPDATE users SET full_name = ?, email = ? WHERE user_id = ?';
  db.query(q, [full_name, email, req.params.id], (err) => {
    if (err) {
      console.error("UPDATE_PROFILE_ERROR:", err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log(`✓ PROFILE SYNC: ${full_name} updated.`);
    res.json({ message: "Profile Updated" });
  });
});

// NEW: Global Comms Fetch (For Customer Service Terminal sync)
app.get('/api/messages', (req, res) => {
  const q = 'SELECT * FROM messages ORDER BY timestamp ASC';
  
  db.query(q, (err, results) => {
    if (err) {
      console.error("GLOBAL_MSG_FETCH_ERROR:", err.message);
      return res.status(500).json([]);
    }
    res.json(results);
  });
});

// Comms Uplink (Specific shipment messages)
app.get('/api/messages/:deliveryId', (req, res) => {
  const q = 'SELECT * FROM messages WHERE delivery_id = ? ORDER BY timestamp ASC';
  
  db.query(q, [req.params.deliveryId], (err, results) => {
    if (err) return res.json([]);
    res.json(results);
  });
});

// NEW: Mark messages as read (clears notifications/badges)
app.put('/api/messages/read/:deliveryId', (req, res) => {
  const { deliveryId } = req.params;
  const { role } = req.body; // 'Admin' or 'User'

  // If Admin opens, mark client messages as read. If User opens, mark Admin messages as read.
  const q = role === 'Admin' 
    ? 'UPDATE messages SET is_read = TRUE WHERE delivery_id = ? AND sender_name != "Admin"'
    : 'UPDATE messages SET is_read = TRUE WHERE delivery_id = ? AND sender_name = "Admin"';

  db.query(q, [deliveryId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Comms Cleared' });
  });
});

// Comms Transmission
app.post('/api/messages', (req, res) => {
  const { 
    sender_name, 
    receiver_name, 
    message_text, 
    delivery_id 
  } = req.body;
  
  const q = `INSERT INTO messages 
             (sender_name, receiver_name, message_text, delivery_id) 
             VALUES (?, ?, ?, ?)`;
             
  db.query(q, [sender_name, receiver_name, message_text, delivery_id], (err) => {
    if (err) {
      return res.status(500).json({ 
        error: "Transmission Failed" 
      });
    }
    res.status(201).json({ 
      message: 'Comms Active' 
    });
  });
});

/* -------------------------------------------------------------------------- */
/* 5. SYSTEM ANALYTICS & MONITORING                                            */
/* -------------------------------------------------------------------------- */

app.get('/api/stats', (req, res) => {
  console.log("📈 ANALYTICS STATS REQUEST RECEIVED");
  const q = `SELECT 
    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
    SUM(CASE WHEN status = 'Out for Delivery' THEN 1 ELSE 0 END) as outForDelivery,
    SUM(CASE WHEN status = 'Done' THEN 1 ELSE 0 END) as delivered
    FROM deliveries`;

  db.query(q, (err, results) => {
    if (err) {
      console.error("❌ STATS ERROR:", err.message);
      return res.json({ 
        pending: 0, 
        outForDelivery: 0, 
        delivered: 0 
      });
    }
    const stats = results[0];
    res.json({
      pending: parseInt(stats.pending) || 0,
      outForDelivery: parseInt(stats.outForDelivery) || 0,
      delivered: parseInt(stats.delivered) || 0
    });
  });
});

/* -------------------------------------------------------------------------- */
/* SERVER ACTIVATION                                                          */
/* -------------------------------------------------------------------------- */

const PORT = 5000;
app.listen(PORT, () => {
  console.log('--------------------------------------------------');
  console.log(`✓ GILFFC LOGISTICS OS BACKEND: ONLINE`);
  console.log(`✓ LISTENING ON PORT: ${PORT}`);
  console.log(`✓ DATE: ${new Date().toLocaleString()}`);
  console.log('--------------------------------------------------');
});