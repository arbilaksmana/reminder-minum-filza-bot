const { getActiveUsers, createEvent } = require('../../lib/supabase');
const { sendMessage, getRandomCode, getRandomGesture } = require('../../lib/telegram');

module.exports = async function handler(req, res) {
    console.log('Schedule cron triggered');

    try {
        const users = await getActiveUsers();
        console.log(`Found ${users.length} active users`);

        const results = [];

        for (const user of users) {
            const code = getRandomCode();
            const gesture = getRandomGesture();

            const event = await createEvent({
                tg_id: user.tg_id,
                challenge_code: code,
                gesture,
                deadline_minutes: 20,
                next_reminder_at: new Date().toISOString()
            });

            if (!event) continue;

            const msg = `💧 <b>Waktunya minum!</b>\n\nKode: <b>${code}</b>\nPose/Gesture: <b>${gesture}</b>\nDeadline: 20 menit\n\nKirim <b>FOTO</b> + tulis kode di caption ya 😊`;

            await sendMessage(user.tg_id, msg);
            results.push({ user: user.tg_id, code });
        }

        res.status(200).json({ ok: true, results });
    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ ok: false, error: error.message });
    }
};
