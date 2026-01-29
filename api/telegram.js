import { kv } from "@vercel/kv";

// Helper: normalize repo input
function extractRepo(input) {
  let text = input.trim();

  // Remove protocol
  text = text.replace(/^https?:\/\//, "");

  // Remove github.com/
  text = text.replace(/^github\.com\//, "");

  // Remove trailing paths like /issues
  const parts = text.split("/");
  if (parts.length < 2) return null;

  return `${parts[0]}/${parts[1]}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const message = req.body.message;
  if (!message || !message.text) return res.status(200).end();

  const chatId = message.chat.id;

  const raw = message.text.trim();
  const firstLine = raw.split("\n")[0];
  const [cmdWithBot, ...args] = firstLine.split(" ");
  const command = cmdWithBot.split("@")[0];
  const argument = args.join(" ").trim();

  let repos = (await kv.get("poll:repos")) || [];
  let reply = "❓ Unknown command";

  // ---- ADD ----
  if (command === "/add") {
    if (!argument) {
      reply = `📥 Send the GitHub repo to track.

Examples:
• jaegertracing/jaeger
• https://github.com/jaegertracing/jaeger`;
    } else {
      const repo = extractRepo(argument);

      if (!repo) {
        reply = "⚠️ Invalid repo format. Use owner/repo or a GitHub URL.";
      } else if (!repos.includes(repo)) {
        repos.push(repo);
        await kv.set("poll:repos", repos);
        reply = `✅ Added repo:\n${repo}`;
      } else {
        reply = `⚠️ Repo already tracked:\n${repo}`;
      }
    }
  }

  // ---- REMOVE ----
  else if (command === "/remove") {
    if (!argument) {
      reply = "⚠️ Usage: /remove owner/repo or GitHub URL";
    } else {
      const repo = extractRepo(argument);

      if (!repo) {
        reply = "⚠️ Invalid repo format.";
      } else {
        repos = repos.filter(r => r !== repo);
        await kv.set("poll:repos", repos);
        await kv.del(`poll:last_seen:${repo}`);
        reply = `🗑 Removed repo:\n${repo}`;
      }
    }
  }

  // ---- LIST ----
  else if (command === "/list") {
    reply = repos.length
      ? `📡 Tracked repos:\n\n${repos.map(r => `• ${r}`).join("\n")}`
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
