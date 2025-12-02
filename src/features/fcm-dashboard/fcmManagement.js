// Extended FCM Management Dashboard - Supports both Sellers and Customers
import { Customer, DeliveryPartner, Seller, Notification, CustomerNotification, NotificationLog } from '../../models/index.js';
import { sendPushNotification, sendBulkPushNotifications } from '../../services/fcmService.js';

export async function getFCMManagementDashboard(request, reply) {
    try {
        // 1. Fetch Token Counts
        const customerTokenCount = await Customer.countDocuments({ 'fcmTokens.0': { $exists: true } });
        const deliveryPartnerTokenCount = await DeliveryPartner.countDocuments({ 'fcmTokens.0': { $exists: true } });
        let sellerTokenCount = 0;
        try {
            if (Seller) {
                sellerTokenCount = await Seller.countDocuments({ fcmTokens: { $exists: true, $ne: [] } });
            }
        } catch (e) { console.log('Seller model not available'); }
        const totalTokens = customerTokenCount + deliveryPartnerTokenCount + sellerTokenCount;

        // 2. Fetch Active Tokens
        const customers = await Customer.find({ 'fcmTokens.0': { $exists: true } })
            .limit(50)
            .select('name phone email fcmTokens fcmToken createdAt')
            .lean();
        const sellers = await Seller.find({ fcmTokens: { $exists: true, $ne: [] } }).limit(50).select('storeName phone fcmTokens').lean();
        const partners = await DeliveryPartner.find({ 'fcmTokens.0': { $exists: true } })
            .limit(50)
            .select('name phone email fcmTokens fcmToken createdAt')
            .lean();

        const allTokens = [];

        // Process Customers
        customers.forEach(c => {
            if (Array.isArray(c.fcmTokens)) {
                c.fcmTokens.forEach(t => {
                    if (!t?.token) {
                        return;
                    }
                    allTokens.push({
                        type: 'Customer',
                        name: c.name || 'Unknown',
                        identifier: c.phone || c.email,
                        token: t.token,
                        platform: t.platform || 'android',
                        createdAt: t.createdAt || c.createdAt,
                        _id: t._id
                    });
                });
            } else if (c.fcmToken) {
                allTokens.push({
                    type: 'Customer',
                    name: c.name || 'Unknown',
                    identifier: c.phone || c.email,
                    token: c.fcmToken,
                    platform: 'Unknown',
                    createdAt: c.createdAt
                });
            }
        });

        // Process Sellers
        sellers.forEach(s => {
            if (s.fcmTokens && Array.isArray(s.fcmTokens)) {
                s.fcmTokens.forEach(t => {
                    if (!t?.token) {
                        return;
                    }
                    allTokens.push({
                        type: 'Seller',
                        name: s.storeName || 'Unknown',
                        identifier: s.phone || s.email,
                        token: t.token,
                        platform: t.platform || 'android',
                        createdAt: t.createdAt,
                        _id: t._id
                    });
                });
            }
        });

        // Process Delivery Partners
        partners.forEach(p => {
            if (p.fcmTokens && Array.isArray(p.fcmTokens)) {
                p.fcmTokens.forEach(t => {
                    if (!t?.token) {
                        return;
                    }
                    allTokens.push({
                        type: 'Delivery',
                        name: p.name || 'Unknown',
                        identifier: p.phone || p.email,
                        token: t.token,
                        platform: t.platform || 'android',
                        createdAt: t.createdAt || p.createdAt,
                        _id: t._id
                    });
                });
            } else if (p.fcmToken && typeof p.fcmToken === 'string') {
                allTokens.push({
                    type: 'Delivery',
                    name: p.name || 'Unknown',
                    identifier: p.phone || p.email,
                    token: p.fcmToken,
                    platform: 'Unknown',
                    createdAt: p.createdAt
                });
            }
        });

        // 3. Fetch Notification History (NotificationLog - unified for customers/sellers/delivery)
        let historyLogs = [];
        try {
            historyLogs = await NotificationLog.find()
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
        } catch (e) {
            console.log('Error fetching notification history:', e);
        }

        const normalizeTarget = (targeting) => {
            switch ((targeting || '').toString()) {
                case 'customers':
                case 'buyers':
                    return 'customers';
                case 'sellers':
                    return 'sellers';
                case 'delivery':
                    return 'delivery partners';
                case 'all':
                    return 'all users';
                case 'specific-customer':
                    return 'customer (specific)';
                case 'specific-seller':
                    return 'seller (specific)';
                case 'specific-delivery':
                    return 'delivery partner (specific)';
                case 'specific-token':
                    return 'token (specific)';
                default:
                    return targeting || 'unknown';
            }
        };

        const historyRows = historyLogs.map((log, index) => {
            const payload = log.payload || {};
            const data = payload.data || {};
            const type = (data.type || 'system').toString().toUpperCase();
            return {
                createdAt: log.createdAt,
                title: payload.title || 'Notification',
                message: payload.body || '',
                type,
                target: normalizeTarget(log.targeting),
                status: log.status || 'unknown',
                index
            };
        });


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
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Notification Type</label>
                            <select id="customerType">
                                <option value="system">System</option>
                                <option value="promotion">Promotion</option>
                                <option value="order">Order</option>
                                <option value="delivery">Delivery</option>
                                <option value="admin_broadcast">Admin Broadcast</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Image URL (optional)</label>
                            <input type="text" id="customerImageUrl" placeholder="https://cdn.example.com/banner.png">
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Target Screen (optional)</label>
                            <input type="text" id="customerTargetScreen" placeholder="e.g. OrdersScreen, LiveTracking">
                        </div>
                        <div class="form-group">
                            <label>Order ID (optional)</label>
                            <input type="text" id="customerOrderId" placeholder="Order ID for deep-linking">
                        </div>
                    </div>
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Category ID (optional)</label>
                            <input type="text" id="customerCategoryId" placeholder="Category for promo campaigns">
                        </div>
                        <div class="form-group">
                            <label>Search Query (optional)</label>
                            <input type="text" id="customerQuery" placeholder="Saved search or keyword">
                        </div>
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
                  <div class="grid-2">
                      <div class="form-group">
                          <label>Notification Type</label>
                          <select id="sellerType">
                              <option value="system">System</option>
                              <option value="promotion">Promotion</option>
                              <option value="order">Order</option>
                              <option value="delivery">Delivery</option>
                              <option value="admin_broadcast">Admin Broadcast</option>
                          </select>
                      </div>
                      <div class="form-group">
                          <label>Image URL (optional)</label>
                          <input type="text" id="sellerImageUrl" placeholder="https://cdn.example.com/banner.png">
                      </div>
                  </div>
                  <div class="grid-2">
                      <div class="form-group">
                          <label>Target Screen (optional)</label>
                          <input type="text" id="sellerTargetScreen" placeholder="e.g. OrdersScreen, LiveTracking">
                      </div>
                      <div class="form-group">
                          <label>Order ID (optional)</label>
                          <input type="text" id="sellerOrderId" placeholder="Order ID for deep-linking">
                      </div>
                  </div>
                  <div class="grid-2">
                      <div class="form-group">
                          <label>Category ID (optional)</label>
                          <input type="text" id="sellerCategoryId" placeholder="Category for promo campaigns">
                      </div>
                      <div class="form-group">
                          <label>Search Query (optional)</label>
                          <input type="text" id="sellerQuery" placeholder="Saved search or keyword">
                      </div>
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
                          <label>Notification Type</label>
                          <select id="deliveryType">
                              <option value="system">System</option>
                              <option value="promotion">Promotion</option>
                              <option value="order">Order</option>
                              <option value="delivery">Delivery</option>
                              <option value="admin_broadcast">Admin Broadcast</option>
                          </select>
                      </div>
                  </div>
                  <div class="form-group">
                      <label>Message</label>
                      <textarea id="deliveryMessage" placeholder="Notification message" required></textarea>
                  </div>
                  <div class="grid-2">
                      <div class="form-group">
                          <label>Image URL (optional)</label>
                          <input type="text" id="deliveryImageUrl" placeholder="https://cdn.example.com/banner.png">
                      </div>
                      <div class="form-group">
                          <label>Target Screen (optional)</label>
                          <input type="text" id="deliveryTargetScreen" placeholder="e.g. OrdersScreen, LiveTracking">
                      </div>
                  </div>
                  <div class="grid-2">
                      <div class="form-group">
                          <label>Order ID (optional)</label>
                          <input type="text" id="deliveryOrderId" placeholder="Order ID for deep-linking">
                      </div>
                      <div class="form-group">
                          <label>Category ID (optional)</label>
                          <input type="text" id="deliveryCategoryId" placeholder="Category for promo campaigns">
                      </div>
                  </div>
                  <div class="form-group">
                      <label>Search Query (optional)</label>
                      <input type="text" id="deliveryQuery" placeholder="Saved search or keyword">
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
                            <th>Target</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${historyRows.map((n) => `
                        <tr style="animation: fadeIn 0.3s ease-out backwards; animation-delay: ${0.1 + (n.index * 0.02)}s">
                            <td>${new Date(n.createdAt).toLocaleString()}</td>
                            <td style="font-weight: 500;">${n.title}</td>
                            <td style="color: var(--text-muted);">${n.message}</td>
                            <td><span class="badge badge-unknown">${n.type}</span></td>
                            <td>${n.target}</td>
                            <td>
                                ${n.status === 'success'
                                  ? '<span class="badge badge-success">Sent</span>'
                                  : n.status === 'partial'
                                    ? '<span class="badge badge-warning">Partial</span>'
                                    : '<span class="badge badge-unknown">' + n.status + '</span>'}
                            </td>
                        </tr>
                        `).join('')}
                        ${historyRows.length === 0
                          ? '<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--text-muted);">No history found</td></tr>'
                          : ''}
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
            const rawTarget = document.getElementById('customerTarget').value;
            const phone = document.getElementById('customerPhone').value;
            const title = document.getElementById('customerTitle').value;
            const message = document.getElementById('customerMessage').value;
            const type = document.getElementById('customerType').value;

            const formData = {
                title,
                body: message,
                target: rawTarget === 'all' ? 'customers' : 'specific-customer',
                type,
                imageUrl: document.getElementById('customerImageUrl').value || undefined,
                screen: document.getElementById('customerTargetScreen').value || undefined,
                orderId: document.getElementById('customerOrderId').value || undefined,
                categoryId: document.getElementById('customerCategoryId').value || undefined,
                query: document.getElementById('customerQuery').value || undefined
            };

            if (rawTarget === 'specific') {
                if (!phone) {
                    resultDiv.className = 'result error';
                    resultDiv.textContent = 'Please select a customer to target.';
                    resultDiv.style.display = 'block';
                    btn.textContent = originalText;
                    btn.disabled = false;
                    return;
                }
                formData.specificTarget = phone;
            }

            try {
                const response = await fetch('/admin/fcm-management/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const data = await response.json();
                resultDiv.className = 'result ' + (data.success ? 'success' : 'error');
                resultDiv.textContent = data.message || JSON.stringify(data);
                resultDiv.style.display = 'block';
                if (data.success) {
                    showToast('Notification sent successfully!');
                }
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
            const rawTarget = document.getElementById('sellerTarget').value;
            const phone = document.getElementById('sellerPhone').value;
            const title = document.getElementById('sellerTitle').value;
            const message = document.getElementById('sellerMessage').value;
            const type = document.getElementById('sellerType').value;

            const formData = {
                title,
                body: message,
                target: rawTarget === 'all' ? 'sellers' : 'specific-seller',
                type,
                imageUrl: document.getElementById('sellerImageUrl').value || undefined,
                screen: document.getElementById('sellerTargetScreen').value || undefined,
                orderId: document.getElementById('sellerOrderId').value || undefined,
                categoryId: document.getElementById('sellerCategoryId').value || undefined,
                query: document.getElementById('sellerQuery').value || undefined
            };

            if (rawTarget === 'specific') {
                if (!phone) {
                    resultDiv.className = 'result error';
                    resultDiv.textContent = 'Please select a seller to target.';
                    resultDiv.style.display = 'block';
                    btn.textContent = originalText;
                    btn.disabled = false;
                    return;
                }
                formData.specificTarget = phone;
            }

            try {
                const response = await fetch('/admin/fcm-management/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
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
            const rawTarget = document.getElementById('deliveryTarget').value;
            const email = document.getElementById('deliveryEmail').value;
            const title = document.getElementById('deliveryTitle').value;
            const message = document.getElementById('deliveryMessage').value;
            const type = document.getElementById('deliveryType').value;

            const formData = {
                title,
                body: message,
                target: rawTarget === 'all' ? 'delivery' : 'specific-delivery',
                type,
                imageUrl: document.getElementById('deliveryImageUrl').value || undefined,
                screen: document.getElementById('deliveryTargetScreen').value || undefined,
                orderId: document.getElementById('deliveryOrderId').value || undefined,
                categoryId: document.getElementById('deliveryCategoryId').value || undefined,
                query: document.getElementById('deliveryQuery').value || undefined
            };

            if (rawTarget === 'specific') {
                if (!email) {
                    resultDiv.className = 'result error';
                    resultDiv.textContent = 'Please select a delivery partner to target.';
                    resultDiv.style.display = 'block';
                    btn.textContent = originalText;
                    btn.disabled = false;
                    return;
                }
                formData.specificTarget = email;
            }

            try {
                const response = await fetch('/admin/fcm-management/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
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

const TOKEN_QUERY = { 'fcmTokens.0': { $exists: true } };
const mapNotificationType = (incomingType) => {
    switch ((incomingType || '').toLowerCase()) {
        case 'order':
            return 'order';
        case 'delivery':
            return 'delivery';
        case 'promotion':
        case 'offer':
            return 'promotion';
        case 'system':
            return 'system';
        default:
            return 'general';
    }
};

const appendTokens = (rows, entities, options) => {
    entities.forEach(entity => {
        const tokenEntries = Array.isArray(entity.fcmTokens) ? entity.fcmTokens : [];
        if (tokenEntries.length === 0 && entity.fcmToken) {
            tokenEntries.push({
                token: entity.fcmToken,
                platform: 'unknown',
                createdAt: entity.createdAt
            });
        }
        tokenEntries.forEach(token => {
            if (!token?.token) {
                return;
            }
            rows.push({
                _id: token._id,
                userId: entity._id,
                userType: options.type,
                name: options.getName(entity),
                identifier: options.getIdentifier(entity),
                token: token.token,
                platform: token.platform || 'android',
                createdAt: token.createdAt || entity.createdAt
            });
        });
    });
};

const fetchAllTokens = async () => {
    const [customers, sellers, partners] = await Promise.all([
        Customer.find(TOKEN_QUERY).select('name phone email fcmTokens fcmToken createdAt').lean(),
        Seller.find(TOKEN_QUERY).select('storeName name phone email fcmTokens fcmToken createdAt').lean(),
        DeliveryPartner.find(TOKEN_QUERY).select('name phone email fcmTokens fcmToken createdAt').lean()
    ]);

    const rows = [];
    appendTokens(rows, customers, {
        type: 'Customer',
        getName: (c) => c.name || 'Customer',
        getIdentifier: (c) => c.email || c.phone
    });
    appendTokens(rows, sellers, {
        type: 'Seller',
        getName: (s) => s.storeName || s.name || 'Seller',
        getIdentifier: (s) => s.email || s.phone
    });
    appendTokens(rows, partners, {
        type: 'Delivery',
        getName: (d) => d.name || 'Delivery Partner',
        getIdentifier: (d) => d.email || d.phone
    });

    return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const removeTokenFromModel = async (Model, tokenId) => {
    const user = await Model.findOne({ 'fcmTokens._id': tokenId });
    if (!user) {
        return false;
    }
    user.fcmTokens = (user.fcmTokens || []).filter(t => t._id?.toString() !== tokenId);
    user.fcmToken = user.fcmTokens[0]?.token || null;
    user.fcmTokenUpdatedAt = new Date();
    await user.save();
    return true;
};

const dedupeTokens = (tokens) => Array.from(new Set(tokens.filter(Boolean)));

const normalizePhone = (value) => {
    if (!value) return null;
    const normalized = value.toString().replace(/\D/g, '');
    return normalized.length ? Number(normalized) : null;
};

const collectScopeTargets = async (scope, specificTarget) => {
    switch (scope) {
        case 'customers': {
            let query = TOKEN_QUERY;
            if (specificTarget) {
                const normalized = normalizePhone(specificTarget);
                const orQuery = [];
                if (normalized !== null) {
                    orQuery.push({ phone: normalized });
                }
                if (specificTarget) {
                    orQuery.push({ email: specificTarget });
                }
                if (orQuery.length === 0) {
                    return [];
                }
                query = { $or: orQuery };
            }
            const customers = await Customer.find(query).select('name phone email fcmTokens fcmToken').lean();
            return customers.map(customer => ({
                userId: customer._id,
                tokens: [
                    ...(customer.fcmTokens || []).map(t => t.token).filter(Boolean),
                    customer.fcmToken
                ].filter(Boolean)
            })).filter(entry => entry.tokens.length > 0);
        }
        case 'sellers': {
            let query = TOKEN_QUERY;
            if (specificTarget) {
                const normalized = normalizePhone(specificTarget);
                const orQuery = [];
                if (specificTarget) {
                    orQuery.push({ email: specificTarget });
                }
                if (normalized !== null) {
                    orQuery.push({ phone: normalized });
                }
                if (orQuery.length === 0) {
                    return [];
                }
                query = { $or: orQuery };
            }
            const sellers = await Seller.find(query).select('fcmTokens fcmToken').lean();
            return sellers.map(seller => ({
                tokens: [
                    ...(seller.fcmTokens || []).map(t => t.token).filter(Boolean),
                    seller.fcmToken
                ].filter(Boolean)
            })).filter(entry => entry.tokens.length > 0);
        }
        case 'delivery': {
            let query = TOKEN_QUERY;
            if (specificTarget) {
                query = { email: specificTarget };
            }
            const partners = await DeliveryPartner.find(query).select('fcmTokens fcmToken').lean();
            return partners.map(partner => ({
                tokens: [
                    ...(partner.fcmTokens || []).map(t => t.token).filter(Boolean),
                    partner.fcmToken
                ].filter(Boolean)
            })).filter(entry => entry.tokens.length > 0);
        }
        default:
            return [];
    }
};

const buildTargetSummary = async (target, specificTarget) => {
    const summary = {
        intendedRecipients: 0,
        customerEntries: []
    };

    const tokenBuckets = [];
    const scopes = [];
    switch (target) {
        case 'all':
            scopes.push('customers', 'sellers', 'delivery');
            break;
        case 'customers':
            scopes.push('customers');
            break;
        case 'sellers':
            scopes.push('sellers');
            break;
        case 'delivery':
            scopes.push('delivery');
            break;
        case 'specific-customer':
            scopes.push('customers');
            break;
        case 'specific-seller':
            scopes.push('sellers');
            break;
        case 'specific-delivery':
            scopes.push('delivery');
            break;
        case 'specific-token':
            if (specificTarget) {
                tokenBuckets.push([specificTarget]);
            }
            break;
        default:
            scopes.push('customers');
    }

    for (const scope of scopes) {
        const entries = await collectScopeTargets(scope, specificTarget);
        if (scope === 'customers') {
            entries.forEach(entry => summary.customerEntries.push(entry));
        }
        tokenBuckets.push(entries.map(entry => entry.tokens || []).flat());
        summary.intendedRecipients += entries.length;
    }

    const flattenedTokens = dedupeTokens(tokenBuckets.flat());
    if (!summary.intendedRecipients) {
        summary.intendedRecipients = flattenedTokens.length;
    }
    return { tokens: flattenedTokens, summary };
};

export async function getDashboardTokens(request, reply) {
    try {
        const tokens = await fetchAllTokens();
        reply.send({
            success: true,
            count: tokens.length,
            tokens
        });
    } catch (error) {
        console.error('Dashboard tokens error:', error);
        reply.status(500).send({ success: false, message: 'Failed to load tokens' });
    }
}

export async function deleteDashboardToken(request, reply) {
    try {
        const { tokenId } = request.params || {};
        if (!tokenId) {
            reply.status(400).send({ success: false, message: 'Token ID is required' });
            return;
        }
        const removed = await removeTokenFromModel(Customer, tokenId)
            || await removeTokenFromModel(Seller, tokenId)
            || await removeTokenFromModel(DeliveryPartner, tokenId);
        if (!removed) {
            reply.status(404).send({ success: false, message: 'Token not found' });
            return;
        }
        reply.send({ success: true });
    } catch (error) {
        console.error('Delete dashboard token error:', error);
        reply.status(500).send({ success: false, message: 'Failed to delete token' });
    }
}

export async function getDashboardStats(request, reply) {
    try {
        const [customerTokens, sellerTokens, deliveryTokens, notificationStats] = await Promise.all([
            Customer.aggregate([
                { $match: TOKEN_QUERY },
                { $project: { tokenCount: { $size: '$fcmTokens' } } },
                { $group: { _id: null, total: { $sum: '$tokenCount' } } }
            ]).then(res => res[0]?.total || 0),
            Seller.aggregate([
                { $match: TOKEN_QUERY },
                { $project: { tokenCount: { $size: '$fcmTokens' } } },
                { $group: { _id: null, total: { $sum: '$tokenCount' } } }
            ]).then(res => res[0]?.total || 0),
            DeliveryPartner.aggregate([
                { $match: TOKEN_QUERY },
                { $project: { tokenCount: { $size: '$fcmTokens' } } },
                { $group: { _id: null, total: { $sum: '$tokenCount' } } }
            ]).then(res => res[0]?.total || 0),
            NotificationLog.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);

        const notificationSummary = notificationStats.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        reply.send({
            success: true,
            stats: {
                tokens: {
                    customers: customerTokens,
                    sellers: sellerTokens,
                    deliveryPartners: deliveryTokens,
                    total: customerTokens + sellerTokens + deliveryTokens
                },
                notifications: notificationSummary
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        reply.status(500).send({ success: false, message: 'Failed to load stats' });
    }
}

export async function getDashboardHistory(request, reply) {
    try {
        const page = Math.max(1, parseInt(request.query?.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(request.query?.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            NotificationLog.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('payload targeting status totals createdAt')
                .lean(),
            NotificationLog.countDocuments()
        ]);

        const notifications = logs.map(log => ({
            title: log.payload?.title || '',
            message: log.payload?.body || '',
            target: log.targeting || '',
            // Map internal status values to the simple states expected by the dashboard UI
            status: log.status === 'success' ? 'sent' : (log.status || 'unknown'),
            createdAt: log.createdAt,
        }));

        reply.send({
            success: true,
            notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit) || 1
            }
        });
    } catch (error) {
        console.error('Dashboard history error:', error);
        reply.status(500).send({ success: false, message: 'Failed to load history' });
    }
}

export async function sendDashboardNotification(request, reply) {
    try {
        const {
            target = 'customers',
            title,
            message,
            body,
            type,
            specificTarget,
            imageUrl,
            screen,
            orderId,
            categoryId,
            query
        } = request.body || {};

        const targetValue = specificTarget || request.body?.phone || request.body?.email;
        const notificationTitle = title || 'GoatGoat Notification';
        const notificationBody = body || message;

        if (!notificationBody) {
            reply.status(400).send({ success: false, message: 'Notification message is required' });
            return;
        }
        if (target?.startsWith('specific-') && !targetValue) {
            reply.status(400).send({ success: false, message: 'Specific target value is required' });
            return;
        }

        const { tokens, summary } = await buildTargetSummary(target, targetValue);
        if (!tokens.length) {
            reply.send({ success: false, message: 'No FCM tokens found for the selected target' });
            return;
        }

        const dataPayload = {
            type: type || 'system'
        };
        if (screen) dataPayload.screen = screen;
        if (orderId) dataPayload.orderId = orderId;
        if (categoryId) dataPayload.categoryId = categoryId;
        if (query) dataPayload.query = query;

        const payload = {
            title: notificationTitle,
            body: notificationBody,
            imageUrl: imageUrl || undefined,
            data: dataPayload
        };

        const logEntry = await NotificationLog.create({
            targeting: target,
            payload,
            status: 'running',
            totals: {
                intendedCount: summary.intendedRecipients,
                sentCount: 0,
                failureCount: 0
            },
            startedAt: new Date(),
            sentByEmail: 'dashboard@staging.goatgoat.tech'
        });

        let result;
        if (tokens.length === 1) {
            const singleResult = await sendPushNotification(tokens[0], payload);
            result = {
                success: singleResult?.success,
                successCount: singleResult?.success ? 1 : 0,
                failureCount: singleResult?.success ? 0 : 1
            };
        } else {
            result = await sendBulkPushNotifications(tokens, payload);
        }

        const successCount = result?.successCount || 0;
        const failureCount = result?.failureCount || Math.max(tokens.length - successCount, 0);
        const status = failureCount === 0 ? 'success' : successCount === 0 ? 'failed' : 'partial';

        await NotificationLog.findByIdAndUpdate(logEntry._id, {
            status,
            totals: {
                intendedCount: summary.intendedRecipients,
                sentCount: successCount,
                failureCount
            },
            completedAt: new Date()
        });

        if (summary.customerEntries.length) {
            const notifications = summary.customerEntries.map(entry => ({
                user: entry.userId,
                title: notificationTitle,
                body: notificationBody,
                imageUrl: imageUrl || undefined,
                type: mapNotificationType(type),
                source: 'admin-dashboard',
                logId: logEntry._id
            }));
            await CustomerNotification.insertMany(notifications, { ordered: false });
        }

        reply.send({
            success: successCount > 0,
            message: `Sent to ${successCount}/${tokens.length} recipients`,
            details: {
                successCount,
                failureCount,
                targeting: target
            }
        });
    } catch (error) {
        console.error('Dashboard send error:', error);
        reply.status(500).send({ success: false, message: error?.message || 'Failed to send notification' });
    }
}
