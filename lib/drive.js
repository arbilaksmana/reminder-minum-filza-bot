const { google } = require('googleapis');

function getAuth() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    console.log('Google Client Email:', clientEmail);
    console.log('Private Key exists:', !!privateKey);
    console.log('Private Key length:', privateKey?.length);

    // Handle different formats of private key
    if (privateKey) {
        // Replace literal \n with actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');

        // If wrapped in quotes, remove them
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }
    }

    return new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey
        },
        scopes: ['https://www.googleapis.com/auth/drive.file']
    });
}

async function uploadToDrive(buffer, filename, mimeType = 'image/jpeg') {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log('Uploading to folder:', folderId);
    console.log('Filename:', filename);
    console.log('Buffer size:', buffer.length);

    try {
        const auth = getAuth();
        const drive = google.drive({ version: 'v3', auth });

        const { Readable } = require('stream');
        const stream = Readable.from(buffer);

        console.log('Creating file in Drive...');
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

        console.log('File created, ID:', res.data.id);

        await drive.permissions.create({
            fileId: res.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        console.log('Permissions set');

        return {
            fileId: res.data.id,
            url: `https://drive.google.com/file/d/${res.data.id}/view`
        };
    } catch (error) {
        console.error('Drive upload error:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2));
        throw error;
    }
}

module.exports = { uploadToDrive };
