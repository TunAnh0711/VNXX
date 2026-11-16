/* =========================================================
   HALF NIFE — LAN SERVER
   Chạy:  node server.js            (mặc định cổng 3000)
          node server.js 8080       (đổi cổng)

   Server làm 2 việc:
   1. Phục vụ file tĩnh (index.html, js/, css/...) để mọi máy
      trong LAN mở game bằng http://<IP-host>:3000
   2. WebSocket relay cho phòng LAN: host tạo mã 4 ký tự,
      guest nhập mã để vào. Không cần cài thư viện ngoài.
   ========================================================= */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const ROOT = __dirname;

/* =========================================================
   MIME
   ========================================================= */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map':  'application/json; charset=utf-8'
};

/* =========================================================
   STATIC FILE SERVER
   ========================================================= */
const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400); res.end('Bad request'); return;
  }

  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

  /* Chặn path traversal */
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — không tìm thấy: ' + urlPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': st.size
    });

    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(filePath).pipe(res);
  });
});

/* =========================================================
   WEBSOCKET (RFC 6455) — tự cài, không dependency
   ========================================================= */
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsAccept(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

/** Đóng gói 1 frame text (server → client, không mask). */
function encodeFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;

  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }
  header[0] = 0x81; // FIN + text

  return Buffer.concat([header, payload]);
}

function encodeClose(code) {
  const payload = Buffer.alloc(2);
  payload.writeUInt16BE(code || 1000, 0);
  const header = Buffer.from([0x88, payload.length]);
  return Buffer.concat([header, payload]);
}

/** Cắt các frame hoàn chỉnh khỏi buffer. Trả về {frames, rest}. */
function decodeFrames(buf) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buf.length) {
    const b0 = buf[offset];
    const b1 = buf[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = offset + 2;

    if (len === 126) {
      if (p + 2 > buf.length) break;
      len = buf.readUInt16BE(p);
      p += 2;
    } else if (len === 127) {
      if (p + 8 > buf.length) break;
      const hi = buf.readUInt32BE(p);
      const lo = buf.readUInt32BE(p + 4);
      len = hi * 4294967296 + lo;
      p += 8;
    }

    let mask = null;
    if (masked) {
      if (p + 4 > buf.length) break;
      mask = buf.subarray(p, p + 4);
      p += 4;
    }

    if (p + len > buf.length) break;

    let payload = buf.subarray(p, p + len);
    if (mask) {
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i & 3];
      payload = out;
    }

    frames.push({ opcode, payload });
    offset = p + len;
  }

  return { frames, rest: buf.subarray(offset) };
}

/* =========================================================
   ROOMS
   ========================================================= */
const rooms = new Map();   // code -> { code, host, guests: Map<id, sock> }
const sockets = new Set();

function makeId() {
  return crypto.randomBytes(4).toString('hex');
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 200; attempt++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += A[crypto.randomInt(A.length)];
    if (!rooms.has(c)) return c;
  }
  return 'R' + crypto.randomInt(100, 999);
}

function sendTo(sock, obj) {
  if (!sock || sock.destroyed || !sock.wsOpen) return;
  try { sock.write(encodeFrame(JSON.stringify(obj))); } catch (e) { /* bỏ qua */ }
}

function findRoomOf(sock) {
  for (const room of rooms.values()) {
    if (room.host === sock) return { room, role: 'host' };
    for (const [, g] of room.guests) {
      if (g === sock) return { room, role: 'guest' };
    }
  }
  return null;
}

function cleanup(sock) {
  const found = findRoomOf(sock);
  if (!found) return;
  const { room, role } = found;

  if (role === 'host') {
    for (const [, g] of room.guests) sendTo(g, { type: 'host_left' });
    rooms.delete(room.code);
    log(`phòng ${room.code} đóng (host thoát)`);
  } else {
    for (const [id, g] of room.guests) {
      if (g === sock) {
        room.guests.delete(id);
        sendTo(room.host, { type: 'guest_leave', playerId: id });
        log(`guest ${id} rời phòng ${room.code}`);
        break;
      }
    }
  }
}

/* =========================================================
   MESSAGE HANDLING
   ========================================================= */
function handleMessage(sock, raw) {
  let m;
  try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.type !== 'string') return;

  switch (m.type) {
    case 'host': {
      cleanup(sock);
      const code = makeCode();
      const playerId = makeId();
      sock.playerId = playerId;
      rooms.set(code, { code, host: sock, guests: new Map() });
      sendTo(sock, { type: 'hosted', code, playerId });
      log(`tạo phòng ${code}`);
      break;
    }

    case 'join': {
      const code = String(m.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        sendTo(sock, { type: 'error', message: 'KHÔNG TÌM THẤY PHÒNG ' + code });
        return;
      }
      if (room.guests.size >= 3) {
        sendTo(sock, { type: 'error', message: 'PHÒNG ĐÃ ĐẦY (TỐI ĐA 4 NGƯỜI)' });
        return;
      }
      cleanup(sock);
      const playerId = makeId();
      sock.playerId = playerId;
      room.guests.set(playerId, sock);
      sendTo(sock, { type: 'joined', playerId, code });
      sendTo(room.host, { type: 'guest_join', playerId });
      log(`guest ${playerId} vào phòng ${code}`);
      break;
    }

    case 'to_host': {
      const found = findRoomOf(sock);
      if (!found || found.role !== 'guest') return;
      const payload = Object.assign({}, m.data || {}, { fromId: sock.playerId });
      sendTo(found.room.host, payload);
      break;
    }

    case 'to_guests': {
      const found = findRoomOf(sock);
      if (!found || found.role !== 'host') return;
      for (const [, g] of found.room.guests) sendTo(g, m.data || {});
      break;
    }

    case 'to_guest': {
      const found = findRoomOf(sock);
      if (!found || found.role !== 'host') return;
      const target = found.room.guests.get(m.to);
      if (target) sendTo(target, m.data || {});
      break;
    }

    case 'ping':
      sendTo(sock, { type: 'pong', t: m.t });
      break;

    default:
      break;
  }
}

/* =========================================================
   UPGRADE
   ========================================================= */
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Accept: ' + wsAccept(key)
  ];
  socket.write(headers.join('\r\n') + '\r\n\r\n');

  socket.wsOpen = true;
  socket.setNoDelay(true);
  sockets.add(socket);

  let buf = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);

    /* Chống payload rác quá lớn */
    if (buf.length > 4 * 1024 * 1024) {
      socket.destroy();
      return;
    }

    const { frames, rest } = decodeFrames(buf);
    buf = rest;

    for (const f of frames) {
      if (f.opcode === 0x8) {              // close
        try { socket.write(encodeClose(1000)); } catch (e) {}
        socket.end();
        return;
      }
      if (f.opcode === 0x9) {              // ping
        const pong = Buffer.concat([Buffer.from([0x8a, f.payload.length]), f.payload]);
        try { socket.write(pong); } catch (e) {}
        continue;
      }
      if (f.opcode === 0x1) {              // text
        handleMessage(socket, f.payload.toString('utf8'));
      }
    }
  });

  const onEnd = () => {
    socket.wsOpen = false;
    sockets.delete(socket);
    cleanup(socket);
  };

  socket.on('close', onEnd);
  socket.on('error', onEnd);
});

/* =========================================================
   HELPERS + BOOT
   ========================================================= */
function log(msg) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(`[${t}] ${msg}`);
}

function localIPs() {
  const out = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

server.listen(PORT, '0.0.0.0', () => {
  const ips = localIPs();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║            HALF NIFE — LAN SERVER            ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log('  Máy này mở:   http://localhost:' + PORT);
  for (const ip of ips) {
    console.log('  Máy khác mở:  http://' + ip + ':' + PORT);
  }
  if (ips.length === 0) {
    console.log('  (Không tìm thấy IP LAN — kiểm tra kết nối mạng)');
  }
  console.log('');
  console.log('  Host bấm "CHƠI LAN" → TẠO PHÒNG → đưa mã 4 ký tự.');
  console.log('  Guest bấm "CHƠI LAN" → nhập mã → VÀO PHÒNG.');
  console.log('');
  console.log('  Ctrl+C để tắt.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Cổng ' + PORT + ' đang bận. Thử: node server.js ' + (PORT + 1) + '\n');
  } else {
    console.error('  Server lỗi:', err.message);
  }
  process.exit(1);
});

/* Tắt gọn gàng */
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    log('đang tắt...');
    for (const s of sockets) {
      try { s.write(encodeClose(1001)); s.end(); } catch (e) {}
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 800);
  });
}
