// Run against a local Firestore emulator only. See WHATSAPP-SETUP.md.
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } = require('firebase/firestore');
async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('A local Firestore emulator is required.');
  const env = await initializeTestEnvironment({ projectId: 'demo-nari-whatsapp', firestore: { rules: fs.readFileSync(require.resolve('../firestore.rules'), 'utf8') } });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'staff/admin@example.test'), { role: 'admin' });
      await setDoc(doc(db, 'staff/doctor@example.test'), { role: 'doctor', doctorId: 'doctor1' });
      await setDoc(doc(db, 'whatsappOrders/wa_test'), { id: 'wa_test', phone: '919876543210', amount: 799, status: 'pending', followUp: 'new' });
      await setDoc(doc(db, 'whatsappCustomers/919876543210'), { name: 'Test', phone: '919876543210', followUp: 'new' });
      await setDoc(doc(db, 'integrations/whatsapp'), { enabled: true });
      await setDoc(doc(db, 'whatsappEvents/test'), { kind: 'plan' });
    });
    const admin = env.authenticatedContext('admin1', { email: 'admin@example.test', email_verified: true }).firestore();
    const doctor = env.authenticatedContext('doctor1', { email: 'doctor@example.test', email_verified: true }).firestore();
    const member = env.authenticatedContext('member1', { phone_number: '+919876543210' }).firestore();
    const publicDb = env.unauthenticatedContext().firestore();
    for (const db of [publicDb, member, doctor]) {
      for (const name of ['whatsappOrders', 'whatsappCustomers', 'whatsappEvents', 'whatsappRechecks']) {
        await assertFails(getDocs(collection(db, name)));
        await assertFails(setDoc(doc(db, name + '/fake'), { status: 'paid' }));
      }
      await assertFails(updateDoc(doc(db, 'whatsappOrders/wa_test'), { status: 'paid' }));
    }
    await assertSucceeds(getDocs(collection(admin, 'whatsappOrders')));
    await assertSucceeds(getDocs(collection(admin, 'whatsappCustomers')));
    await assertSucceeds(updateDoc(doc(admin, 'whatsappOrders/wa_test'), { followUp: 'scheduled' }));
    await assertSucceeds(updateDoc(doc(admin, 'whatsappCustomers/919876543210'), { followUp: 'contacted' }));
    for (const patch of [{ status: 'paid' }, { amount: 1 }, { transactionId: 'fake' }, { followUp: 'bad' }, { followUp: 'closed', status: 'paid' }]) {
      await assertFails(updateDoc(doc(admin, 'whatsappOrders/wa_test'), patch));
    }
    await assertFails(setDoc(doc(admin, 'whatsappOrders/new'), { status: 'paid' }));
    await assertFails(deleteDoc(doc(admin, 'whatsappOrders/wa_test')));
    await assertSucceeds(setDoc(doc(admin, 'whatsappRechecks/wa_test'), { requestedAt: new Date().toISOString(), requestedBy: 'admin1' }));
    await assertFails(setDoc(doc(admin, 'whatsappRechecks/unknown'), { requestedAt: new Date().toISOString(), requestedBy: 'admin1' }));
    await assertFails(setDoc(doc(admin, 'whatsappRechecks/wa_test'), { requestedAt: new Date().toISOString(), requestedBy: 'someone-else' }));
    await assertSucceeds(getDoc(doc(admin, 'integrations/whatsapp')));
    await assertFails(setDoc(doc(admin, 'integrations/whatsapp'), { enabled: true }));
    await assertFails(getDoc(doc(admin, 'whatsappEvents/test')));
    console.log('PASS: emulator rules — admin read/follow-up/recheck allowed; patient/public/doctor access and all client payment tampering denied.');
  } finally { await env.cleanup(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
