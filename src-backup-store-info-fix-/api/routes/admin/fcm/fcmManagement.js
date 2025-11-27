export async function getFCMManagementDashboard(request, reply) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>GoatGoat FCM Management</title><style>body{font-family:Arial,sans-serif;background:#111;color:#fff;padding:20px}.header{padding:16px;background:#333;border-radius:8px;margin-bottom:16px}.card{background:#222;border:1px solid #444;border-radius:8px;padding:16px;margin:16px 0}.btn{display:inline-block;background:#4caf50;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none}</style></head><body><div class="header"><h1>GoatGoat FCM Management</h1><p>Standalone admin page</p></div><div class="card"><p><a class="btn" href="/admin/fcm-management/test">Test FCM connection</a></p></div><div class="card"><p><a class="btn" href="/admin">Admin</a> <a class="btn" href="/admin/monitoring-dashboard">Monitoring</a></p></div></body></html>`;
    reply.type("text/html").send(html);
}
export async function testFCMConnection(request, reply) { reply.send({ success: true, timestamp: new Date().toISOString() }); }
export async function previewNotificationEndpoint(request, reply) { reply.send({ success: true, audienceSize: 0, audienceDescription: "preview not implemented" }); }
export async function sendNotificationEndpoint(request, reply) { reply.send({ success: true, sentCount: 0, audienceSize: 0, status: "success" }); }
export async function getNotificationLogsEndpoint(request, reply) { reply.send({ success: true, logs: [], pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0 } }); }
export async function getNotificationLogByIdEndpoint(request, reply) { reply.send({ success: false, error: "not implemented" }); }
