require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const morgan = require('morgan');
const cors = require('cors');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/'
}));

// Configure AWS SDK for Cloudflare R2
const s3 = new AWS.S3({
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: 'auto'
});

// Health check endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'R2 Upload Server is running',
        timestamp: new Date().toISOString()
    });
});

// File upload endpoint
app.post('/upload', async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }

        const file = req.files.file;
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        
        // Upload parameters
        const params = {
            Bucket: process.env.R2_BUCKET_NAME,
            Key: fileName,
            Body: file.data,
            ContentType: file.mimetype,
            ACL: 'public-read' // Make the file publicly accessible
        };

        // Upload to R2
        const uploadResult = await s3.upload(params).promise();

        // Construct public URL
        const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

        res.status(200).json({
            status: 'success',
            message: 'File uploaded successfully',
            data: {
                fileName: fileName,
                publicUrl: publicUrl,
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

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: err.message
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
