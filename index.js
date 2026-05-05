const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = "1492749346154877080";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent  // ← BẮT BUỘC để đọc được nội dung tin nhắn
  ]
});

// 1. Gửi tin nhắn (Trả về ID để Launcher lưu lại)
app.post('/send', upload.single('file'), async (req, res) => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const payload = JSON.parse(req.body.payload_json);
    const options = { embeds: payload.embeds };

    if (req.file) {
      const attachment = new AttachmentBuilder(req.file.buffer, { name: req.file.originalname });
      options.files = [attachment];
    }

    const message = await channel.send(options);
    res.status(200).json({ id: message.id }); // Trả về ID tin nhắn
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 2. Thu hồi tin nhắn
app.delete('/delete/:id', async (req, res) => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const message = await channel.messages.fetch(req.params.id);
    await message.delete();
    res.status(200).send("Deleted");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 3. Chỉnh sửa tin nhắn
app.patch('/edit/:id', async (req, res) => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const message = await channel.messages.fetch(req.params.id);

    // Sửa nội dung trong Embed
    const oldEmbed = message.embeds[0];
    const newEmbed = {
      ...oldEmbed.data,
      fields: oldEmbed.data.fields.map(f =>
        f.name === "💬 Nội dung" ? { ...f, value: req.body.text } : f
      )
    };

    await message.edit({ embeds: [newEmbed] });
    res.status(200).send("Edited");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 4. Poll tin nhắn theo userId — frontend gọi cái này
const refMsgCache = new Map(); // cache để không fetch lại cùng 1 message nhiều lần

app.get('/poll', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json([]);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 30 });
    const results = [];

    for (const m of messages.values()) {
      // Chỉ lấy tin của người thật, bỏ bot
      if (m.author.bot) continue;
      // Phải là reply (có referenced message)
      if (!m.reference?.messageId) continue;

      // Lấy referenced message — dùng cache tránh rate-limit
      let refMsg = refMsgCache.get(m.reference.messageId);
      if (!refMsg) {
        try {
          refMsg = await channel.messages.fetch(m.reference.messageId);
          refMsgCache.set(m.reference.messageId, refMsg);
          // Giới hạn cache size
          if (refMsgCache.size > 200) {
            const firstKey = refMsgCache.keys().next().value;
            refMsgCache.delete(firstKey);
          }
        } catch (e) { continue; }
      }

      // Chỉ trả về nếu reply đúng vào message của userId này
      const refFooter = refMsg.embeds?.[0]?.footer?.text || "";
      const isForThisUser = refFooter.includes(userId);
      if (!isForThisUser) continue;

      results.push({
        id: m.id,
        authorId: m.author.id,
        content: m.content,
        timestamp: m.createdAt,
        attachments: [...m.attachments.values()].map(a => ({
          name: a.name,
          url: a.url,
          contentType: a.contentType
        }))
      });
    }

    res.json(results);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// 5. Lấy danh sách tin nhắn mới nhất (Để Launcher hiển thị phản hồi)
app.get('/replies', async (req, res) => {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const messages = await channel.messages.fetch({ limit: 15 });

    // Tải tin nhắn gốc nếu là Reply
    const formatted = await Promise.all(messages.map(async m => {
      let refMsg = m.referencedMessage;
      if (!refMsg && m.reference && m.reference.messageId) {
        try {
          refMsg = await channel.messages.fetch(m.reference.messageId);
        } catch (e) {
          console.log("Fetch ref error:", e.message);
        }
      }

      return {
        id: m.id,
        authorId: m.author.id,
        content: m.content,
        timestamp: m.createdTimestamp,
        attachments: m.attachments.map(a => ({
          name: a.name,
          url: a.url,
          contentType: a.contentType
        })),
        referenced_message: refMsg ? {
          embeds: refMsg.embeds.map(e => ({
            footer: e.footer ? { text: e.footer.text } : null
          }))
        } : null
      };
    }));

    res.status(200).json(formatted);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Advanced Proxy Server is running...");
});

client.once('ready', () => {
  console.log(`Bot Online: ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);