import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const message = req.body.message;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text.trim();

  let repos = (await kv.get("repos")) || [];
  let reply = "❓ Unknown command";

  if (text.startsWith("/add ")) {
    const repo = text.replace("/add ", "").trim();

    if (!repos.includes(repo)) {
      repos.push(repo);
      await kv.set("repos", repos);
      reply = `✅ Added repo:\n${repo}`;
    } else {
      reply = `⚠️ Repo already tracked:\n${repo}`;
    }
  }

  else if (text.startsWith("/remove ")) {
    const repo = text.replace("/remove ", "").trim();
    repos = repos.filter(r => r !== repo);
    await kv.set("repos", repos);
    reply = `🗑 Removed repo:\n${repo}`;
  }

  else if (text === "/list") {
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
