const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FAMILY_NUMBERS = {
  maria: process.env.WHATSAPP_MARIA,
  nini: process.env.WHATSAPP_NINI,
  isabel: process.env.WHATSAPP_ISABEL,
  elena: process.env.WHATSAPP_ELENA,
  marla: process.env.WHATSAPP_MARLA
};

const FIREBASE_URL = 'https://family-manager-a8aed-default-rtdb.firebaseio.com';

async function fetchFirebase(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  return res.json();
}

async function sendWhatsApp(to, message) {
  const number = FAMILY_NUMBERS[to];
  if (!number) return null;
  return client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${number}`,
    body: message
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

module.exports = async function handler(req, res) {
  const doctors = await fetchFirebase('medical/doctors');
  const tasks = await fetchFirebase('tasks');

  if (!doctors) {
    return res.status(200).json({ message: 'No data' });
  }

  // Build digest
  const overdue = [];
  const thisWeek = [];
  const nextWeek = [];

  for (const [id, doc] of Object.entries(doctors)) {
    const days = daysUntil(doc.nextVisit);
    if (days === null) continue;

    const parentName = doc.parent === 'mama' ? 'Mami' : 'Papi';
    const line = `${parentName} — Dr. ${doc.doctor} (${doc.specialty}) [${doc.responsible}]`;

    if (days <= 0) overdue.push(line);
    else if (days <= 7) thisWeek.push(`${line} — in ${days}d`);
    else if (days <= 14) nextWeek.push(`${line} — in ${days}d`);
  }

  // Count task status
  let tasksDone = 0, tasksOpen = 0, tasksUnclaimed = 0;
  if (tasks) {
    for (const t of Object.values(tasks)) {
      if (t.done) tasksDone++;
      else {
        tasksOpen++;
        if (!t.claimedBy) tasksUnclaimed++;
      }
    }
  }

  const digest = [
    `📋 *Weekly Family Manager Digest*`,
    `_${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}_`,
    ``,
    `📊 *Status:* ${tasksOpen} open tasks | ${tasksDone} completed | ${tasksUnclaimed} unclaimed`,
    ``
  ];

  if (overdue.length) {
    digest.push(`🚨 *OVERDUE (${overdue.length}):*`);
    overdue.forEach(l => digest.push(`  • ${l}`));
    digest.push('');
  }

  if (thisWeek.length) {
    digest.push(`📅 *This Week (${thisWeek.length}):*`);
    thisWeek.forEach(l => digest.push(`  • ${l}`));
    digest.push('');
  }

  if (nextWeek.length) {
    digest.push(`🔜 *Next Week (${nextWeek.length}):*`);
    nextWeek.forEach(l => digest.push(`  • ${l}`));
    digest.push('');
  }

  if (!overdue.length && !thisWeek.length) {
    digest.push(`✅ No upcoming appointments this week. All clear!`);
  }

  digest.push(``, `💪 Let's keep Mom & Dad on track. Respond here if you need to swap a task.`);

  const message = digest.join('\n');

  // Send to all sisters
  for (const sister of Object.keys(FAMILY_NUMBERS)) {
    await sendWhatsApp(sister, message);
  }

  return res.status(200).json({
    success: true,
    digest: message,
    sentTo: Object.keys(FAMILY_NUMBERS)
  });
};
