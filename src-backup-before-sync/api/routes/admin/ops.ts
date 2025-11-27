import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { testOtpHandler } from '../../../controllers/admin/ops.js';

export default async function adminOpsRoutes(fastify: FastifyInstance) {
  // OTP Testing endpoint
  fastify.post('/ops/test-otp', testOtpHandler);

  // OPS Tools HTML page
  fastify.get('/ops/tools', async (request: FastifyRequest, reply: FastifyReply) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>OPS Tools - OTP Testing</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 25px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 8px; font-weight: bold; color: #333; }
            input[type="text"] { width: 100%; max-width: 400px; padding: 12px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; }
            input[type="text"]:focus { border-color: #007bff; outline: none; }
            .checkbox-group { display: flex; align-items: center; gap: 8px; }
            button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; transition: background 0.3s; }
            button:hover { background: #0056b3; }
            button:disabled { background: #6c757d; cursor: not-allowed; }
            .result { margin-top: 20px; padding: 15px; border-radius: 5px; display: none; }
            .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .info { background: #e2e3e5; color: #383d41; border: 1px solid #d6d8db; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🛠️ OPS Tools - OTP Testing</h1>
                <p>Environment: <strong>${process.env.NODE_ENV || 'development'}</strong></p>
            </div>

            <div class="info">
                <strong>📋 Instructions:</strong><br>
                • Use this tool to test OTP functionality<br>
                • Dry Run mode prevents actual SMS sending<br>
                • Check server logs for detailed information<br>
                • API Endpoint: <code>/admin/ops/test-otp</code>
            </div>

            <form id="otpTestForm">
                <div class="form-group">
                    <label for="phoneNumber">📱 Phone Number:</label>
                    <input type="text" id="phoneNumber" name="phoneNumber"
                           placeholder="Enter phone number (e.g., 9999999999)"
                           pattern="[0-9]{10}" title="Please enter a 10-digit phone number">
                </div>

                <div class="form-group">
                    <div class="checkbox-group">
                        <input type="checkbox" id="dryRun" name="dryRun" checked>
                        <label for="dryRun">🧪 Dry Run (no actual SMS sent)</label>
                    </div>
                </div>

                <button type="submit" id="submitBtn">
                    📤 Send Test OTP
                </button>
            </form>

            <div id="result" class="result"></div>
        </div>

        <script>
            document.getElementById('otpTestForm').addEventListener('submit', async function(e) {
                e.preventDefault();

                const submitBtn = document.getElementById('submitBtn');
                const resultDiv = document.getElementById('result');
                const phoneNumber = document.getElementById('phoneNumber').value.trim();
                const dryRun = document.getElementById('dryRun').checked;

                // Validation
                if (!phoneNumber) {
                    showResult('❌ Please enter a phone number', 'error');
                    return;
                }

                if (!/^[0-9]{10}$/.test(phoneNumber)) {
                    showResult('❌ Please enter a valid 10-digit phone number', 'error');
                    return;
                }

                // Show loading state
                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Sending...';

                try {
                    const response = await fetch('/admin/ops/test-otp', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ phoneNumber, dryRun })
                    });

                    const data = await response.json();

                    if (response.ok) {
                        const mode = dryRun ? '(Dry Run)' : '(Live)';
                        showResult(\`✅ \${data.message || 'Test OTP request sent successfully!'} \${mode}\`, 'success');
                    } else {
                        showResult(\`❌ Error: \${data.message || 'Request failed'}\`, 'error');
                    }
                } catch (error) {
                    showResult(\`❌ Network error: \${error.message}\`, 'error');
                } finally {
                    // Reset button state
                    submitBtn.disabled = false;
                    submitBtn.textContent = '📤 Send Test OTP';
                }
            });

            function showResult(message, type) {
                const resultDiv = document.getElementById('result');
                resultDiv.className = \`result \${type}\`;
                resultDiv.innerHTML = message;
                resultDiv.style.display = 'block';

                // Auto-hide after 10 seconds
                setTimeout(() => {
                    resultDiv.style.display = 'none';
                }, 10000);
            }
        </script>
    </body>
    </html>
    `;

    reply.type('text/html');
    return html;
  });
}
