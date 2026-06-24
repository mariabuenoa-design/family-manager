import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { config } from 'dotenv';
config();
import { parseMessage } from './ai-parser.mjs';

const FAMILY_GROUP_NAME = process.env.WHATSAPP_GROUP_NAME || 'Family Manager';

const FIREBASE_URL = 'https://family-manager-a8aed-default-rtdb.firebaseio.com';

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
  }
});

client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp on your phone:\n');
  qrcode.generate(qr, { small: true });
  console.log('\nOpen WhatsApp → Settings → Linked Devices → Link a Device\n');
});

client.on('ready', async () => {
  console.log('✅ Family Care Agent is connected to WhatsApp!');
  console.log(`   Listening for messages in group: "${FAMILY_GROUP_NAME}"`);

  // Send instructions to the group on startup if flag is set
  if (process.env.SEND_INSTRUCTIONS === 'true') {
    const chats = await client.getChats();
    const group = chats.find(c => c.isGroup && c.name.toLowerCase().includes(FAMILY_GROUP_NAME.toLowerCase()));
    if (group) {
      await group.sendMessage(
        `🤖 Hola familia! Aquí les explico cómo usar el agente:\n\n` +
        `📝 *COMANDOS:*\n` +
        `• *status* → ver todo (citas, quién es responsable, qué está pendiente)\n` +
        `• *overdue* → ver qué está atrasado\n` +
        `• *this week* → qué viene esta semana\n\n` +
        `✅ *PARA REPORTAR QUE FUERON AL DOCTOR:*\n` +
        `• done Mama fue a Carbunar\n` +
        `• done Papa fue a Manhart\n\n` +
        `📅 *PARA ACTUALIZAR INFORMACIÓN:*\n` +
        `• update Mama derm se movió para 18 de agosto\n` +
        `• update Papa próxima cita con Schwarzberg es 10 de sept\n\n` +
        `📲 *PARA MANDARLE RECORDATORIO A MAMI:*\n` +
        `• remind mom tu cita con Dr Manhart es mañana a las 10am\n\n` +
        `Pueden escribir en español o inglés. Si tienen dudas: /help\n\n` +
        `❤️ Entre todas mantenemos a Mami y Papi on track!`
      );
      console.log('📨 Instructions sent to group!');
    }
  }
});

client.on('message_create', async (msg) => {
  const chat = await msg.getChat();

  // Only process messages from the family group
  if (!chat.isGroup) return;

  const groupName = chat.name.toLowerCase();
  const targetName = FAMILY_GROUP_NAME.toLowerCase();

  if (!groupName.includes(targetName) && !targetName.includes(groupName)) {
    // Try partial match — check if key words overlap
    const groupWords = groupName.split(/\s+/);
    const targetWords = targetName.split(/\s+/);
    const overlap = groupWords.some(w => targetWords.includes(w) && w.length > 2);
    if (!overlap) return;
  }

  // Ignore messages from the agent itself (prevent loops)
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('📋')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('✅')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('🚨')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('📅')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('🤖')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('⚠️')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('❌')) return;
  if (msg.fromMe && msg.type === 'chat' && msg.body.startsWith('📲')) return;

  const contact = await msg.getContact();
  const sender = contact.pushname || contact.name || msg.from;
  const body = msg.body.toLowerCase().trim();

  // Skip empty messages
  if (!body) return;

  console.log(`[${chat.name}] ${sender}: ${msg.body}`);

  // Command: status / update / how are we doing
  if (body === '/status' || body === 'status' || body.includes('how are we doing')) {
    const digest = await buildDigest();
    await chat.sendMessage(digest);
    return;
  }

  // Command: /help
  if (body === '/help' || body === 'help agent') {
    await chat.sendMessage(
      `🤖 *Family Care Agent — Commands*\n\n` +
      `• *status* — see weekly overview\n` +
      `• *overdue* — list overdue appointments\n` +
      `• *this week* — what's coming up\n` +
      `• *update [info]* — tell me something new (e.g., "update Mom's derm moved to Aug 18")\n` +
      `• *done [task]* — mark something complete\n` +
      `• *remind mom [message]* — send Mom a WhatsApp reminder in Spanish\n` +
      `• */help* — show this menu\n\n` +
      `Or just share info naturally — I'll parse it and update the tracker.`
    );
    return;
  }

  // Command: overdue
  if (body === 'overdue' || body === '/overdue') {
    const overdue = await getOverdue();
    await chat.sendMessage(overdue);
    return;
  }

  // Command: this week
  if (body === 'this week' || body === '/thisweek') {
    const upcoming = await getThisWeek();
    await chat.sendMessage(upcoming);
    return;
  }

  // Command: update — parse natural language input
  if (body.startsWith('update ') || body.startsWith('/update ')) {
    const info = msg.body.replace(/^\/?(update)\s+/i, '');
    await processUpdate(info, sender, chat);
    return;
  }

  // Command: done — mark a task complete
  if (body.startsWith('done ') || body.startsWith('/done ')) {
    const taskDesc = msg.body.replace(/^\/?(done)\s+/i, '');
    await markTaskDone(taskDesc, sender, chat);
    return;
  }

  // Command: remind mom/dad
  if (body.startsWith('remind mom') || body.startsWith('remind dad') || body.startsWith('remind mama') || body.startsWith('remind papa')) {
    const isMom = body.includes('mom') || body.includes('mama');
    const message = msg.body.replace(/^remind\s+(mom|dad|mama|papa)\s*/i, '');
    await sendParentReminder(isMom ? 'mama' : 'papa', message, sender, chat);
    return;
  }

  // AI-powered natural language parsing — understands Spanish and English
  if (msg.body.length > 5) {
    const parsed = await parseMessage(msg.body, sender);
    if (parsed.actionable) {
      await handleAIUpdate(parsed, sender, chat);
      return;
    }
  }
});

// --- Helper Functions ---

async function fetchFirebase(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  return res.json();
}

async function writeFirebase(path, data) {
  await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

async function buildDigest() {
  const doctors = await fetchFirebase('medical/doctors');
  const tasks = await fetchFirebase('tasks');

  if (!doctors) return '📋 No medical data loaded yet.';

  let overdue = 0, thisWeek = 0, onTrack = 0;
  const overdueList = [];
  const weekList = [];

  for (const [id, doc] of Object.entries(doctors)) {
    const days = daysUntil(doc.nextVisit);
    if (days === null) continue;
    const parentName = doc.parent === 'mama' ? 'Mami' : 'Papi';
    const line = `${parentName} — Dr. ${doc.doctor} (${doc.specialty}) [${doc.responsible}]`;

    if (days <= 0) { overdue++; overdueList.push(line); }
    else if (days <= 7) { thisWeek++; weekList.push(`${line} — ${days}d`); }
    else { onTrack++; }
  }

  let tasksDone = 0, tasksOpen = 0;
  if (tasks) {
    for (const t of Object.values(tasks)) {
      if (t.done) tasksDone++; else tasksOpen++;
    }
  }

  let msg = `📋 *Family Manager Status*\n\n`;
  msg += `📊 ${tasksOpen} open | ${tasksDone} done | ${overdue} overdue\n\n`;

  if (overdueList.length) {
    msg += `🚨 *Overdue:*\n`;
    overdueList.forEach(l => msg += `  • ${l}\n`);
    msg += '\n';
  }
  if (weekList.length) {
    msg += `📅 *This Week:*\n`;
    weekList.forEach(l => msg += `  • ${l}\n`);
    msg += '\n';
  }
  if (!overdueList.length && !weekList.length) {
    msg += `✅ No urgent appointments. Looking good!\n`;
  }

  return msg;
}

async function getOverdue() {
  const doctors = await fetchFirebase('medical/doctors');
  if (!doctors) return 'No data loaded.';

  const overdueList = [];
  for (const [id, doc] of Object.entries(doctors)) {
    const days = daysUntil(doc.nextVisit);
    if (days !== null && days <= 0) {
      const parentName = doc.parent === 'mama' ? 'Mami' : 'Papi';
      overdueList.push(`• ${parentName} — Dr. ${doc.doctor} (${doc.specialty}) — ${Math.abs(days)}d overdue [${doc.responsible}]`);
    }
  }

  if (!overdueList.length) return '✅ Nothing overdue!';
  return `🚨 *Overdue Appointments (${overdueList.length}):*\n\n${overdueList.join('\n')}`;
}

async function getThisWeek() {
  const doctors = await fetchFirebase('medical/doctors');
  if (!doctors) return 'No data loaded.';

  const weekList = [];
  for (const [id, doc] of Object.entries(doctors)) {
    const days = daysUntil(doc.nextVisit);
    if (days !== null && days > 0 && days <= 7) {
      const parentName = doc.parent === 'mama' ? 'Mami' : 'Papi';
      weekList.push(`• ${parentName} — Dr. ${doc.doctor} (${doc.specialty}) — in ${days}d [${doc.responsible}]`);
    }
  }

  if (!weekList.length) return '📅 No appointments this week.';
  return `📅 *This Week (${weekList.length}):*\n\n${weekList.join('\n')}`;
}

async function processUpdate(info, sender, chat) {
  // Store the update in Firebase for processing
  await writeFirebase('agent_updates', {
    raw: info,
    sender: sender,
    timestamp: new Date().toISOString(),
    processed: false
  });

  await chat.sendMessage(`✅ Got it, ${sender}! I've logged this update:\n_"${info}"_\n\nI'll update the tracker.`);
}

async function markTaskDone(taskDesc, sender, chat) {
  await writeFirebase('agent_updates', {
    type: 'done',
    description: taskDesc,
    sender: sender,
    timestamp: new Date().toISOString()
  });

  await chat.sendMessage(`✅ Marked as done by ${sender}: _"${taskDesc}"_`);
}

async function sendParentReminder(parent, message, sender, chat) {
  const parentName = parent === 'mama' ? 'Mami' : 'Papi';

  // Translate to Spanish (simple for now)
  const spanishMsg = parent === 'mama'
    ? `${parentName}, recordatorio de ${sender}: ${message}`
    : `${parentName}, recordatorio de ${sender}: ${message}`;

  // Use Twilio for the actual parent message (1:1 reliable delivery)
  const twilio = (await import('twilio')).default;
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const parentNumber = parent === 'mama' ? process.env.WHATSAPP_MAMA : process.env.WHATSAPP_PAPA;

  if (!parentNumber) {
    await chat.sendMessage(`⚠️ ${parentName}'s WhatsApp number isn't configured yet.`);
    return;
  }

  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${parentNumber}`,
      body: spanishMsg
    });
    await chat.sendMessage(`📲 Sent to ${parentName}: _"${spanishMsg}"_`);
  } catch (err) {
    await chat.sendMessage(`❌ Couldn't send to ${parentName}: ${err.message}`);
  }
}

async function handleAIUpdate(parsed, sender, chat) {
  console.log(`  🧠 AI parsed:`, JSON.stringify(parsed, null, 2));

  // Update Firebase based on type
  if (parsed.doctor && (parsed.type === 'appointment_attended' || parsed.type === 'appointment_scheduled' || parsed.type === 'appointment_rescheduled')) {
    // Find and update the doctor record
    const res = await fetch(`${FIREBASE_URL}/medical/doctors.json`);
    const doctors = await res.json();

    if (doctors) {
      for (const [key, doc] of Object.entries(doctors)) {
        if (doc.doctor && doc.doctor.toLowerCase() === parsed.doctor.toLowerCase()) {
          const updates = {};

          if (parsed.type === 'appointment_attended') {
            updates.lastVisit = parsed.date || new Date().toISOString().split('T')[0];
            updates.lastVisitNote = `Attended - confirmed by ${sender}`;
            if (parsed.next_visit_date) {
              updates.nextVisit = parsed.next_visit_date;
            }
          } else if (parsed.type === 'appointment_scheduled' || parsed.type === 'appointment_rescheduled') {
            if (parsed.next_visit_date || parsed.date) {
              updates.nextVisit = parsed.next_visit_date || parsed.date;
            }
          }

          if (Object.keys(updates).length > 0) {
            await fetch(`${FIREBASE_URL}/medical/doctors/${key}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates)
            });
          }
          break;
        }
      }
    }
  }

  // Log the update
  await writeFirebase('agent_updates', {
    type: parsed.type,
    parent: parsed.parent,
    doctor: parsed.doctor,
    date: parsed.date,
    sender: sender,
    summary: parsed.summary_en,
    timestamp: new Date().toISOString(),
    raw: parsed
  });

  // Respond in the group in Spanish
  if (parsed.summary_es) {
    await chat.sendMessage(`✅ ${parsed.summary_es}`);
  }
}

// Start the agent
console.log('🚀 Starting Family Care Agent...');
console.log('   Waiting for QR code...\n');
client.initialize();
qrcode.generate(qr, { small: true });
