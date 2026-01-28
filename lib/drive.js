const { google } = require('googleapis');

async function uploadToDrive(buffer, filename, mimeType = 'image/jpeg') {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    console.log('=== Drive Upload Debug ===');
    console.log('Folder ID:', folderId);
    console.log('Client ID exists:', !!clientId);
    console.log('Client Secret exists:', !!clientSecret);
    console.log('Refresh Token exists:', !!refreshToken);
    console.log('Buffer size:', buffer?.length);

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing OAuth2 credentials. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    }

    try {
        // Create OAuth2 client 
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        // Create Drive client with OAuth2
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Convert buffer to stream
        const { Readable } = require('stream');
        const stream = Readable.from(buffer);

        console.log('Uploading file:', filename);

        // Upload file
        const res = await drive.files.create({
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
        console.log('File created with ID:', fileId);

        // Make file public
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        const url = `https://drive.google.com/file/d/${fileId}/view`;
        console.log('File URL:', url);

        return { fileId, url };

    } catch (error) {
        console.error('=== Drive Upload Error ===');
        console.error('Error message:', error.message);
        if (error.response?.data) {
            console.error('Response:', JSON.stringify(error.response.data));
        }
        throw error;
    }
}

module.exports = { uploadToDrive };
