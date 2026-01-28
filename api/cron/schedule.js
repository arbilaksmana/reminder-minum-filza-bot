import { getActiveUsers, createEvent } from '../../lib/supabase.js';
import { sendMessage, getRandomCode, getRandomGesture } from '../../lib/telegram.js';

// Runs at 08:00, 14:00, 20:00 WIB (01:00, 07:00, 13:00 UTC)
export default async function handler(req, res) {
    console.log('Schedule cron triggered at:', new Date().toISOString());

    try {
        const users = await getActiveUsers();
        console.log(`Found ${users.length} active users`);

        const results = [];

        for (const user of users) {
            const code = getRandomCode();
            const gesture = getRandomGesture();

            // Create event in database
            const event = await createEvent({
                tg_id: user.tg_id,
                challenge_code: code,
                gesture,
                deadline_minutes: 20,
                next_reminder_at: new Date().toISOString()
            });

            if (!event) {
                console.error(`Failed to create event for user ${user.tg_id}`);
                continue;
            }

            // Send reminder message
            const msg = [
                '💧 <b>Waktunya minum!</b>',
                '',
                `Kode: <b>${code}</b>`,
                `Pose/Gesture: <b>${gesture}</b>`,
                `Deadline: 20 menit dari sekarang`,
                '',
                'Kirim <b>FOTO</b> + tulis kode di caption ya 😊'
            ].join('\n');

            const sent = await sendMessage(user.tg_id, msg);
            results.push({
                user: user.tg_id,
                code,
                sent: sent.ok
            });

            console.log(`Reminder sent to ${user.tg_id}: code=${code}`);
        }

        res.status(200).json({
            ok: true,
            timestamp: new Date().toISOString(),
            usersNotified: results.length,
            results
        });

    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
}
