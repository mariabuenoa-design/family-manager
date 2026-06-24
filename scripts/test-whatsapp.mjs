import twilio from 'twilio';
import { config } from 'dotenv';
config();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function test() {
  console.log('Sending test WhatsApp message to Maria...');
  try {
    const msg = await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${process.env.WHATSAPP_MARIA}`,
      body: '✅ Family Care Agent is LIVE! This is a test message from the Family Manager system. If you see this, WhatsApp integration is working.'
    });
    console.log(`✅ Message sent! SID: ${msg.sid}`);
    console.log(`   Status: ${msg.status}`);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
    if (err.code === 63007) {
      console.log('\n⚠️  You need to join the sandbox first!');
      console.log('   Send "join <your-sandbox-code>" to +14155238886 from your WhatsApp.');
      console.log('   Find your code at: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
    }
  }
}

test();
