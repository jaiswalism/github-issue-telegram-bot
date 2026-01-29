import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const payload = req.body;

  // Only care about newly opened issues
  if (payload.action !== "opened" || !payload.issue) {
    return res.status(200).send("Ignored");
  }

  const repo = payload.repository?.full_name;
  if (!repo) return res.status(200).send("No repo");

  const repos = (await kv.get("repos")) || [];

  if (!repos.includes(repo)) {
    return res.status(200).send("Repo not tracked");
  }

  const issue = payload.issue;

  const text = `
🆕 *New GitHub Issue*

📦 *Repo:* ${repo}
🐛 *#${issue.number}* – ${issue.title}
👤 *By:* ${issue.user.login}

🔗 ${issue.html_url}
`;

  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown"
      })
    }
  );

  return res.status(200).send("OK");
}
