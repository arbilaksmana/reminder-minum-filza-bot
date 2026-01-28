const { google } = require('googleapis');

// OAuth2 client setup
function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    console.log('OAuth2 Client ID exists:', !!clientId);
    console.log('OAuth2 Refresh Token exists:', !!refreshToken);

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
    );

    oauth2Client.setCredentials({
        refresh_token: refreshToken
    });

    return oauth2Client;
}

async function uploadToDrive(buffer, filename, mimeType = 'image/jpeg') {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    console.log('Uploading to folder:', folderId);
    console.log('Filename:', filename);
    console.log('Buffer size:', buffer.length);

    try {
        const auth = getOAuth2Client();
        const drive = google.drive({ version: 'v3', auth });

        const { Readable } = require('stream');
        const stream = Readable.from(buffer);

        console.log('Creating file in Drive with OAuth2...');
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

        // Make file viewable by anyone
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
        if (error.response) {
            console.error('Response data:', JSON.stringify(error.response.data));
        }
        throw error;
    }
}

module.exports = { uploadToDrive };
