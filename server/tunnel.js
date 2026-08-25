const localtunnel = require('localtunnel');

const PORT = process.env.PORT || 5000;

async function startTunnel() {
  console.log(`🌐 Initializing secure public tunnel for JanSetu API on port ${PORT}...`);
  try {
    const tunnel = await localtunnel({ port: PORT });

    console.log(`\n=======================================================`);
    console.log(`🚀 PUBLIC TUNNEL IS LIVE & ACTIVE!`);
    console.log(`🔗 Public URL: ${tunnel.url}`);
    console.log(`\n📞 Twilio Voice Webhook URL:`);
    console.log(`   ${tunnel.url}/api/voice/incoming`);
    console.log(`\n📱 Twilio WhatsApp Webhook URL:`);
    console.log(`   ${tunnel.url}/api/whatsapp`);
    console.log(`=======================================================\n`);

    tunnel.on('close', () => {
      console.log('⚠️ Tunnel closed. Reconnecting in 3 seconds...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('⚠️ Tunnel error:', err.message);
      tunnel.close();
    });
  } catch (err) {
    console.error('💥 Failed to start tunnel:', err.message);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();
