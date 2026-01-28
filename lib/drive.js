// Drive upload using raw fetch API (no googleapis library)
// This avoids all auto-detection issues

async function getAccessToken() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(`Token error: ${data.error} - ${data.error_description}`);
    }

    return data.access_token;
}

async function uploadToDrive(buffer, filename, mimeType = 'image/jpeg') {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    console.log('=== Raw API Drive Upload ===');
    console.log('Folder ID:', folderId);
    console.log('Filename:', filename);
    console.log('Buffer size:', buffer?.length);

    try {
        // Get OAuth2 access token
        const accessToken = await getAccessToken();
        console.log('Access token obtained');

        // Create file metadata
        const metadata = {
            name: filename,
            parents: folderId ? [folderId] : undefined
        };

        // Create multipart form data manually
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const multipartBody = Buffer.concat([
            Buffer.from(delimiter),
            Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
            Buffer.from(JSON.stringify(metadata)),
            Buffer.from(delimiter),
            Buffer.from(`Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
            Buffer.from(buffer.toString('base64')),
            Buffer.from(closeDelimiter)
        ]);

        // Upload file
        const uploadRes = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartBody
            }
        );

        const uploadData = await uploadRes.json();
        if (uploadData.error) {
            throw new Error(`Upload error: ${JSON.stringify(uploadData.error)}`);
        }

        const fileId = uploadData.id;
        console.log('File created:', fileId);

        // Make file public
        await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );

        const url = `https://drive.google.com/file/d/${fileId}/view`;
        console.log('Success:', url);

        return { fileId, url };

    } catch (error) {
        console.error('Drive error:', error.message);
        throw error;
    }
}

module.exports = { uploadToDrive };
