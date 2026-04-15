const net = require('net');
const dotenv = require('dotenv');

const env = dotenv.config({ path: '.env' }).parsed || {};
const ports = [
  { name: 'Auth Service', port: Number(env.AUTH_SERVICE_PORT || 3001), varName: 'AUTH_SERVICE_PORT' },
  { name: 'Messaging Service', port: Number(env.MESSAGING_SERVICE_PORT || 3002), varName: 'MESSAGING_SERVICE_PORT' },
  { name: 'Presence Service', port: Number(env.PRESENCE_SERVICE_PORT || 3003), varName: 'PRESENCE_SERVICE_PORT' },
  { name: 'Frontend', port: Number(env.FRONTEND_PORT || 5173), varName: 'FRONTEND_PORT' },
];

const checkPort = (port) => {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
  });
};

(async () => {
  const occupied = [];
  for (const item of ports) {
    const inUse = await checkPort(item.port);
    if (inUse) {
      occupied.push(item);
    }
  }

  if (occupied.length > 0) {
    console.error('\nERROR: One or more required ports are already in use.');
    for (const item of occupied) {
      console.error(`  - ${item.name} port ${item.port} (env ${item.varName})`);
    }
    console.error('\nStop the processes using these ports before running npm start.');
    console.error('Use `npm run check-ports` or Windows `netstat -ano | findstr :<port>` to inspect.');
    process.exit(1);
  }

  process.exit(0);
})();