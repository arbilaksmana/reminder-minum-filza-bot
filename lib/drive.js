import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/drive.file']
});

const drive = google.drive({ version: 'v3', auth });

export async function uploadToDrive(buffer, filename, mimeType = 'image/jpeg') {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);

    const res = await drive.files.create({
        requestBody: {
            name: filename,
            parents: [folderId]
        },
        media: {
            mimeType,
            body: stream
        },
        fields: 'id, webViewLink'
    });

    // Make file viewable by anyone with link
    await drive.permissions.create({
        fileId: res.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone'
        }
    });

    return {
        fileId: res.data.id,
        url: `https://drive.google.com/file/d/${res.data.id}/view`
    };
}

export async function deleteFromDrive(fileId) {
    try {
        await drive.files.delete({ fileId });
        return true;
    } catch (e) {
        console.error('deleteFromDrive error:', e.message);
        return false;
    }
}
