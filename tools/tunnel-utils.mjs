import net from 'node:net';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const SESSION_FILE = path.join(process.cwd(), '.cache', 'ngrok-session.json');

/**
 * Kiểm tra xem một TCP port có đang mở và kết nối được không
 */
export function isPortInUse(port, host = '127.0.0.1', timeoutMs = 400) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Kiểm tra port trên cả 127.0.0.1 và localhost (IPv4/IPv6)
 */
export async function checkPort(port) {
  const inUseIPv4 = await isPortInUse(port, '127.0.0.1');
  if (inUseIPv4) return true;
  return isPortInUse(port, 'localhost');
}

/**
 * Lấy PID của tiến trình đang lắng nghe trên port (dành cho Windows)
 */
export function getPortPid(port) {
  try {
    const stdout = execSync('netstat -ano -p tcp', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 2000,
    });
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes(`:${port} `) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(Number(pid))) {
          return Number(pid);
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Lấy thông tin dòng lệnh của process qua PID trên Windows
 */
export function getProcessCommandLine(pid) {
  if (!pid) return '';
  try {
    const cmd = `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\").CommandLine"`;
    const out = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 2000,
    });
    return out.trim();
  } catch {}
  return '';
}

/**
 * Kiểm tra xem server trên port có phải là Next.js của dự án OmniCart này hay không
 */
export async function isThisProjectServer(port) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    // 1. Thử gửi request tới root để xem middleware chuyển hướng
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'GET',
      headers: { 'User-Agent': 'dev-tunnel-probe' },
      signal: controller.signal,
      redirect: 'manual',
    });
    clearTimeout(timeoutId);

    const location = res.headers.get('location') || '';
    const poweredBy = (res.headers.get('x-powered-by') || '').toLowerCase();

    // Middleware của dự án này chuyển hướng người chưa đăng nhập về /[locale]/login
    if (location.includes('/login') && (location.includes('/vi') || location.includes('/en'))) {
      return { isThisProject: true, isNextJs: true, port };
    }

    // Nếu có header Next.js, probe tiếp trang login để xác nhận thương hiệu OmniCart
    if (poweredBy.includes('next')) {
      try {
        const loginRes = await fetch(`http://127.0.0.1:${port}/vi/login`, {
          headers: { 'User-Agent': 'dev-tunnel-probe' },
          signal: AbortSignal.timeout(1200),
        });
        const text = await loginRes.text();
        if (
          text.includes('OmniCart') ||
          text.includes('ecommerce_integrate') ||
          text.includes('Merchant operations')
        ) {
          return { isThisProject: true, isNextJs: true, port };
        }
      } catch {}
      return { isThisProject: false, isNextJs: true, port };
    }

    return { isThisProject: false, isNextJs: false, port };
  } catch {
    return { isThisProject: false, isNextJs: false, port };
  }
}

/**
 * Quét các cổng phổ biến để tìm server Next.js của dự án đang chạy sẵn
 */
export async function findExistingProjectServer(startPort = 3000, endPort = 3005) {
  for (let port = startPort; port <= endPort; port++) {
    const inUse = await checkPort(port);
    if (inUse) {
      const info = await isThisProjectServer(port);
      if (info.isThisProject) {
        return { port, info };
      }
    }
  }
  return null;
}

/**
 * Quản lý file session trạng thái Ngrok trong .cache
 */
export function saveTunnelSession(data) {
  try {
    const cacheDir = path.dirname(SESSION_FILE);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    writeFileSync(
      SESSION_FILE,
      JSON.stringify(
        {
          ...data,
          project: 'ecommerce-integrate',
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch {}
}

export function removeTunnelSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      unlinkSync(SESSION_FILE);
    }
  } catch {}
}

export function loadTunnelSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      const content = readFileSync(SESSION_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {}
  return null;
}

/**
 * Chẩn đoán chi tiết khi gặp lỗi ERR_NGROK_334 (domain ngrok đang online)
 */
export async function diagnoseNgrokConflict({ domain, currentPort }) {
  const result = {
    domain,
    publicUrl: `https://${domain}`,
    targetPort: null,
    isThisProject: false,
    isNextJs: false,
    localServerStatus: 'unknown',
    activePid: null,
    source: null,
  };

  // 1. Kiểm tra session file từ lần chạy trước
  const session = loadTunnelSession();
  if (session && session.domain === domain) {
    result.targetPort = session.port;
    result.activePid = session.pid;
    result.source = 'session_file';
  }

  // 2. Kiểm tra ngrok agent local API (port 4040) nếu người dùng chạy ngrok CLI
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels', {
      signal: AbortSignal.timeout(800),
    });
    if (res.ok) {
      const data = await res.json();
      const match = data.tunnels?.find((t) => t.public_url?.includes(domain));
      if (match && match.config?.addr) {
        const portMatch = match.config.addr.match(/:(\d+)$/);
        if (portMatch) {
          result.targetPort = Number(portMatch[1]);
          result.source = 'ngrok_local_api';
        }
      }
    }
  } catch {}

  // 3. Probe qua public URL
  try {
    const probeRes = await fetch(`https://${domain}/`, {
      headers: { 'User-Agent': 'dev-tunnel-probe' },
      redirect: 'manual',
      signal: AbortSignal.timeout(3000),
    });

    if (probeRes.status === 502) {
      const errorHtml = await probeRes.text();
      const portMatch = errorHtml.match(/(?:localhost|127\.0\.0\.1):(\d+)/i);
      if (portMatch) {
        result.targetPort = Number(portMatch[1]);
        result.localServerStatus = 'offline';
        result.source = result.source || 'ngrok_502_error';
      }
    } else {
      const location = probeRes.headers.get('location') || '';
      const poweredBy = (probeRes.headers.get('x-powered-by') || '').toLowerCase();

      if (location.includes('/login') && (location.includes('/vi') || location.includes('/en'))) {
        result.isThisProject = true;
        result.isNextJs = true;
        result.localServerStatus = 'online';
      } else if (poweredBy.includes('next')) {
        result.isNextJs = true;
        result.localServerStatus = 'online';
        try {
          const loginRes = await fetch(`https://${domain}/vi/login`, {
            headers: { 'User-Agent': 'dev-tunnel-probe' },
            signal: AbortSignal.timeout(2000),
          });
          const text = await loginRes.text();
          if (
            text.includes('OmniCart') ||
            text.includes('Merchant operations') ||
            text.includes('ecommerce_integrate')
          ) {
            result.isThisProject = true;
          }
        } catch {}
      } else {
        result.localServerStatus = 'online';
      }
    }
  } catch {}

  // 4. Nếu chưa xác định được targetPort, kiểm tra các local port đang chạy OmniCart
  if (!result.targetPort) {
    for (const p of [3000, 3001, 3002, 3003, 3004]) {
      const check = await isThisProjectServer(p);
      if (check.isThisProject) {
        result.targetPort = p;
        result.isThisProject = true;
        result.isNextJs = true;
        result.localServerStatus = 'online';
        result.source = result.source || 'local_omnicart_scan';
        break;
      }
    }
  }

  // 5. Nếu đã có targetPort, kiểm tra chi tiết server tại port đó
  if (result.targetPort) {
    const portCheck = await isThisProjectServer(result.targetPort);
    if (portCheck.isThisProject) {
      result.isThisProject = true;
      result.isNextJs = true;
      result.localServerStatus = 'online';
    } else if (portCheck.isNextJs) {
      result.isNextJs = true;
      result.localServerStatus = 'online';
    }

    if (!result.activePid) {
      result.activePid = getPortPid(result.targetPort);
    }
  }

  return result;
}

/**
 * Hiển thị báo cáo chi tiết giải quyết Case 4
 */
export function printNgrokConflictReport(diagnosis, currentPort) {
  console.error('\n======================================================');
  console.error('⚠️  NGROK ENDPOINT ĐANG ĐƯỢC SỬ DỤNG (Lỗi ERR_NGROK_334)');
  console.error('======================================================');
  console.error(`🌐 Static Domain: ${diagnosis.publicUrl}`);
  console.error(`💻 Cổng bạn đang định kết nối tới: ${currentPort}`);

  console.error('\n🔍 KẾT QUẢ PHÂN TÍCH HIỆN TRẠNG:');
  if (diagnosis.targetPort) {
    console.error(`   • Ngrok Public URL hiện đang trỏ tới: Port ${diagnosis.targetPort}`);
  } else {
    console.error(`   • Ngrok Public URL hiện đang trỏ tới: Không xác định được cổng cụ thể (có thể từ máy/tiến trình khác)`);
  }

  let isProjectText;
  if (diagnosis.isThisProject) {
    isProjectText = 'CÓ (Chính là server Next.js của dự án OmniCart này)';
  } else if (diagnosis.isNextJs) {
    isProjectText = 'KHÔNG (Là một server Next.js khác trên máy)';
  } else {
    isProjectText = 'KHÔNG (Một ứng dụng khác hoặc server local đã tắt)';
  }
  console.error(`   • Server tại cổng đó có phải của project này?: ${isProjectText}`);

  if (diagnosis.localServerStatus === 'online') {
    console.error(`   • Trạng thái server local: Đang hoạt động bình thường`);
  } else if (diagnosis.localServerStatus === 'offline') {
    console.error(`   • Trạng thái server local: Đã bị tắt (Ngrok báo 502 Bad Gateway)`);
  }

  if (diagnosis.activePid) {
    console.error(`   • PID tiến trình chiếm cổng: ${diagnosis.activePid}`);
  }

  console.error('\n💡 GỢI Ý & HƯỚNG XỬ LÝ DÀNH CHO BẠN:');
  if (diagnosis.isThisProject && diagnosis.localServerStatus === 'online') {
    console.error('   👉 Bạn ĐÃ CÓ sẵn một phiên Next.js và Ngrok đang hoạt động bình thường:');
    console.error(`      • Local:  http://localhost:${diagnosis.targetPort}`);
    console.error(`      • Public: ${diagnosis.publicUrl}`);
    console.error('      • Không cần mở thêm terminal để chạy lại lệnh này.\n');
  }

  console.error('   1. NẾU BẠN CHỈ CẦN PHÁT TRIỂN / TEST GIAO DIỆN NỘI BỘ:');
  console.error('      👉 Hãy dùng lệnh: yarn dev');
  console.error('      (Lệnh này chỉ chạy Next.js cục bộ, không dùng ngrok, tránh xung đột endpoint).\n');

  console.error('   2. NẾU BẠN CẦN NHẬN WEBHOOK TỪ LAZADA / SHOPIFY RA NGOÀI:');
  console.error('      👉 Bạn cần tắt phiên Ngrok cũ đang chiếm giữ domain:');
  console.error('         - Kiểm tra các cửa sổ terminal khác đang chạy `yarn dev:tunnel` hoặc `ngrok` và bấm Ctrl+C.');
  if (diagnosis.activePid) {
    console.error(`         - Hoặc tắt tiến trình PID ${diagnosis.activePid} bằng lệnh: taskkill /F /PID ${diagnosis.activePid}`);
  }
  console.error('         - Sau khi tắt xong, chạy lại: yarn dev:tunnel');
  console.error('======================================================\n');
}
