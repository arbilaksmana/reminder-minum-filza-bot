const { getPendingEvents, updateEvent } = require('../../lib/supabase');
const { sendMessage } = require('../../lib/telegram');

module.exports = async function handler(req, res) {
    console.log('Spam cron triggered');

    try {
        const events = await getPendingEvents();
        console.log(`Found ${events.length} pending events`);

        const now = Date.now();
        const results = [];

        for (const ev of events) {
            const createdAt = new Date(ev.created_at).getTime();
            const nextReminderAt = new Date(ev.next_reminder_at).getTime();
            const deadlineAt = createdAt + (ev.deadline_minutes * 60 * 1000);

            if (now > deadlineAt) {
                await updateEvent(ev.id, {
                    status: 'expired',
                    reason: 'Tidak merespon sebelum deadline'
                });
                results.push({ id: ev.id, action: 'expired' });
                continue;
            }

            if (now >= nextReminderAt) {
                const msg = `💧 <b>Reminder!</b>\n\nKode: <b>${ev.challenge_code}</b>\nPose/Gesture: <b>${ev.gesture}</b>\nSisa waktu: ${Math.round((deadlineAt - now) / 60000)} menit\n\nKirim <b>FOTO</b> + kode di caption 😊`;

                await sendMessage(ev.tg_id, msg);

                await updateEvent(ev.id, {
                    reminder_count: (ev.reminder_count || 0) + 1,
                    next_reminder_at: new Date(now + 5 * 60 * 1000).toISOString()
                });

                results.push({ id: ev.id, action: 'reminded' });
            }
        }

        res.status(200).json({ ok: true, results });
    } catch (error) {
        console.error('Spam error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
};
