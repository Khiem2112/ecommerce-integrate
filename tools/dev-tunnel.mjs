import { spawn } from 'node:child_process';
import {
  checkPort,
  findExistingProjectServer,
  getPortPid,
  isThisProjectServer,
} from './tunnel-utils.mjs';

console.log('\n======================================================');
console.log('🔍 Đang kiểm tra hệ thống và các cổng mạng...');
console.log('======================================================\n');

// 1. CASE 3: Kiểm tra xem đã có server Next.js của project này chạy sẵn chưa
const existingProject = await findExistingProjectServer(3000, 3005);

if (existingProject) {
  console.log('======================================================');
  console.log(`💡 PHÁT HIỆN SERVER NEXT.JS CỦA DỰ ÁN ĐANG CHẠY SẴN`);
  console.log(`🎯 Port: ${existingProject.port}`);
  console.log(`🚀 Giữ nguyên server cũ (không khởi động server Next.js mới).`);
  console.log(`🔗 Đang khởi động Ngrok Tunnel trỏ tới Port: ${existingProject.port}...`);
  console.log('======================================================\n');

  // Khởi động trực tiếp ngrok tunnel tới port của server có sẵn
  const tunnel = spawn('node', ['tools/tunnel.mjs', `--port=${existingProject.port}`], {
    stdio: 'inherit',
    shell: true,
  });

  tunnel.on('exit', (code) => {
    process.exit(code || 0);
  });

  const stopTunnel = () => {
    try {
      tunnel.kill();
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', stopTunnel);
  process.on('SIGTERM', stopTunnel);
} else {
  // 2. Chưa có server Next.js nào của project này -> Kiểm tra port 3000
  const port3000InUse = await checkPort(3000);

  if (port3000InUse) {
    // CASE 2: Port 3000 đang bị ứng dụng khác chiếm giữ
    const pid = getPortPid(3000);
    console.log('======================================================');
    console.log(`⚠️  Cổng 3000 đang được sử dụng bởi ứng dụng khác${pid ? ` (PID: ${pid})` : ''}.`);
    console.log('🚀 Đang khởi động Next.js Dev Server (sẽ tự động dùng cổng khả dụng tiếp theo)...');
    console.log('======================================================\n');
  } else {
    // CASE 1: Port 3000 hoàn toàn trống
    console.log('======================================================');
    console.log('🚀 Khởi động Next.js Dev Server trên Port mặc định: 3000...');
    console.log('======================================================\n');
  }

  // Tự động nhận diện package manager (yarn / pnpm / npm)
  const userAgent = process.env.npm_config_user_agent || '';
  const cmd = userAgent.startsWith('yarn') ? 'yarn' : userAgent.startsWith('pnpm') ? 'pnpm' : 'npm';

  const nextDev = spawn(cmd, ['run', 'dev'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  let isShuttingDown = false;
  let tunnel = null;
  let tunnelStarted = false;

  function startTunnel(port) {
    if (tunnelStarted || isShuttingDown) return;
    tunnelStarted = true;

    console.log(`\n======================================================`);
    console.log(`🎯 Server Next.js của dự án đã sẵn sàng trên Port: ${port}`);
    console.log(`🔗 Khởi động Ngrok Tunnel trỏ tới cổng ${port}...`);
    console.log(`======================================================\n`);

    tunnel = spawn('node', ['tools/tunnel.mjs', `--port=${port}`], {
      stdio: 'inherit',
      shell: true,
    });

    tunnel.on('exit', (code) => {
      if (code === 2) {
        // Lỗi xung đột domain ERR_NGROK_334 đã được in chi tiết trong tunnel.mjs
        console.log('\n🛑 Đã dừng phiên do xung đột ngrok static domain.');
      } else if (code !== 0 && !isShuttingDown) {
        console.error(`Ngrok tunnel process exited with code ${code}`);
      }
      cleanup();
    });
  }

  function processChunk(chunk, stream) {
    const text = chunk.toString();
    stream.write(text);

    if (!tunnelStarted) {
      // Ưu tiên 1: Bắt port được Next.js cấp phát thay thế khi port bị chiếm
      const altMatch = text.match(/using available port (\d+) instead/i);
      if (altMatch && altMatch[1]) {
        startTunnel(altMatch[1]);
        return;
      }

      // Ưu tiên 2: Bắt dòng in địa chỉ Local của Next.js
      const localMatch = text.match(/Local:\s*http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/i);
      if (localMatch && localMatch[1]) {
        startTunnel(localMatch[1]);
        return;
      }

      // Ưu tiên 3: Bắt link URL localhost nếu không có cảnh báo in use
      if (!text.includes('is in use')) {
        const urlMatch = text.match(/http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/i);
        if (urlMatch && urlMatch[1]) {
          startTunnel(urlMatch[1]);
        }
      }
    }
  }

  nextDev.stdout.on('data', (chunk) => processChunk(chunk, process.stdout));
  nextDev.stderr.on('data', (chunk) => processChunk(chunk, process.stderr));

  // Fallback an toàn: nếu sau 4.5s chưa bắt được port qua log, quét trực tiếp các port local
  setTimeout(async () => {
    if (!tunnelStarted && !isShuttingDown) {
      for (const p of [3000, 3001, 3002, 3003]) {
        const inUse = await checkPort(p);
        if (inUse) {
          const isProj = await isThisProjectServer(p);
          if (isProj.isThisProject || isProj.isNextJs) {
            console.log(`\n⏳ Nhận diện thấy Server Next.js trên Port ${p}...`);
            startTunnel(p);
            return;
          }
        }
      }
      const defaultPort = process.env.PORT || (port3000InUse ? '3001' : '3000');
      startTunnel(defaultPort);
    }
  }, 4500);

  function cleanup() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n🛑 Đang dọn dẹp và dừng các tiến trình...');
    try {
      nextDev.kill();
    } catch {}
    if (tunnel) {
      try {
        tunnel.kill();
      } catch {}
    }
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  nextDev.on('exit', (code) => {
    if (code !== 0 && !isShuttingDown) {
      console.error(`Next.js process exited with code ${code}`);
    }
    cleanup();
  });
}

