import { getActiveConfig, createConfig, updateConfig, calculateFee, getAllConfigs } from '../../../controllers/admin/deliveryFee.js';

export default async function deliveryFeeRoutes(fastify) {
  // JSON APIs
  fastify.get('/ops/delivery-fee/config', getActiveConfig);
  fastify.post('/ops/delivery-fee/config', createConfig);
  fastify.put('/ops/delivery-fee/config/:id', updateConfig);
  fastify.get('/ops/delivery-fee/calculate', calculateFee);
  fastify.get('/ops/delivery-fee/history', getAllConfigs);

  // HTML page for admin tool
  fastify.get('/ops/delivery-fee', async (_req, reply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Delivery Fee Configuration - GoatGoat Admin</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1000px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 25px; }
    .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #333; }
    .slab-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .slab-table th, .slab-table td { padding: 12px; text-align: left; border: 1px solid #ddd; }
    .slab-table th { background: #007bff; color: #fff; }
    .btn { padding: 10px 20px; border: none; border-radius: 5px; font-size: 14px; cursor: pointer; transition: background 0.3s; margin-right: 10px; }
    .btn-primary { background: #007bff; color: #fff; }
    .btn-success { background: #28a745; color: #fff; }
    .btn-secondary { background: #6c757d; color: #fff; }
    .calculator { background: #e7f3ff; padding: 20px; border-radius: 5px; }
    .alert { padding: 15px; border-radius: 5px; margin-bottom: 20px; display: none; }
    .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚚 Delivery Fee Configuration</h1>
      <p>Environment: <strong>${process.env.NODE_ENV || 'development'}</strong></p>
    </div>

    <div id="alert" class="alert"></div>

    <div class="section">
      <div class="section-title">📊 Current Configuration</div>
      <div id="currentConfig">Loading...</div>
    </div>

    <div class="section">
      <div class="section-title">💰 Delivery Fee Slabs</div>
      <table class="slab-table" id="slabTable">
        <thead>
          <tr>
            <th>Min (₹)</th><th>Max (₹)</th><th>Base (₹)</th><th>%</th><th>Description</th>
          </tr>
        </thead>
        <tbody id="slabTableBody"></tbody>
      </table>
    </div>

    <div class="section calculator">
      <div class="section-title">🧮 Fee Calculator (Preview)</div>
      <input type="number" id="orderValue" min="0" step="1" placeholder="Enter order value" />
      <div id="calcResult" style="margin-top:10px"></div>
    </div>

    <div class="section">
      <button class="btn btn-primary" id="refreshBtn">🔄 Refresh</button>
      <button class="btn btn-success" id="calcBtn">Calculate Fee</button>
    </div>
  </div>

  <script>
    async function showAlert(msg, type='success'){
      const el=document.getElementById('alert');
      el.className = 'alert ' + (type==='success'?'alert-success':'alert-error');
      el.textContent = msg; el.style.display='block';
      setTimeout(()=> el.style.display='none', 3000);
    }
    async function loadConfig(){
      try{
        const res = await fetch('/admin/ops/delivery-fee/config');
        const data = await res.json();
        if(!data.success){ document.getElementById('currentConfig').innerText='No active config'; return; }
        const cfg = data.data;
        document.getElementById('currentConfig').innerHTML = `Partner Earnings: ${(cfg.partnerEarningsPercentage*100).toFixed(0)}%`;
        const tbody = document.getElementById('slabTableBody');
        tbody.innerHTML = '';
        cfg.slabs.forEach(s=>{
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${s.minOrderValue}</td><td>${s.maxOrderValue ?? '∞'}</td><td>${s.baseFee}</td><td>${(s.percentageFee*100).toFixed(1)}</td><td>${s.description}</td>`;
          tbody.appendChild(tr);
        });
      }catch(e){ showAlert('Failed to load config','error'); }
    }
    async function calc(){
      const v = Number(document.getElementById('orderValue').value);
      if(Number.isNaN(v)||v<0){ showAlert('Enter valid order value','error'); return; }
      const res = await fetch('/admin/ops/delivery-fee/calculate?orderValue='+v);
      const data = await res.json();
      if(!data.success){ showAlert(data.message||'Calc failed','error'); return; }
      const d = data.data;
      document.getElementById('calcResult').innerHTML = `Fee: ₹${d.deliveryFee} | Partner: ₹${d.partnerEarnings} | Platform: ₹${d.platformCommission}`;
    }
    document.getElementById('refreshBtn').onclick = loadConfig;
    document.getElementById('calcBtn').onclick = calc;
    loadConfig();
  </script>
</body>
</html>`;
    reply.type('text/html').send(html);
  });
}
