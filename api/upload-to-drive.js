import { google } from 'googleapis';
import { IncomingForm } from 'formidable';
import fs from 'fs';

const GoogleCrid = 'ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiZXhhbHRlZC1ldGNoaW5nLTQ0MDgyMC1qMyIsCiAgInByaXZhdGVfa2V5X2lkIjogIjcyOTJlMWZiODMwNzZiNDA5ZTFlMTk4Nzk5M2I3MDZiYmI1ZjRmNDgiLAogICJwcml2YXRlX2tleSI6ICItLS0tLUJFR0lOIFBSSVZBVEUgS0VZLS0tLS1cbk1JSUV2UUlCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktjd2dnU2pBZ0VBQW9JQkFRQzE1NFIwWjIrR1ZnckNcbml2bTI4ZS9OWC9IOVYrNUlaRXJIbHZFUGNLU0hhVGZ3dXl0NDNlaGxiYUdGUk01WTk3S2xHZU5mNmp3Rk5yN2xcbk90ZTJlUEhKU2twNE0zcjJESnNUWUJ4cDVCZ0RzTzhOMWQ5T3B4RlhDTWpJTnFJcEFLSFV1RlQ4d2pub1RRK3pcbks0MlVEeGgvSXltaFIzZ2JjaG9Tdk1WbEZZMDBiQXRueGYwc1dodjhMQUFHQzVad0IydEZORWV3ZzdjdUZaWitcbkpBQkE4UjVzbzVQQ25mSlNmbUtBcVdPcWRnVFllQnRpbFB1Q0Y2Z3NmWE55ODFmS3VpUWZvSStBRUZWV2JzU1pcbnpLcVU3S01JSzQrUzR5S1B4MVRSSVBjVmZnTjlOZUtKS3dSMW5LTmZkUFhnSUx3SXVsSHdXL21oeEo5T1l6SFpcbmUvZ0hlSHRYQWdNQkFBRUNnZ0VBQTBDSUIxdG1ETEp6R2lGSlJQSmZCWDZiOXBuZzE3TWwvSEFxdW5Ud0ZyK3BcbjBWMmg4YW85OTdwQVhmL3A2ZFh4S3E4amQ5a3ZNNFNwWUYzRW5OZ3lzbW85UkpnMFd1WnZkZncza0g1cHlOUnhcblRGVUdNSzRmU3VnTVREcTEwWGZYd2lsOWZpWUJkUWErVmh5eGpra1ZlTE1Va1I2VVVNdjNHQWlwOEJ4Zmh1VmVcbmhiZ0tqejF4cUxidlFyV2tmeXBZU1luT09aSFcwZ3h2UkxXYkp1bXYyQWdDTUIzSTJ1UWlHUHJ6Z3VidmpEbVFcbkJyK3ZWeU5xZVlEdnQ0SGVUN2lPM2VlL0dJdmg5Zm5UbEZ0TjFuRWQzdmF2VjJXNDR2SXZsUktyMHZ1MlhYNmhcbm1nSU80aGFyYUw4MEJlMjdUYTZ1Ly9UZE44Z1V5NGJFdjdQbXRLQ0IrUUtCZ1FEc3VOT2FaWW5vaWdqWEY0aXVcbnJhKzZBc1FwL2hobkVMS1ZMbVJDVU9Fbi9CWUZMcytlSDkxcXMwQ1FLSDJjdGVkQ05sUkVwZjZRU2ZJQVF5cFJcblpjWHl2Y3pkcGxjNzBGQWtGM2VPRi9mZS9QQk9Nd1hSVFN0STlwTzVBRXhnN0VyMmdubDYvSldoQ2krckJnclVcbjlUMldPMTByam1yeEU2Y1drL1VDU3VyeGd3S0JnUURFdDlyTSthWDdMNVlFOVU1R3hibzAwVDBkQ0VYSzdwTGJcbnhiQjZUMjdYWnd0Y1RBQTVaT0p4L00vR05qT1h1ekhsSHpUU3l1UHdTRmhZOFloa0VsSE1NUjFtTUMyRW5iQy9cbjdwV1l5dmZCbjNkWXp0ZzY1cHZKQXVyYVBBcUZpTUxxdUo3WDRTQ2NENEs5S3RYb0UvLzRoc2NOSnMyNE9GcVpcblQ3b2t2aHZLblFLQmdIaUFTVzhSK3hhOWxXeHdsV3BlRGRNQmIzdjAxZFU1UWI4QkE1WmlkNHNVSHQxNmk4TnhcbmN4UEt0YlhzZHF6Y1NDR0RhSGdkaTYxRmh3UXRMSkNNM3l3SEJBOWNpcEZ2SkN5TEtaZlNpYUlnWGU5Z3Q3aG9cbnNQME9UL3BmdFlHdEp5ZS9HVG5LOUJ3ckJFTHA2MyttYXpoYmRiMGpYVHJsQnl4T0d1MlUxMjRqQW9HQUNXYXZcbjhqUE1GdUVEVG1GYXlFOFN3d3RzM0VKVTg0bkxRdTJEclpTMk8xMFZVZWZmNnQ1RFpDY3MxdEFvVHd3SEttZi9cbllrT0grU2U3OFNRNTNHNXpza3AybVRlY05VWkQrQ2d5eGdhTktKZXlZSEFpTFU1d0MzODBNaEhFZnZVMk8zbHZcblBlbm9ZUXpzdHBXaGUySFpUY3RESUFIR3V4TVdZVlZLRkE5eHpKRUNnWUVBdzBOOU5zQkVHaFlTdkhHWnJoRjZcbmZZaUFhTFNyblZNcjBPUE50MDRJeFk4N1hna3dLZE9mM2JtMG5rNXlQUFBlYjN4ZUtHWFpPOE50ZGdOSmhWMWxcbkNMMTZyZnRKbW1UMHd4VER5R3JIZGg2R3BGalpZWVRuMm5nREZ4cU5wNjFiOWlrZVN1ektXMkJDRS9nTGpBOGZcbkhnN0wvWWtkQXpxUC93YWFSOGd4bUpzPVxuLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLVxuIiwKICAiY2xpZW50X2VtYWlsIjogImRlbG9pdHRlcHJvamVjdEBleGFsdGVkLWV0Y2hpbmctNDQwODIwLWozLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjExNjIxMjA2ODE2MTg1NjM4NDgzNyIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvZGVsb2l0dGVwcm9qZWN0JTQwZXhhbHRlZC1ldGNoaW5nLTQ0MDgyMC1qMy5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSIKfQo='
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const allowedOrigin = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const encodedCredentials = process.env.GOOGLE_CREDENTIALS || GoogleCrid;
  if (!encodedCredentials) {
    console.error('GOOGLE_CREDENTIALS not set');
    return res.status(500).json({ error: 'Missing GOOGLE_CREDENTIALS' });
  }

  let credentials;
  try {
    credentials = JSON.parse(Buffer.from(encodedCredentials, 'base64').toString('utf-8'));
  } catch (err) {
    console.error('Invalid GOOGLE_CREDENTIALS:', err);
    return res.status(500).json({ error: 'Invalid GOOGLE_CREDENTIALS' });
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

	const form = new IncomingForm({
	  uploadDir: '/tmp',
	  keepExtensions: true,
	  multiples: false,
	});

  let tempFilePath;

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });
	console.log('Uploaded files:', files);
	const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile || !uploadedFile.filepath) {
	  console.error('Missing uploaded file or filepath:', uploadedFile);
	  return res.status(400).json({ error: 'No file uploaded' });
	}

    tempFilePath = uploadedFile.filepath;
    const originalFilename = uploadedFile.originalFilename?.replace(/[^a-zA-Z0-9._-]/g, '_') || 'uploaded_document';

    const fileMetadata = {
      name: originalFilename,
      mimeType: uploadedFile.mimetype || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const media = {
      mimeType: fileMetadata.mimeType,
      body: fs.createReadStream(tempFilePath),
    };

    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, name',
    });

    const uploadedOriginalFileId = driveResponse.data.id;

    const copiedFileResource = {
      name: `${driveResponse.data.name}_GoogleDoc`,
      mimeType: 'application/vnd.google-apps.document',
    };

    const docConversionResponse = await drive.files.copy({
      fileId: uploadedOriginalFileId,
      resource: copiedFileResource,
      fields: 'id, webViewLink',
    });

    const googleDocId = docConversionResponse.data.id;

    await drive.permissions.create({
      fileId: googleDocId,
      resource: {
        role: process.env.GOOGLE_DOC_PERMISSION_ROLE || 'writer',
        type: process.env.GOOGLE_DOC_PERMISSION_TYPE || 'anyone',
      },
    });

    const editableDocUrl = `https://docs.google.com/document/d/${googleDocId}/edit?usp=sharing&rm=minimal`;

    if (process.env.DELETE_ORIGINAL_UPLOAD_FROM_DRIVE === 'true') {
      try {
        await drive.files.delete({ fileId: uploadedOriginalFileId });
      } catch (err) {
        console.error('Delete failed:', err);
      }
    }

    res.status(200).json({
      docUrl: editableDocUrl,
      fileId: googleDocId,
      webViewLink: docConversionResponse.data.webViewLink,
    });

  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({
      error: `上傳失敗：${err.message}`,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  } finally {
    if (tempFilePath) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (err) {
        console.error('Temp file delete failed:', err);
      }
    }
  }
}
