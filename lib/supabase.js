const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// User operations
async function getUser(tgId) {
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('tg_id', String(tgId))
        .single();
    return data;
}

async function upsertUser(tgId, name = 'User') {
    const { data, error } = await supabase
        .from('users')
        .upsert({ tg_id: String(tgId), name, is_active: true }, { onConflict: 'tg_id' })
        .select()
        .single();
    if (error) console.error('upsertUser error:', error);
    return data;
}

async function getActiveUsers() {
    const { data } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true);
    return data || [];
}

// Event operations
async function createEvent(event) {
    const { data, error } = await supabase
        .from('events')
        .insert(event)
        .select()
        .single();
    if (error) console.error('createEvent error:', error);
    return data;
}

async function getPendingEvent(tgId) {
    const { data } = await supabase
        .from('events')
        .select('*')
        .eq('tg_id', String(tgId))
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    return data;
}

async function updateEvent(id, updates) {
    const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) console.error('updateEvent error:', error);
    return data;
}

async function getPendingEvents() {
    const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'pending');
    return data || [];
}

// Hash operations
async function isHashExists(sha256) {
    const { data } = await supabase
        .from('photo_hashes')
        .select('id')
        .eq('sha256', sha256)
        .single();
    return !!data;
}

async function saveHash(sha256, driveFileId) {
    await supabase
        .from('photo_hashes')
        .insert({ sha256, drive_file_id: driveFileId });
}

module.exports = {
    supabase,
    getUser,
    upsertUser,
    getActiveUsers,
    createEvent,
    getPendingEvent,
    updateEvent,
    getPendingEvents,
    isHashExists,
    saveHash
};
