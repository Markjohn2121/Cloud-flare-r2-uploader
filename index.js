require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const morgan = require('morgan');
const app = express();

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(fileUpload({
  useTempFiles: false,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
}));

// S3 Client Configuration for Cloudflare R2
const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true // Required for R2
});

// Upload Endpoint
app.post('/upload', async (req, res) => {
  try {
    if (!req.files?.file) {
      return res.status(400).json({ 
        status: 'error',
        message: 'No file uploaded' 
      });
    }

    const file = req.files.file;
    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    // Upload to R2 using S3 API
    const uploadParams = {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: file.data,
      ContentType: file.mimetype,
      ACL: 'public-read'
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Generate public URL (R2-specific format)
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    res.json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        fileName,
        publicUrl,
        fileSize: file.size,
        mimeType: file.mimetype
      }
    });

  } catch (error) {
    console.error('S3 Upload Error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload file',
      error: error.message
    });
  }
});

// Health Check
app.get('/', (req, res) => {
  res.send('R2 S3 Uploader is running');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`S3 Endpoint: ${process.env.R2_ENDPOINT}`);
});
