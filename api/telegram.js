import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const message = req.body.message;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;

  // --- Robust command parsing ---
  const rawText = message.text.trim();
  const firstLine = rawText.split("\n")[0]; // ignore multiline junk
  const [commandWithBot, ...args] = firstLine.split(" ");

  // Remove @BotUsername if present
  const command = commandWithBot.split("@")[0];
  const argument = args.join(" ").trim();

  let repos = (await kv.get("repos")) || [];
  let reply = "❓ Unknown command";

  if (command === "/add") {
    if (!argument) {
      reply = "⚠️ Usage: /add owner/repo";
    } else if (!repos.includes(argument)) {
      repos.push(argument);
      await kv.set("repos", repos);
      reply = `✅ Added repo:\n${argument}`;
    } else {
      reply = `⚠️ Repo already tracked:\n${argument}`;
    }
  }

  else if (command === "/remove") {
    if (!argument) {
      reply = "⚠️ Usage: /remove owner/repo";
    } else {
      repos = repos.filter(r => r !== argument);
      await kv.set("repos", repos);
      reply = `🗑 Removed repo:\n${argument}`;
    }
  }

  else if (command === "/list") {
    reply = repos.length
      ? `📦 Tracked repos:\n\n${repos.map(r => `• ${r}`).join("\n")}`
      : "📭 No repos tracked";
  }

  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply
      })
    }
  );

  return res.status(200).send("OK");
}
