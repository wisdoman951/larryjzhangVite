// api/upload-to-drive.js
const { google } = require('googleapis');
const formidable = require('formidable');
const fs = require('fs');

module.exports = async (req, res) => {
  // CORS Headers - Restrict origin in production
  const allowedOrigin = process.env.FRONTEND_URL || '*'; // Use '*' for local dev, specific domain for prod
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const encodedCredentials = process.env.GOOGLE_CREDENTIALS;
  if (!encodedCredentials) {
    console.error('Environment variable GOOGLE_CREDENTIALS is not set');
    return res.status(500).json({ error: 'Server configuration error: Missing GOOGLE_CREDENTIALS' });
  }

  let credentials;
  try {
    const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
    credentials = JSON.parse(decodedCredentials);
    // console.log('Google credentials loaded successfully.'); // Avoid logging sensitive info
  } catch (error) {
    console.error('Failed to decode or parse GOOGLE_CREDENTIALS:', error);
    return res.status(500).json({ error: 'Server configuration error: Invalid GOOGLE_CREDENTIALS' });
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/drive', // Needed for full drive operations like copying and setting broad permissions
      // 'https://www.googleapis.com/auth/drive.file', // More restrictive, consider if applicable
      // 'https://www.googleapis.com/auth/documents' // Only if directly using Docs API beyond Drive file operations
    ]
  });

  const drive = google.drive({ version: 'v3', auth });

  const form = new formidable.IncomingForm({
    uploadDir: '/tmp',
    keepExtensions: true,
    multiples: false, // Expect a single file
  });

  let tempFilePath; // For cleaning up the /tmp file

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const uploadedFile = files.file; // With multiples: false
    if (!uploadedFile || !uploadedFile.filepath) {
      console.error('Formidable files object:', files); // Log for debugging
      return res.status(400).json({ error: 'No file uploaded or file path is missing. Ensure the form field name is "file".' });
    }
    tempFilePath = uploadedFile.filepath;

    const originalFilename = uploadedFile.originalFilename ? uploadedFile.originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_') : 'uploaded_document';
    const fileMetadata = {
      name: originalFilename,
      mimeType: uploadedFile.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'] // Optional: Upload to a specific folder
    };

    const media = {
      mimeType: fileMetadata.mimeType,
      body: fs.createReadStream(tempFilePath),
    };

    // 1. Upload the original file to Google Drive
    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name', // Request only necessary fields
    });
    const uploadedOriginalFileId = driveResponse.data.id;
    console.log(`Original file uploaded to Drive, ID: ${uploadedOriginalFileId}, Name: ${driveResponse.data.name}`);

    // 2. Convert (copy) the uploaded file to Google Docs format
    const googleDocFilename = `${driveResponse.data.name}_GoogleDoc`; // Or a more user-friendly name
    const copiedFileResource = {
        name: googleDocFilename,
        mimeType: 'application/vnd.google-apps.document',
        // parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'] // Optional
    };
    const docConversionResponse = await drive.files.copy({
      fileId: uploadedOriginalFileId,
      resource: copiedFileResource,
      fields: 'id, webViewLink, embedLink', // embedLink for iframe, webViewLink for direct view
    });
    const googleDocId = docConversionResponse.data.id;
    console.log(`File converted to Google Doc, ID: ${googleDocId}`);

    // 3. Set permissions for the NEW Google Doc
    // CAUTION: 'anyone' with 'writer' role is very permissive and generally not recommended for sensitive documents.
    // Consider 'reader' for 'anyone' or share with specific users/groups.
    // If iframe editing is needed, the user accessing it must have write permission.
    const permissionRole = process.env.GOOGLE_DOC_PERMISSION_ROLE || 'writer'; // e.g., 'reader' or 'writer'
    const permissionType = process.env.GOOGLE_DOC_PERMISSION_TYPE || 'anyone'; // e.g., 'user', 'group', 'domain', 'anyone'
    
    await drive.permissions.create({
      fileId: googleDocId, // Permissions for the converted Google Doc
      resource: {
        role: permissionRole,
        type: permissionType,
        // emailAddress: (if type is 'user' or 'group')
        // domain: (if type is 'domain')
      },
    });
    console.log(`Permissions (${permissionRole}/${permissionType}) set for Google Doc ID: ${googleDocId}`);

    // URL for iframe editing (removes most of Google Docs UI for cleaner embedding)
    const editableDocUrlForIframe = `https://docs.google.com/document/d/${googleDocId}/edit?usp=sharing&rm=minimal`;
    // General web view link
    const webViewLink = docConversionResponse.data.webViewLink;


    // 4. Optionally delete the original uploaded file (e.g., .docx) from Drive
    if (process.env.DELETE_ORIGINAL_UPLOAD_FROM_DRIVE === 'true') {
        try {
            await drive.files.delete({ fileId: uploadedOriginalFileId });
            console.log(`Original uploaded file (${uploadedOriginalFileId}) deleted from Drive.`);
        } catch (deleteErr) {
            console.error(`Failed to delete original file (${uploadedOriginalFileId}) from Drive:`, deleteErr);
        }
    }

    res.status(200).json({
      docUrl: editableDocUrlForIframe,
      fileId: googleDocId, // ID of the Google Doc
      webViewLink: webViewLink,
    });

  } catch (error) {
    console.error('Upload to Drive failed:', error);
    let errorDetails = error.message;
    if (error.errors && Array.isArray(error.errors)) { // Google API specific errors
        errorDetails = error.errors.map(e => e.message).join('; ');
        console.error('Google API errors:', error.errors);
    }
    res.status(500).json({
        error: `上傳失敗：${errorDetails}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    // Cleanup temporary file from /tmp
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('Temporary file deleted:', tempFilePath);
      } catch (unlinkErr) {
        console.error('Failed to delete temporary file:', tempFilePath, unlinkErr);
      }
    }
  }
};