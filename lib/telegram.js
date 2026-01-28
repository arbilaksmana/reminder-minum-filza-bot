const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId, text, options = {}) {
    const res = await fetch(`${API_BASE}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
            ...options
        })
    });
    const data = await res.json();
    if (!data.ok) {
        console.error('sendMessage error:', data.description);
    }
    return data;
}

export async function notifyAdmin(message) {
    if (!ADMIN_CHAT_ID) return;
    return sendMessage(ADMIN_CHAT_ID, message);
}

export async function getFileUrl(fileId) {
    const res = await fetch(`${API_BASE}/getFile?file_id=${fileId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
}

export async function downloadFile(fileId) {
    const url = await getFileUrl(fileId);
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    return Buffer.from(buffer);
}

export function getRandomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
}

export function getRandomGesture() {
    const gestures = ['✌️', '👍', '👆', '👌', '🤙', 'angkat botol tangan kiri', 'tunjuk angka 3', 'peace sign'];
    return gestures[Math.floor(Math.random() * gestures.length)];
}
