const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = "1331293347575660604"; // ID kênh đúng của bạn

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// Endpoint nhận tin từ Launcher
app.post('/send', upload.single('file'), async (req, res) => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return res.status(404).send("Channel not found");

    const payload = JSON.parse(req.body.payload_json);
    const options = { embeds: payload.embeds };

    if (req.file) {
      const attachment = new AttachmentBuilder(req.file.buffer, { name: req.file.originalname });
      options.files = [attachment];
    }

    await channel.send(options);
    res.status(200).send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Proxy Server is running...");
});

client.once('ready', () => {
  console.log(`Bot Online: ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);
