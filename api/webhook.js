const crypto = require('crypto');
const { sendMessage, downloadFile, notifyAdmin, getRandomCode, getRandomGesture } = require('../lib/telegram');
const { upsertUser, getPendingEvent, updateEvent, createEvent, isHashExists, saveHash } = require('../lib/supabase');
const { uploadToDrive } = require('../lib/drive');
const { validatePhoto } = require('../lib/gemini');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).json({ ok: true, message: 'Webhook is active' });
    }

    try {
        const update = req.body;
        console.log('Received update:', JSON.stringify(update));

        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id;
            const text = message.text?.trim();

            if (text) {
                await handleText(chatId, text, message.from);
            } else if (message.photo) {
                await handlePhoto(chatId, message);
            } else {
                await sendMessage(chatId, 'Kirim <b>FOTO</b> dengan caption berisi kode tantangan ya 💧');
            }
        }

        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(200).json({ ok: true, error: error.message });
    }
};

async function handleText(chatId, text, from) {
    if (text === '/start') {
        const name = from?.first_name || 'User';
        await upsertUser(chatId, name);
        await sendMessage(chatId, `Hai ${name}! 👋\n\nBot pengingat minum siap. Saat menerima pengingat, kirim <b>FOTO</b> dengan caption berisi kode ya 💧`);
        await notifyAdmin(`🆕 User baru: ${name} (${chatId})`);
        return;
    }

    if (text === '/test') {
        const code = getRandomCode();
        const gesture = getRandomGesture();
        await createEvent({
            tg_id: String(chatId),
            challenge_code: code,
            gesture,
            deadline_minutes: 20,
            next_reminder_at: new Date().toISOString()
        });
        await sendMessage(chatId, `💧 <b>Test Reminder!</b>\n\nKode: <b>${code}</b>\nPose/Gesture: <b>${gesture}</b>\nDeadline: 20 menit\n\nKirim <b>FOTO</b> + tulis kode di caption ya 😊`);
        return;
    }

    const ev = await getPendingEvent(chatId);
    if (ev) {
        await sendMessage(chatId, `Hehe belum sah 😝\n\nKirim <b>FOTO</b> + tulis kode <b>${ev.challenge_code}</b> di caption.`);
    } else {
        await sendMessage(chatId, 'Siap! Nanti kalau ada pengingat, balas dengan <b>FOTO</b> + kode ya 💧');
    }
}

async function handlePhoto(chatId, message) {
    console.log(`handlePhoto for chat ${chatId}`);

    const ev = await getPendingEvent(chatId);
    if (!ev) {
        await sendMessage(chatId, 'Belum ada pengingat aktif. Tunggu pengingat berikutnya ya 💧');
        return;
    }

    const caption = (message.caption || '').trim();
    console.log(`Caption: "${caption}", Expected: "${ev.challenge_code}"`);

    if (!caption || !caption.includes(ev.challenge_code)) {
        await sendMessage(chatId, `❌ Tulis kode <b>${ev.challenge_code}</b> di caption! Coba lagi ya 🙏`);
        return;
    }

    const photos = message.photo;
    const largest = photos[photos.length - 1];

    let photoBuffer;
    try {
        photoBuffer = await downloadFile(largest.file_id);
        console.log('Photo downloaded, size:', photoBuffer.length);
    } catch (err) {
        console.error('Download error:', err);
        await sendMessage(chatId, '❌ Gagal download foto. Coba kirim ulang ya 🙏');
        return;
    }

    const hash = crypto.createHash('sha256').update(photoBuffer).digest('hex');
    if (await isHashExists(hash)) {
        await sendMessage(chatId, '❌ Foto ini sudah pernah dikirim. Kirim foto BARU ya 🙏');
        return;
    }

    let driveResult;
    try {
        driveResult = await uploadToDrive(photoBuffer, `${ev.id}.jpg`);
        console.log('Uploaded to Drive:', driveResult.url);
    } catch (err) {
        console.error('Drive upload error:', err);
        await sendMessage(chatId, '❌ Gagal simpan foto. Coba lagi ya 🙏');
        return;
    }

    await saveHash(hash, driveResult.fileId);

    let aiResult = null;
    try {
        aiResult = await validatePhoto(photoBuffer, ev.gesture);
        console.log('AI validation:', aiResult);
    } catch (err) {
        console.error('AI error:', err);
    }

    const createdAt = new Date(ev.created_at).getTime();
    const deadlineAt = createdAt + (ev.deadline_minutes * 60 * 1000);
    const isLate = Date.now() > deadlineAt;

    let status = 'valid';
    let reason = 'ok';

    if (isLate) {
        status = 'late';
        reason = 'Terlambat';
    } else if (aiResult && !aiResult.error) {
        // Stricter AI validation
        if (!aiResult.isSafe) {
            status = 'invalid';
            reason = 'Konten tidak aman';
        } else if (!aiResult.hasBottle) {
            status = 'invalid';
            reason = 'Tidak terlihat botol minum. Foto harus ada botol/gelas minum 🥤';
        } else if (!aiResult.hasFace) {
            status = 'invalid';
            reason = 'Tidak terlihat wajah. Foto harus selfie dengan minuman 🤳';
        } else if (!aiResult.gestureMatch && aiResult.confidence > 70) {
            status = 'invalid';
            reason = `Gesture tidak sesuai. Seharusnya: ${ev.gesture}`;
        } else if (!aiResult.isRealPhoto && aiResult.confidence > 80) {
            status = 'invalid';
            reason = 'Foto terdeteksi bukan asli (screenshot/editan)';
        }
    }

    await updateEvent(ev.id, {
        status,
        photo_url: driveResult.url,
        ai_validation: aiResult,
        reason,
        responded_at: new Date().toISOString()
    });

    if (status === 'valid') {
        await sendMessage(chatId, '✅ Mantap! Minumnya tercatat 💧');
        await notifyAdmin(`✅ <b>VALID</b>\nUser: ${chatId}\nKode: ${ev.challenge_code}\nFoto: ${driveResult.url}`);
    } else if (status === 'late') {
        await sendMessage(chatId, '⚠️ Terlambat, tapi tetap dicatat. Semangat! 💪');
        await notifyAdmin(`⚠️ <b>LATE</b>\nUser: ${chatId}\nFoto: ${driveResult.url}`);
    } else {
        await sendMessage(chatId, `❌ ${reason}. Coba lagi ya 🙏`);
    }
}
