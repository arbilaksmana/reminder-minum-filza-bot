import { getPendingEvents, updateEvent } from '../../lib/supabase.js';
import { sendMessage } from '../../lib/telegram.js';

// Runs every 5 minutes to send follow-up reminders
export default async function handler(req, res) {
    console.log('Spam cron triggered at:', new Date().toISOString());

    try {
        const events = await getPendingEvents();
        console.log(`Found ${events.length} pending events`);

        const now = Date.now();
        const results = [];

        for (const ev of events) {
            const createdAt = new Date(ev.created_at).getTime();
            const nextReminderAt = new Date(ev.next_reminder_at).getTime();
            const deadlineAt = createdAt + (ev.deadline_minutes * 60 * 1000);

            // Check if past deadline
            if (now > deadlineAt) {
                await updateEvent(ev.id, {
                    status: 'expired',
                    reason: 'Tidak merespon sebelum deadline'
                });
                console.log(`Event ${ev.id} expired`);
                results.push({ id: ev.id, action: 'expired' });
                continue;
            }

            // Check if time for next reminder
            if (now >= nextReminderAt) {
                const msg = [
                    '💧 <b>Reminder!</b>',
                    '',
                    `Kode: <b>${ev.challenge_code}</b>`,
                    `Pose/Gesture: <b>${ev.gesture}</b>`,
                    `Sisa waktu: ${Math.round((deadlineAt - now) / 60000)} menit`,
                    '',
                    'Kirim <b>FOTO</b> + kode di caption 😊'
                ].join('\n');

                await sendMessage(ev.tg_id, msg);

                // Set next reminder in 5 minutes
                await updateEvent(ev.id, {
                    reminder_count: (ev.reminder_count || 0) + 1,
                    next_reminder_at: new Date(now + 5 * 60 * 1000).toISOString()
                });

                console.log(`Reminder sent for event ${ev.id}`);
                results.push({ id: ev.id, action: 'reminded' });
            }
        }

        res.status(200).json({
            ok: true,
            timestamp: new Date().toISOString(),
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('Spam cron error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}
