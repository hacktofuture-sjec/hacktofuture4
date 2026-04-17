const net = require('net');

const ports = [
  { name: 'Gateway', env: 'GATEWAY_PORT', default: 3000 },
  { name: 'Auth Service', env: 'AUTH_SERVICE_PORT', default: 3001 },
  { name: 'Messaging Service', env: 'MESSAGING_SERVICE_PORT', default: 3002 },
  { name: 'Presence Service', env: 'PRESENCE_SERVICE_PORT', default: 3003 },
  { name: 'Frontend', env: 'FRONTEND_PORT', default: 5173 },
];

const checkPort = (port) => {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve({ port, inUse: true });
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ port, inUse: false });
    });
    socket.on('error', () => {
      resolve({ port, inUse: false });
    });
  });
};

(async () => {
  console.log('Checking service ports...');
  for (const item of ports) {
    const port = Number(process.env[item.env] || item.default);
    const result = await checkPort(port);
    console.log(`${item.name.padEnd(15)} | port ${String(port).padEnd(4)} | ${result.inUse ? 'IN USE' : 'available'}`);
  }
  process.exit(0);
})();