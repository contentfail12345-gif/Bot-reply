const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// 1. Tạo Server HTTP để Render không bị Sleep
http.createServer((req, res) => {
  res.write('LocaTool Bot is Online!');
  res.end();
}).listen(process.env.PORT || 3000);

// 2. Cấu hình Bot Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

client.once('ready', () => {
  console.log(`Đã đăng nhập thành công: ${client.user.tag}`);
  client.user.setActivity('Hỗ trợ LocaTool', { type: 3 }); 
});

client.login(DISCORD_TOKEN);
