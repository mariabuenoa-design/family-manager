const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FAMILY_NUMBERS = {
  mama: process.env.WHATSAPP_MAMA,
  papa: process.env.WHATSAPP_PAPA,
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
  try {
    return await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${number}`,
      body: message
    });
  } catch (err) {
    console.error(`Failed to send to ${to}:`, err.message);
    return null;
  }
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
    return res.status(200).json({ message: 'No medical data found' });
  }

  const alerts = [];
  const reminders = [];

  // Check doctor appointments
  for (const [id, doc] of Object.entries(doctors)) {
    const days = daysUntil(doc.nextVisit);
    if (days === null) continue;

    const parentName = doc.parent === 'mama' ? 'Mami' : 'Papi';
    const doctorInfo = `Dr. ${doc.doctor} (${doc.specialty})`;

    if (days <= 0) {
      // Overdue
      alerts.push({
        type: 'overdue',
        responsible: doc.responsible,
        message: `🚨 OVERDUE: ${parentName} — ${doctorInfo} appointment was due ${Math.abs(days)} days ago. Action needed!`,
        parentMessage: `${parentName}, tu cita con ${doctorInfo} está atrasada. ¿Necesitas ayuda para reprogramar?`
      });
    } else if (days <= 3) {
      // 3-day reminder
      reminders.push({
        type: 'soon',
        responsible: doc.responsible,
        parent: doc.parent,
        message: `⚡ ${parentName} has appointment with ${doctorInfo} in ${days} day${days > 1 ? 's' : ''}`,
        parentMessage: `${parentName}, tienes cita con ${doctorInfo} en ${days} día${days > 1 ? 's' : ''}. ¿Todo listo?`
      });
    } else if (days <= 7) {
      // 7-day reminder
      reminders.push({
        type: 'upcoming',
        responsible: doc.responsible,
        parent: doc.parent,
        message: `📅 ${parentName} — ${doctorInfo} in ${days} days`,
        parentMessage: `${parentName}, recordatorio: tienes cita con ${doctorInfo} en ${days} días.`
      });
    }
  }

  // Check overdue tasks
  if (tasks) {
    for (const [id, task] of Object.entries(tasks)) {
      if (task.done) continue;
      if (task.urgency === 'red' && !task.claimedBy) {
        alerts.push({
          type: 'unclaimed',
          responsible: 'all-sisters',
          message: `🔴 UNCLAIMED & OVERDUE: "${task.title}" — no one has claimed this. Who's handling it?`
        });
      }
    }
  }

  const sent = [];

  // Send overdue alerts to responsible sister + escalate if needed
  for (const alert of alerts) {
    if (alert.responsible && alert.responsible !== 'all-sisters') {
      await sendWhatsApp(alert.responsible, alert.message);
      sent.push({ to: alert.responsible, msg: alert.message });
    }

    // Escalate overdue to all sisters
    if (alert.type === 'overdue' || alert.type === 'unclaimed') {
      for (const sister of ['maria', 'nini', 'isabel', 'elena', 'marla']) {
        if (sister !== alert.responsible) {
          await sendWhatsApp(sister, alert.message);
          sent.push({ to: sister, msg: alert.message });
        }
      }
    }

    // Send parent reminder in Spanish
    if (alert.parentMessage) {
      const parent = alert.message.includes('Mami') ? 'mama' : 'papa';
      await sendWhatsApp(parent, alert.parentMessage);
      sent.push({ to: parent, msg: alert.parentMessage });
    }
  }

  // Send upcoming reminders to responsible sister + parent
  for (const reminder of reminders) {
    await sendWhatsApp(reminder.responsible, reminder.message);
    sent.push({ to: reminder.responsible, msg: reminder.message });

    if (reminder.type === 'soon') {
      await sendWhatsApp(reminder.parent, reminder.parentMessage);
      sent.push({ to: reminder.parent, msg: reminder.parentMessage });
    }
  }

  // Log run to Firebase
  await fetch(`${FIREBASE_URL}/agent_runs.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      alerts: alerts.length,
      reminders: reminders.length,
      messagesSent: sent.length
    })
  });

  return res.status(200).json({
    success: true,
    timestamp: new Date().toISOString(),
    summary: {
      alerts: alerts.length,
      reminders: reminders.length,
      messagesSent: sent.length
    },
    details: { alerts, reminders, sent }
  });
};
