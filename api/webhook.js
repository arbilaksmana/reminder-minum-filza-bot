import crypto from 'crypto';
import { sendMessage, downloadFile, notifyAdmin, getRandomCode, getRandomGesture } from '../lib/telegram.js';
import { upsertUser, getPendingEvent, updateEvent, createEvent, isHashExists, saveHash } from '../lib/supabase.js';
import { uploadToDrive } from '../lib/drive.js';
import { validatePhoto } from '../lib/gemini.js';

export default async function handler(req, res) {
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
}

async function handleText(chatId, text, from) {
    if (text === '/start') {
        const name = from?.first_name || 'User';
        await upsertUser(chatId, name);
        await sendMessage(chatId, `Hai ${name}! 👋\n\nBot pengingat minum siap. Saat menerima pengingat, kirim <b>FOTO</b> dengan caption berisi kode ya 💧`);
        await notifyAdmin(`🆕 User baru: ${name} (${chatId})`);
        return;
    }

    if (text === '/test') {
        // Manual test - create a reminder
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

    // Check caption contains code
    if (!caption || !caption.includes(ev.challenge_code)) {
        await sendMessage(chatId, `❌ Tulis kode <b>${ev.challenge_code}</b> di caption! Coba lagi ya 🙏`);
        return;
    }

    // Download photo
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

    // Check duplicate hash
    const hash = crypto.createHash('sha256').update(photoBuffer).digest('hex');
    if (await isHashExists(hash)) {
        await sendMessage(chatId, '❌ Foto ini sudah pernah dikirim. Kirim foto BARU ya 🙏');
        return;
    }

    // Upload to Google Drive
    let driveResult;
    try {
        driveResult = await uploadToDrive(photoBuffer, `${ev.id}.jpg`);
        console.log('Uploaded to Drive:', driveResult.url);
    } catch (err) {
        console.error('Drive upload error:', err);
        await sendMessage(chatId, '❌ Gagal simpan foto. Coba lagi ya 🙏');
        return;
    }

    // Save hash
    await saveHash(hash, driveResult.fileId);

    // AI Validation with Gemini
    let aiResult = null;
    try {
        aiResult = await validatePhoto(photoBuffer, ev.gesture);
        console.log('AI validation:', aiResult);
    } catch (err) {
        console.error('AI validation error:', err);
        // Continue even if AI fails
    }

    // Check deadline
    const createdAt = new Date(ev.created_at).getTime();
    const deadlineAt = createdAt + (ev.deadline_minutes * 60 * 1000);
    const isLate = Date.now() > deadlineAt;

    // Determine status
    let status = 'valid';
    let reason = 'ok';

    if (isLate) {
        status = 'late';
        reason = 'Terlambat merespon';
    } else if (aiResult && !aiResult.error) {
        if (!aiResult.isSafe) {
            status = 'invalid';
            reason = 'Konten tidak aman';
        } else if (!aiResult.hasBottle && !aiResult.isDrinking) {
            // Warning but still accept
            reason = 'Tidak terdeteksi minuman (tetap diterima)';
        }
    }

    // Update event
    await updateEvent(ev.id, {
        status,
        photo_url: driveResult.url,
        ai_validation: aiResult,
        reason,
        responded_at: new Date().toISOString()
    });

    // Send response
    if (status === 'valid') {
        await sendMessage(chatId, '✅ Mantap! Minumnya tercatat 💧');
        await notifyAdmin(`✅ <b>VALID</b>\nUser: ${chatId}\nKode: ${ev.challenge_code}\nFoto: ${driveResult.url}`);
    } else if (status === 'late') {
        await sendMessage(chatId, '⚠️ Terlambat, tapi tetap dicatat. Semangat! 💪');
        await notifyAdmin(`⚠️ <b>LATE</b>\nUser: ${chatId}\nFoto: ${driveResult.url}`);
    } else {
        await sendMessage(chatId, `❌ ${reason}. Coba lagi ya 🙏`);
        await notifyAdmin(`❌ <b>INVALID</b>\nUser: ${chatId}\nReason: ${reason}`);
    }

    console.log(`Event ${ev.id} completed with status: ${status}`);
}
