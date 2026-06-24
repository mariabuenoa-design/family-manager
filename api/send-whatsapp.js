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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { to, message, sentBy } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" or "message"' });
  }

  const recipients = to === 'all-sisters'
    ? ['maria', 'nini', 'isabel', 'elena', 'marla']
    : [to];

  const results = [];

  for (const recipient of recipients) {
    const number = FAMILY_NUMBERS[recipient];
    if (!number) {
      results.push({ recipient, status: 'skipped', reason: 'no number configured' });
      continue;
    }

    try {
      const msg = await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${number}`,
        body: message
      });
      results.push({ recipient, status: 'sent', sid: msg.sid });
    } catch (err) {
      results.push({ recipient, status: 'failed', error: err.message });
    }
  }

  return res.status(200).json({
    success: true,
    sentBy: sentBy || 'system',
    results
  });
};
