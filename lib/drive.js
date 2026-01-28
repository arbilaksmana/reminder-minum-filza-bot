const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');

async function uploadToDrive(buffer, filename, mimeType = 'image/jpeg') {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    console.log('=== OAuth2 Drive Upload ===');
    console.log('Folder ID:', folderId);
    console.log('Has Client ID:', !!clientId);
    console.log('Has Client Secret:', !!clientSecret);
    console.log('Has Refresh Token:', !!refreshToken);
    console.log('Buffer size:', buffer?.length);

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing OAuth2 credentials');
    }

    try {
        // Create OAuth2 client directly (not using google.auth.OAuth2)
        const oauth2Client = new OAuth2Client(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        // Force refresh the access token
        const tokenInfo = await oauth2Client.getAccessToken();
        console.log('Access token obtained:', !!tokenInfo.token);

        // Create Drive client with explicit auth
        const drive = google.drive({ version: 'v3' });

        // Convert buffer to stream
        const { Readable } = require('stream');
        const stream = Readable.from(buffer);

        console.log('Uploading:', filename);

        // Upload file with explicit OAuth2 auth
        const res = await drive.files.create({
            auth: oauth2Client,
            requestBody: {
                name: filename,
                parents: folderId ? [folderId] : undefined
            },
            media: {
                mimeType,
                body: stream
            },
            fields: 'id'
        });

        const fileId = res.data.id;
        console.log('File created:', fileId);

        // Make file public
        await drive.permissions.create({
            auth: oauth2Client,
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        const url = `https://drive.google.com/file/d/${fileId}/view`;
        console.log('Success:', url);

        return { fileId, url };

    } catch (error) {
        console.error('Drive error:', error.message);
        throw error;
    }
}

module.exports = { uploadToDrive };
