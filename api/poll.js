import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const repos = (await kv.get("poll:repos")) || [];

  if (repos.length === 0) {
    return res.status(200).send("No repos to poll");
  }

  for (const repo of repos) {
    const lastSeen = await kv.get(`poll:last_seen:${repo}`);

    const url = new URL(`https://api.github.com/repos/${repo}/issues`);
    url.searchParams.set("state", "open");
    url.searchParams.set("per_page", "1");
    if (lastSeen) url.searchParams.set("since", lastSeen);

    const ghRes = await fetch(url, {
      headers: {
        "Accept": "application/vnd.github+json",
        "User-Agent": "telegram-issue-bot"
      }
    });

    if (!ghRes.ok) continue;

    const issues = await ghRes.json();
    if (!issues.length) continue;

    const issue = issues[0];

    // GitHub returns PRs as issues — ignore them
    if (issue.pull_request) continue;

    await kv.set(`poll:last_seen:${repo}`, issue.created_at);

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
  }

  return res.status(200).send("Poll complete");
}
