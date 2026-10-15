// Scriptable widget: shows open tasks assigned to you.
const BASE_URL = "https://YOUR_HOST";
const TOKEN = "fw_PASTE_TOKEN_HERE";

async function load() {
  const req = new Request(`${BASE_URL}/api/widget/tasks`);
  req.headers = { Authorization: `Bearer ${TOKEN}` };
  return await req.loadJSON();
}

const w = new ListWidget();
w.backgroundColor = new Color("#0f172a");
try {
  const data = await load();
  const title = w.addText(`${data.user.name}'s tasks`);
  title.font = Font.boldSystemFont(14);
  title.textColor = Color.white();
  w.addSpacer(4);
  const max = config.widgetFamily === "large" ? 12 : config.widgetFamily === "medium" ? 5 : 3;
  if (data.tasks.length === 0) {
    const t = w.addText("All done 🎉");
    t.textColor = Color.white();
  }
  for (const task of data.tasks.slice(0, max)) {
    let line = task.title;
    if (task.dueDate) line += ` · ${new Date(task.dueDate).toLocaleDateString()}`;
    const t = w.addText(`${task.priority === "HIGH" ? "❗" : "•"} ${line}`);
    t.font = Font.systemFont(12);
    t.textColor = Color.white();
    t.lineLimit = 1;
  }
} catch (e) {
  const t = w.addText("Failed to load tasks");
  t.textColor = Color.red();
}
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
Script.complete();
