require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");
const mime = require("mime-types");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ENDPOINT,
  R2_PUBLIC_URL
} = process.env;

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadToR2(path, contentBuffer, originalname) {
  const contentType = mime.lookup(originalname) || 'application/octet-stream';
  
  const uploadParams = {
    Bucket: R2_BUCKET_NAME,
    Key: path,
    Body: contentBuffer,
    ContentType: contentType,
    // Add Cache-Control headers for optimal caching
    CacheControl: 'public, max-age=604800, immutable',
  };

  try {
    // Check if file exists (optional, just maintaining consistency with original code)
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: path,
      }));
    } catch (e) {
      if (e.name !== 'NotFound') {
        throw e;
      }
    }

    // Upload the file with proper content type and cache headers
    await s3Client.send(new PutObjectCommand(uploadParams));
    
    return path;
  } catch (err) {
    console.error("Error uploading to R2:", err);
    throw err;
  }
}

async function generateSignedUrl(filePath) {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: filePath,
    });

    // Generate signed URL with 7 days expiration (604800 seconds)
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 604800,
    });

    return signedUrl;
  } catch (err) {
    console.error("Error generating signed URL:", err);
    throw err;
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "Cloudflare R2 File Upload Server is running" 
  });
});

// File upload endpoint
app.post("/upload", upload.fields([{ name: "file1" }, { name: "file2" }]), async (req, res) => {
  try {
    const folder = req.body.folder || "uploads";
    const results = {};
    const signedUrls = {};
    
    if (req.files.file1) {
      const file1 = req.files.file1[0];
      const file1Path = `${folder}/${file1.originalname}`;
      results.R2mediaPath = await uploadToR2(file1Path, file1.buffer, file1.originalname);
      signedUrls.file1 = await generateSignedUrl(file1Path);
    }
    
    if (req.files.file2) {
      const file2 = req.files.file2[0];
      const file2Path = `${folder}/${file2.originalname}`;
      results.R2audioPath = await uploadToR2(file2Path, file2.buffer, file2.originalname);
      signedUrls.file2 = await generateSignedUrl(file2Path);
    }
    
    if (!req.files.file1 && !req.files.file2) {
      return res.status(400).json({ error: "At least one file is required" });
    }
    
    // Calculate expiration date (7 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    
    res.json({
      success: true,
      message: "Files uploaded successfully",
      R2mediaPath: results.R2mediaPath || null,
      R2audioPath: results.R2audioPath || null,
      R2mediaEXP: expirationDate.toISOString(),
      R2audioEXP: expirationDate.toISOString(),
      file1URL: signedUrls.file1 || null,
      file2URL: signedUrls.file2 || null
    });
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ 
      error: "Upload failed", 
      details: err.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
