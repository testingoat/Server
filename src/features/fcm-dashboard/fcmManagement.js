// Extended FCM Management Dashboard - Supports both Sellers and Customers
import { Customer, DeliveryPartner, Seller, Notification } from '../../models/index.js';
import { sendPushNotification, sendBulkPushNotifications } from '../../services/fcmService.js';

export async function getFCMManagementDashboard(request, reply) {
    try {
        // 1. Fetch Token Counts
        const customerTokenCount = await Customer.countDocuments({ fcmToken: { $exists: true, $ne: null } });
        const deliveryPartnerTokenCount = await DeliveryPartner.countDocuments({ fcmToken: { $exists: true, $ne: null } });
        let sellerTokenCount = 0;
        try {
            if (Seller) {
                sellerTokenCount = await Seller.countDocuments({ fcmTokens: { $exists: true, $ne: [] } });
            }
        } catch (e) { console.log('Seller model not available'); }
        const totalTokens = customerTokenCount + deliveryPartnerTokenCount + sellerTokenCount;

        // 2. Fetch Active Tokens
        const customers = await Customer.find({ fcmToken: { $exists: true, $ne: null } }).limit(50).select('name phone fcmToken createdAt').lean();
        const sellers = await Seller.find({ fcmTokens: { $exists: true, $ne: [] } }).limit(50).select('storeName phone fcmTokens').lean();
        const partners = await DeliveryPartner.find({ fcmToken: { $exists: true, $ne: null } }).limit(50).select('name phone email fcmTokens').lean();

        const allTokens = [];

        // Process Customers
        customers.forEach(c => {
            allTokens.push({
                type: 'Customer',
                name: c.name || 'Unknown',
                identifier: c.phone,
                token: c.fcmToken,
                platform: 'Unknown',
                createdAt: c.createdAt
            });
        });

        // Process Sellers
        sellers.forEach(s => {
            if (s.fcmTokens && Array.isArray(s.fcmTokens)) {
                s.fcmTokens.forEach(t => {
                    allTokens.push({
                        type: 'Seller',
                        name: s.storeName || 'Unknown',
                        identifier: s.phone,
                        token: t.token,
                        platform: t.platform || 'android',
                        createdAt: t.createdAt
                    });
                });
            }
        });

        // Process Delivery Partners
        partners.forEach(p => {
            if (p.fcmTokens && Array.isArray(p.fcmTokens)) {
                p.fcmTokens.forEach(t => {
                    allTokens.push({
                        type: 'Delivery',
                        name: p.name || 'Unknown',
                        identifier: p.phone,
                        token: t.token,
                        platform: t.platform || 'android',
                        createdAt: t.createdAt
                    });
                });
            } else if (p.fcmToken && typeof p.fcmToken === 'string') {
                allTokens.push({
                    type: 'Delivery',
                    name: p.name || 'Unknown',
                    identifier: p.phone,
                    token: p.fcmToken,
                    platform: 'Unknown',
                    createdAt: p.createdAt
                });
            }
        });

        // 3. Fetch Notification History
        let notifications = [];
        try {
            notifications = await Notification.find()
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('sellerId', 'storeName')
                .lean();
        } catch (e) { console.log('Error fetching notifications:', e); }


        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GoatGoat FCM Management</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --text-color: #f8fafc;
            --card-bg: rgba(30, 41, 59, 0.7);
            --border-color: rgba(148, 163, 184, 0.1);
            --input-bg: rgba(15, 23, 42, 0.6);
            --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            --accent-color: #8b5cf6;
            --accent-hover: #7c3aed;
            --text-muted: #94a3b8;
            --success-bg: #10b981;
            --danger-bg: #ef4444;
            --glass-border: 1px solid rgba(255, 255, 255, 0.05);
            --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        body.light-mode {
            --bg-color: #f1f5f9;
            --text-color: #1e293b;
            --card-bg: rgba(255, 255, 255, 0.8);
            --border-color: rgba(203, 213, 225, 0.4);
            --input-bg: rgba(255, 255, 255, 0.9);
            --accent-gradient: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            --accent-color: #6366f1;
            --accent-hover: #4f46e5;
            --text-muted: #64748b;
            --glass-border: 1px solid rgba(255, 255, 255, 0.5);
            --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Poppins', sans-serif; 
            background: var(--bg-color); 
            color: var(--text-color); 
            padding: 20px; 
            transition: background 0.5s ease, color 0.5s ease; 
            min-height: 100vh;
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(139, 92, 246, 0.15) 0px, transparent 50%);
            background-attachment: fixed;
        }

        /* Animations */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }

        .container { max-width: 1400px; margin: 0 auto; animation: fadeIn 0.8s ease-out; }
        
        /* Header & Toggle */
        .header { 
            background: var(--accent-gradient); 
            padding: 40px; 
            border-radius: 24px; 
            margin-bottom: 40px; 
            box-shadow: 0 20px 40px -10px rgba(99, 102, 241, 0.3); 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            color: #fff; 
            position: relative;
            overflow: hidden;
            animation: slideUp 0.6s ease-out;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
            animation: float 10s infinite ease-in-out;
        }
        .header-content { position: relative; z-index: 1; }
        .header-content h1 { font-size: 36px; margin-bottom: 10px; font-weight: 700; letter-spacing: -0.5px; }
        .header-content p { opacity: 0.9; font-size: 16px; font-weight: 300; }
        
        .theme-toggle { 
            background: rgba(255,255,255,0.2); 
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3); 
            padding: 12px 24px; 
            border-radius: 50px; 
            color: #fff; 
            cursor: pointer; 
            font-weight: 600; 
            display: flex; 
            align-items: center; 
            gap: 10px; 
            transition: all 0.3s ease; 
            z-index: 1;
            font-family: 'Poppins', sans-serif;
        }
        .theme-toggle:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }

        /* Stats */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 25px; margin-bottom: 40px; }
        .stat-card { 
            background: var(--card-bg); 
            backdrop-filter: blur(12px);
            border: var(--glass-border);
            border-radius: 20px; 
            padding: 30px; 
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            box-shadow: var(--glass-shadow);
            animation: slideUp 0.6s ease-out backwards;
        }
        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.2s; }
        .stat-card:nth-child(3) { animation-delay: 0.3s; }
        .stat-card:nth-child(4) { animation-delay: 0.4s; }
        
        .stat-card:hover { transform: translateY(-10px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.2); border-color: var(--accent-color); }
        .stat-card h3 { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 15px; font-weight: 600; }
        .stat-card .number { font-size: 42px; font-weight: 700; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 5px; }
        .stat-card .label { font-size: 13px; color: var(--text-muted); font-weight: 400; }

        /* Forms & Sections */
        .section { 
            background: var(--card-bg); 
            backdrop-filter: blur(12px);
            border: var(--glass-border);
            border-radius: 24px; 
            padding: 35px; 
            margin-bottom: 30px; 
            box-shadow: var(--glass-shadow);
            animation: slideUp 0.8s ease-out backwards;
            animation-delay: 0.5s;
        }
        .section h2 { 
            font-size: 24px; 
            margin-bottom: 25px; 
            color: var(--text-color); 
            font-weight: 600; 
            display: flex; 
            align-items: center; 
            gap: 10px;
        }
        .section h2::before {
            content: '';
            display: block;
            width: 4px;
            height: 24px;
            background: var(--accent-gradient);
            border-radius: 4px;
        }
        
        .form-group { margin-bottom: 25px; }
        .form-group label { display: block; margin-bottom: 10px; font-weight: 500; color: var(--text-muted); font-size: 14px; }
        .form-group input, .form-group textarea, .form-group select { 
            width: 100%; 
            padding: 15px; 
            background: var(--input-bg); 
            border: 1px solid var(--border-color); 
            border-radius: 12px; 
            color: var(--text-color); 
            font-size: 15px; 
            font-family: 'Poppins', sans-serif;
            transition: all 0.3s ease; 
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus { 
            outline: none; 
            border-color: var(--accent-color); 
            box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1); 
            transform: translateY(-2px);
        }
        .form-group textarea { min-height: 120px; resize: vertical; }
        
        /* Buttons */
        .btn { 
            display: inline-flex; 
            align-items: center;
            justify-content: center;
            padding: 14px 28px; 
            background: var(--accent-gradient); 
            color: #fff; 
            border: none; 
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 15px; 
            font-weight: 600; 
            text-decoration: none; 
            transition: all 0.3s ease; 
            margin-right: 10px; 
            box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
            font-family: 'Poppins', sans-serif;
        }
        .btn:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4); filter: brightness(1.1); }
        .btn:active { transform: translateY(-1px); }
        .btn-secondary { background: #334155; box-shadow: 0 4px 15px rgba(51, 65, 85, 0.3); }
        .btn-secondary:hover { background: #475569; box-shadow: 0 8px 25px rgba(51, 65, 85, 0.4); }
        .btn-danger { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); }
        .btn-danger:hover { box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4); }
        .btn-success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); }
        .btn-success:hover { box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
        .btn-sm { padding: 8px 16px; font-size: 13px; border-radius: 8px; }

        /* Tables */
        .table-container { 
            overflow-x: auto; 
            border-radius: 16px; 
            border: 1px solid var(--border-color);
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 18px 20px; text-align: left; border-bottom: 1px solid var(--border-color); }
        th { 
            background: rgba(0,0,0,0.2); 
            font-weight: 600; 
            color: var(--text-muted); 
            font-size: 12px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
            backdrop-filter: blur(5px);
        }
        body.light-mode th { background: rgba(0,0,0,0.03); }
        td { font-size: 14px; color: var(--text-color); }
        tr { transition: background 0.2s; }
        tr:hover { background: rgba(255,255,255,0.03); }
        body.light-mode tr:hover { background: rgba(0,0,0,0.02); }
        
        .token-cell { 
            font-family: 'Courier New', monospace; 
            max-width: 150px; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            white-space: nowrap; 
            color: var(--accent-color); 
            background: rgba(139, 92, 246, 0.1);
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 13px;
        }
        .badge { padding: 6px 12px; border-radius: 30px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
        .badge-android { background: rgba(164, 198, 57, 0.15); color: #a4c639; border: 1px solid rgba(164, 198, 57, 0.3); }
        .badge-ios { background: rgba(95, 201, 248, 0.15); color: #5fc9f8; border: 1px solid rgba(95, 201, 248, 0.3); }
        .badge-unknown { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
        .badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .result { margin-top: 20px; padding: 20px; border-radius: 12px; display: none; animation: fadeIn 0.4s ease; }
        .result.success { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; }
        .result.error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; }
        
        .nav-links { margin-top: 40px; padding-top: 30px; border-top: 1px solid var(--border-color); display: flex; gap: 15px; flex-wrap: wrap; }
        
        /* Toast Notification */
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: var(--card-bg);
            backdrop-filter: blur(12px);
            border: var(--glass-border);
            padding: 15px 25px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            z-index: 1000;
        }
        .toast.show { transform: translateY(0); opacity: 1; }
        .toast-icon { font-size: 20px; }
        
        @media (max-width: 768px) { 
            .grid-2 { grid-template-columns: 1fr; } 
            .header { flex-direction: column; text-align: center; gap: 20px; padding: 30px; } 
            .stat-card { padding: 20px; }
            .stat-card .number { font-size: 32px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <h1>🔔 FCM Dashboard</h1>
                <p>Manage push notifications for Customers, Sellers, and Delivery Partners</p>
            </div>
            <button class="theme-toggle" id="themeToggle">
                <span id="themeIcon">☀️</span> <span id="themeText">Light Mode</span>
            </button>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Tokens</h3>
                <div class="number">${totalTokens}</div>
                <div class="label">Active FCM Tokens</div>
            </div>
            <div class="stat-card">
                <h3>Customers</h3>
                <div class="number">${customerTokenCount}</div>
                <div class="label">Customer Tokens</div>
            </div>
            <div class="stat-card">
                <h3>Sellers</h3>
                <div class="number">${sellerTokenCount}</div>
                <div class="label">Seller Tokens</div>
            </div>
            <div class="stat-card">
                <h3>Delivery Partners</h3>
                <div class="number">${deliveryPartnerTokenCount}</div>
                <div class="label">Delivery Tokens</div>
            </div>
        </div>

        <!-- Registered Tokens Table -->
        <div class="section">
            <h2>📋 Registered FCM Tokens (Recent 50)</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>User</th>
                            <th>Identifier</th>
                            <th>Platform</th>
                            <th>Created At</th>
                            <th>Token</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allTokens.map((t, index) => `
                        <tr style="animation: fadeIn 0.3s ease-out backwards; animation-delay: ${0.1 + (index * 0.02)}s">
                            <td><span class="badge badge-unknown">${t.type}</span></td>
                            <td style="font-weight: 500;">${t.name}</td>
                            <td>${t.identifier}</td>
                            <td><span class="badge badge-${(t.platform || 'unknown').toLowerCase()}">${t.platform || 'Unknown'}</span></td>
                            <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                            <td class="token-cell" title="${t.token}">${t.token}</td>
                            <td>
                                <button class="btn btn-sm btn-secondary" onclick="copyToken('${t.token}')">Copy</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteToken('${t.token}')">Delete</button>
                            </td>
                        </tr>
                        `).join('')}
                        ${allTokens.length === 0 ? '<tr><td colspan="7" style="text-align:center; padding: 30px; color: var(--text-muted);">No tokens found</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="grid-2">
            <!-- Send to Customers -->
            <div class="section">
                <h2>📱 Send to Customers</h2>
                <form id="customerForm">
                    <div class="form-group">
                        <label>Target</label>
                        <select id="customerTarget" name="target">
                            <option value="all">All Customers</option>
                            <option value="specific">Specific Customer (Phone)</option>
                        </select>
                    </div>
                    <div class="form-group" id="customerPhoneGroup" style="display:none;">
                        <label>Select Customer</label>
                        <select id="customerPhone">
                            <option value="">Choose a customer...</option>
                            ${customers.map(c => `<option value="${c.phone}">${c.name || 'Unknown'} (${c.phone})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="customerTitle" placeholder="Notification title" required>
                    </div>
                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="customerMessage" placeholder="Notification message" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="customerType">
                            <option value="general">General</option>
                            <option value="order">Order Update</option>
                            <option value="delivery">Delivery Update</option>
                            <option value="promotion">Promotion</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-success">Send to Customers</button>
                </form>
                <div id="customerResult" class="result"></div>
            </div>

            <!-- Send to Sellers -->
            <div class="section">
                <h2>🏪 Send to Sellers</h2>
                <form id="sellerForm">
                    <div class="form-group">
                        <label>Target</label>
                        <select id="sellerTarget" name="target">
                            <option value="all">All Sellers</option>
                            <option value="specific">Specific Seller (Phone)</option>
                        </select>
                    </div>
                    <div class="form-group" id="sellerPhoneGroup" style="display:none;">
                        <label>Select Seller</label>
                        <select id="sellerPhone">
                            <option value="">Choose a seller...</option>
                            ${sellers.map(s => `<option value="${s.phone}">${s.storeName || 'Unknown'} (${s.phone})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="sellerTitle" placeholder="Notification title" required>
                    </div>
                    <div class="form-group">
                        <label>Message</label>
                        <textarea id="sellerMessage" placeholder="Notification message" required></textarea>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="sellerType">
                            <option value="general">General</option>
                            <option value="order">New Order</option>
                            <option value="system">System Update</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-success">Send to Sellers</button>
                </form>
                <div id="sellerResult" class="result"></div>
            </div>
        </div>

        <!-- Send to Delivery Partners -->
        <div class="section">
            <h2>🚴 Send to Delivery Partners</h2>
            <form id="deliveryForm">
                <div class="grid-2">
                    <div class="form-group">
                        <label>Target</label>
                        <select id="deliveryTarget" name="target">
                            <option value="all">All Delivery Partners</option>
                            <option value="specific">Specific Partner (Email)</option>
                        </select>
                    </div>
                    <div class="form-group" id="deliveryEmailGroup" style="display:none;">
                        <label>Select Delivery Partner</label>
                        <select id="deliveryEmail">
                            <option value="">Choose a partner...</option>
                            ${partners.map(p => `<option value="${p.email || p.phone}">${p.name || 'Unknown'} (${p.email || p.phone || 'No contact'})</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="grid-2">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="deliveryTitle" placeholder="Notification title" required>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="deliveryType">
                            <option value="general">General</option>
                            <option value="order">New Delivery</option>
                            <option value="system">System Update</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="deliveryMessage" placeholder="Notification message" required></textarea>
                </div>
                <button type="submit" class="btn btn-success">Send to Delivery Partners</button>
            </form>
            <div id="deliveryResult" class="result"></div>
        </div>

        <!-- Notification History Table -->
        <div class="section">
            <h2>📈 Notification History (Recent 50)</h2>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Title</th>
                            <th>Message</th>
                            <th>Type</th>
                            <th>Target (Seller)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${notifications.map((n, index) => `
                        <tr style="animation: fadeIn 0.3s ease-out backwards; animation-delay: ${0.1 + (index * 0.02)}s">
                            <td>${new Date(n.createdAt).toLocaleString()}</td>
                            <td style="font-weight: 500;">${n.title}</td>
                            <td style="color: var(--text-muted);">${n.message}</td>
                            <td><span class="badge badge-unknown">${n.type}</span></td>
                            <td>${n.sellerId ? n.sellerId.storeName : 'Unknown'}</td>
                            <td>${n.isRead ? '<span class="badge badge-success">Read</span>' : '<span class="badge badge-unknown">Unread</span>'}</td>
                        </tr>
                        `).join('')}
                         ${notifications.length === 0 ? '<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--text-muted);">No history found</td></tr>' : ''}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="nav-links">
            <a href="/admin" class="btn btn-secondary">← Back to Admin</a>
            <a href="/admin/monitoring/dashboard" class="btn btn-secondary">📊 Monitoring</a>
            <a href="/api/notifications/fcm-status" class="btn btn-secondary" target="_blank">🔍 FCM Status</a>
        </div>
    </div>
    
    <div id="toast" class="toast">
        <span class="toast-icon">✅</span>
        <span id="toastMessage">Message goes here</span>
    </div>

    <script>
        // Theme Toggle Logic
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        const themeText = document.getElementById('themeText');
        const body = document.body;

        // Check local storage
        if (localStorage.getItem('theme') === 'light') {
            body.classList.add('light-mode');
            updateThemeUI(true);
        }

        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            const isLight = body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            updateThemeUI(isLight);
        });

        function updateThemeUI(isLight) {
            if (isLight) {
                themeIcon.textContent = '🌙';
                themeText.textContent = 'Dark Mode';
            } else {
                themeIcon.textContent = '☀️';
                themeText.textContent = 'Light Mode';
            }
        }

        // Toast Notification
        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toastMessage');
            const toastIcon = document.querySelector('.toast-icon');
            
            toastMessage.textContent = message;
            toastIcon.textContent = type === 'success' ? '✅' : '⚠️';
            
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Copy Token Function
        function copyToken(token) {
            navigator.clipboard.writeText(token).then(() => {
                showToast('Token copied to clipboard!');
            }).catch(err => {
                console.error('Failed to copy: ', err);
                showToast('Failed to copy token', 'error');
            });
        }

        // Delete Token Function
        function deleteToken(token) {
            if(confirm('Are you sure you want to delete this token? This action cannot be undone.')) {
                // Since we don't have a specific delete endpoint yet, we'll log it.
                console.log('Deleting token:', token);
                showToast('Delete request sent (Simulation)', 'success');
            }
        }

        // Show/hide specific target fields
        document.getElementById('customerTarget').addEventListener('change', (e) => {
            document.getElementById('customerPhoneGroup').style.display = e.target.value === 'specific' ? 'block' : 'none';
        });
        document.getElementById('sellerTarget').addEventListener('change', (e) => {
            document.getElementById('sellerPhoneGroup').style.display = e.target.value === 'specific' ? 'block' : 'none';
        });
        document.getElementById('deliveryTarget').addEventListener('change', (e) => {
            document.getElementById('deliveryEmailGroup').style.display = e.target.value === 'specific' ? 'block' : 'none';
        });

        // Helper to handle form submission
        async function handleFormSubmit(e, endpoint, resultId) {
            e.preventDefault();
            const form = e.target;
            const resultDiv = document.getElementById(resultId);
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            
            // Loading state
            submitBtn.textContent = 'Sending...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
            
            const formData = new FormData(form);
            const data = {};
            formData.forEach((value, key) => data[key] = value);
            
            // Handle specific fields manually if needed (since we're not using name attrs everywhere)
            // Actually the previous code used IDs to get values, let's stick to that for consistency with the original logic
            // but adapt to the generic handler
            
            // Reverting to specific ID selection to ensure compatibility with previous logic
            // (The previous implementation didn't use name attributes for all inputs)
            
            return false; // We'll use the specific handlers below
        }

        // Customer Form Submit
        document.getElementById('customerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Sending...';
            btn.disabled = true;

            const resultDiv = document.getElementById('customerResult');
            const target = document.getElementById('customerTarget').value;
            const phone = document.getElementById('customerPhone').value;
            const title = document.getElementById('customerTitle').value;
            const message = document.getElementById('customerMessage').value;
            const type = document.getElementById('customerType').value;

            try {
                const response = await fetch('/api/fcm/send-to-customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, phone, title, message, type })
                });
                const data = await response.json();
                resultDiv.className = 'result ' + (data.success ? 'success' : 'error');
                resultDiv.textContent = data.message || JSON.stringify(data);
                resultDiv.style.display = 'block';
                if(data.success) showToast('Notification sent successfully!');
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
                resultDiv.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });

        // Seller Form Submit
        document.getElementById('sellerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Sending...';
            btn.disabled = true;

            const resultDiv = document.getElementById('sellerResult');
            const target = document.getElementById('sellerTarget').value;
            const phone = document.getElementById('sellerPhone').value;
            const title = document.getElementById('sellerTitle').value;
            const message = document.getElementById('sellerMessage').value;
            const type = document.getElementById('sellerType').value;

            try {
                const response = await fetch('/api/fcm/send-to-sellers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, phone, title, message, type })
                });
                const data = await response.json();
                resultDiv.className = 'result ' + (data.success ? 'success' : 'error');
                resultDiv.textContent = data.message || JSON.stringify(data);
                resultDiv.style.display = 'block';
                if(data.success) showToast('Notification sent successfully!');
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
                resultDiv.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });

        // Delivery Form Submit
        document.getElementById('deliveryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Sending...';
            btn.disabled = true;

            const resultDiv = document.getElementById('deliveryResult');
            const target = document.getElementById('deliveryTarget').value;
            const email = document.getElementById('deliveryEmail').value;
            const title = document.getElementById('deliveryTitle').value;
            const message = document.getElementById('deliveryMessage').value;
            const type = document.getElementById('deliveryType').value;

            try {
                const response = await fetch('/api/fcm/send-to-delivery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target, email, title, message, type })
                });
                const data = await response.json();
                resultDiv.className = 'result ' + (data.success ? 'success' : 'error');
                resultDiv.textContent = data.message || JSON.stringify(data);
                resultDiv.style.display = 'block';
                if(data.success) showToast('Notification sent successfully!');
            } catch (error) {
                resultDiv.className = 'result error';
                resultDiv.textContent = 'Error: ' + error.message;
                resultDiv.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    </script>
</body>
</html>`;

        reply.type('text/html').send(html);
    } catch (error) {
        console.error('FCM Dashboard error:', error);
        reply.status(500).send({ error: 'Failed to load FCM dashboard', message: error.message });
    }
}

// API endpoint to send notifications to customers
export async function sendToCustomers(request, reply) {
    try {
        const { target, phone, title, message, type } = request.body;

        if (target === 'all') {
            // Broadcast to all customers
            const customers = await Customer.find({ fcmToken: { $exists: true, $ne: null } });
            const tokens = customers.map(c => c.fcmToken).filter(t => t);

            if (tokens.length === 0) {
                return reply.send({ success: false, message: 'No customer tokens found' });
            }

            const result = await sendBulkPushNotifications(tokens, {
                title,
                body: message,
                data: { type }
            });

            return reply.send({
                success: true,
                message: `Sent to ${result.successCount}/${tokens.length} customers`,
                details: result
            });
        } else {
            // Send to specific customer
            const customer = await Customer.findOne({ phone: parseInt(phone) });
            if (!customer || !customer.fcmToken) {
                return reply.send({ success: false, message: 'Customer not found or no FCM token' });
            }

            const result = await sendPushNotification(customer.fcmToken, {
                title,
                body: message,
                data: { type }
            });

            return reply.send({ success: true, message: 'Notification sent to customer', details: result });
        }
    } catch (error) {
        console.error('Send to customers error:', error);
        return reply.status(500).send({ success: false, message: error.message });
    }
}

// API endpoint to send notifications to sellers
export async function sendToSellers(request, reply) {
    try {
        const { target, phone, title, message, type } = request.body;

        if (target === 'all') {
            // Broadcast to all sellers
            const sellers = await Seller.find({ fcmTokens: { $exists: true, $ne: [] } });
            const tokens = sellers.flatMap(s => s.fcmTokens || []).filter(t => t);

            if (tokens.length === 0) {
                return reply.send({ success: false, message: 'No seller tokens found' });
            }

            const result = await sendBulkPushNotifications(tokens, {
                title,
                body: message,
                data: { type }
            });

            return reply.send({
                success: true,
                message: `Sent to ${result.successCount}/${tokens.length} sellers`,
                details: result
            });
        } else {
            // Send to specific seller
            const seller = await Seller.findOne({ phone: parseInt(phone) });
            if (!seller || !seller.fcmTokens || seller.fcmTokens.length === 0) {
                return reply.send({ success: false, message: 'Seller not found or no FCM tokens' });
            }

            const result = await sendBulkPushNotifications(seller.fcmTokens, {
                title,
                body: message,
                data: { type }
            });

            return reply.send({ success: true, message: 'Notification sent to seller', details: result });
        }
    } catch (error) {
        console.error('Send to sellers error:', error);
        return reply.status(500).send({ success: false, message: error.message });
    }
}

// API endpoint to send notifications to delivery partners
export async function sendToDelivery(request, reply) {
    try {
        const { target, email, title, message, type } = request.body;

        if (target === 'all') {
            // Broadcast to all delivery partners
            const partners = await DeliveryPartner.find({ fcmToken: { $exists: true, $ne: null } });
            const tokens = partners.map(p => p.fcmToken).filter(t => t);

            if (tokens.length === 0) {
                return reply.send({ success: false, message: 'No delivery partner tokens found' });
            }

            const result = await sendBulkPushNotifications(tokens, {
                title,
                body: message,
                data: { type }
            });

            return reply.send({
                success: true,
                message: `Sent to ${result.successCount}/${tokens.length} delivery partners`,
                details: result
            });
        } else {
            // Send to specific delivery partner
            const partner = await DeliveryPartner.findOne({ email });
            if (!partner || !partner.fcmToken) {
                return reply.send({ success: false, message: 'Delivery partner not found or no FCM token' });
            }

            const result = await sendPushNotification(partner.fcmToken, {
                title,
                body: message,
                data: { type }
            });

            return reply.send({ success: true, message: 'Notification sent to delivery partner', details: result });
        }
    } catch (error) {
        console.error('Send to delivery error:', error);
        return reply.status(500).send({ success: false, message: error.message });
    }
}
