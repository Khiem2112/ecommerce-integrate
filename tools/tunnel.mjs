import { existsSync, readFileSync } from 'node:fs';
import ngrok from '@ngrok/ngrok';
import {
  saveTunnelSession,
  removeTunnelSession,
  diagnoseNgrokConflict,
  printNgrokConflictReport,
} from './tunnel-utils.mjs';

// 1. Tự động nạp .env hoặc .env.local nếu có
for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envFile);
    } catch {}
  }
}

// 2. Đọc cấu hình từ biến môi trường .env (Single Source of Truth)
let authtoken = process.env.NGROK_AUTHTOKEN;
let domain = process.env.NGROK_DOMAIN;
let addr = process.env.PORT || 3000;

// Đọc tham số CLI (override động từ dev-tunnel, ví dụ --port=3001)
const args = process.argv.slice(2);
const domainArg = args.find((arg) => arg.startsWith('--domain='))?.split('=')[1];
const portArg = args.find((arg) => arg.startsWith('--port='))?.split('=')[1];

if (domainArg) domain = domainArg;
if (portArg) addr = portArg;

// Fallback sang ngrok.yml CHỈ KHI trong .env chưa cấu hình
if ((!authtoken || !domain) && existsSync('ngrok.yml')) {
  try {
    const yamlContent = readFileSync('ngrok.yml', 'utf-8');
    if (!authtoken) {
      const tokenMatch = yamlContent.match(/authtoken:\s*([^\s#]+)/);
      if (tokenMatch && tokenMatch[1] && !tokenMatch[1].includes('YOUR_')) {
        authtoken = tokenMatch[1].trim();
      }
    }
    if (!domain) {
      const domainMatch = yamlContent.match(/domain:\s*([^\s#]+)/);
      if (domainMatch && domainMatch[1] && !domainMatch[1].includes('your-subdomain')) {
        domain = domainMatch[1].trim();
      }
    }
  } catch (err) {
    console.warn('⚠️  Không thể đọc file ngrok.yml:', err.message);
  }
}

if (domain) {
  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

console.log('\n======================================================');
console.log('🚀 Đang khởi động Ngrok Tunnel (qua SDK @ngrok/ngrok)...');
if (domain) console.log(`   🌐 Static Domain: https://${domain}`);
console.log(`   💻 Local Port:    ${addr}`);
console.log('======================================================\n');

try {
  const forwardOptions = {
    addr: Number(addr) || 3000,
  };

  if (authtoken) {
    forwardOptions.authtoken = authtoken;
  }
  if (domain) {
    forwardOptions.domain = domain;
  }

  const listener = await ngrok.forward(forwardOptions);
  const publicUrl = listener.url();

  // Lưu trạng thái session vào .cache để các process khác có thể nhận diện
  saveTunnelSession({
    pid: process.pid,
    port: Number(addr) || 3000,
    domain,
    url: publicUrl,
  });

  console.log('======================================================');
  console.log(`✅ Ngrok Tunnel đã kết nối thành công!`);
  console.log(`   🔗 Public URL:  ${publicUrl}`);
  console.log(`   💻 Local Target: http://localhost:${addr}`);
  console.log(`   📍 Lazada URL:  ${publicUrl}/api/integrations/lazada/callback`);
  console.log(`   📍 Shopify URL: ${publicUrl}/api/integrations/shopify/callback`);
  console.log('======================================================');
  console.log('Nhấn Ctrl + C để dừng tunnel.\n');

  // Giữ tiến trình Node.js và Event Loop luôn hoạt động
  const keepAlive = setInterval(() => {}, 1000 * 30);

  const handleExit = async () => {
    clearInterval(keepAlive);
    removeTunnelSession();
    console.log('\n🛑 Đang đóng ngrok tunnel...');
    try {
      await listener.close();
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
  process.on('exit', () => removeTunnelSession());
} catch (error) {
  removeTunnelSession();

  const isAlreadyOnline =
    error.message.includes('ERR_NGROK_334') ||
    error.message.includes('already online') ||
    error.message.includes('is already online');

  if (isAlreadyOnline && domain) {
    // Chẩn đoán chi tiết theo yêu cầu Case 4
    const diagnosis = await diagnoseNgrokConflict({
      domain,
      currentPort: addr,
    });
    printNgrokConflictReport(diagnosis, addr);
    process.exit(2); // Exit code 2 biểu thị lỗi xung đột ngrok domain
  }

  console.error('\n❌ Không thể khởi động Ngrok Tunnel:');
  console.error(`   Lỗi: ${error.message}\n`);
  if (error.message.includes('authtoken')) {
    console.error('👉 Hãy kiểm tra lại authtoken trong ngrok.yml hoặc .env (NGROK_AUTHTOKEN)');
    console.error('👉 Lấy authtoken tại: https://dashboard.ngrok.com/get-started/your-authtoken');
  }
  process.exit(1);
}

