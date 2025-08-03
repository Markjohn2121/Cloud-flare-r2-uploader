require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const AWS = require('aws-sdk');
const app = express();

// Middleware - Must include these exact options
app.use(fileUpload({
    useTempFiles: false, // Critical change
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    abortOnLimit: true
}));

// Configure AWS S3 for Cloudflare R2
const s3 = new AWS.S3({
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: 'auto'
});

// Upload endpoint
app.post('/upload', async (req, res) => {
    try {
        // Validate file exists
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ 
                status: 'error',
                message: 'No files were uploaded' 
            });
        }

        const file = req.files.file;

        // Validate file data exists
        if (!file.data || file.data.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'File data is empty'
            });
        }

        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

        const params = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: file.data, // Ensure we're using the file buffer
            ContentType: file.mimetype,
            ACL: 'public-read'
        };

        // Upload to R2
        const uploadResult = await s3.upload(params).promise();

        res.json({
            status: 'success',
            message: 'File uploaded successfully',
            data: {
                fileName: fileName,
                publicUrl: uploadResult.Location,
                fileSize: file.size,
                mimeType: file.mimetype
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to upload file',
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
