import { readFileSync } from 'fs';

const FIREBASE_URL = 'https://family-manager-a8aed-default-rtdb.firebaseio.com';
const data = JSON.parse(readFileSync('/tmp/family_data.json', 'utf-8'));

async function put(path, payload) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to write ${path}: ${res.statusText}`);
}

async function upload() {
  console.log('Uploading doctors...');
  const doctors = {};
  let i = 0;
  for (const doc of data.doctors) {
    if (doc.status === 'active') {
      doctors[`doc_${i++}`] = {
        parent: doc.parent.toLowerCase(),
        specialty: doc.especialidad,
        center: doc.center,
        doctor: doc.doctor,
        emr: doc.emr,
        website: doc.website,
        diagnosis: doc.diagnosis,
        phone: doc.phone,
        responsible: doc.responsible.toLowerCase(),
        actionNeeded: doc.action_needed,
        nextVisit: doc.nov || null,
        frequency: doc.frequency
      };
    }
  }
  await put('medical/doctors', doctors);
  console.log(`  → ${Object.keys(doctors).length} active doctors uploaded`);

  console.log('Uploading medications...');
  const meds = {};
  i = 0;
  for (const med of data.medications) {
    if (med.status === 'active') {
      meds[`med_${i++}`] = {
        parent: med.parent.toLowerCase(),
        name: med.rx,
        directions: med.directions,
        diagnosis: med.dx,
        prescriber: med.prescriber
      };
    }
  }
  await put('medical/medications', meds);
  console.log(`  → ${Object.keys(meds).length} active medications uploaded`);

  console.log('Uploading medical history...');
  const hx = {};
  i = 0;
  for (const h of data.history) {
    hx[`hx_${i++}`] = {
      parent: h.parent.toLowerCase(),
      diagnosis: h.diagnosis,
      doctor: h.doctor
    };
  }
  await put('medical/history', hx);
  console.log(`  → ${Object.keys(hx).length} history entries uploaded`);

  console.log('Uploading family contacts...');
  await put('family', {
    maria: { name: 'Maria', role: 'coordinator', whatsapp: '+16179222383' },
    nini: { name: 'Nini', role: 'sister', whatsapp: '+17863529509' },
    isabel: { name: 'Isabel', role: 'sister', whatsapp: '+15615312279' },
    elena: { name: 'Elena', role: 'sister', whatsapp: '+15613194485' },
    marla: { name: 'Marla', role: 'sister', whatsapp: null },
    mama: { name: 'Mama', role: 'parent', whatsapp: null, language: 'es' },
    papa: { name: 'Papa', role: 'parent', whatsapp: null, language: 'es' }
  });
  console.log('  → Family contacts uploaded');

  console.log('\n✅ All data uploaded to Firebase!');
}

upload().catch(err => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
