require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_ACCOUNT_ID
} = process.env;

// Cloudflare R2 Client
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// Upload function to R2
async function uploadToR2(path, contentBuffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: path,
    Body: contentBuffer,
    ContentType: contentType,
  });

  await r2.send(command);
  return path; // return path only, not full URL
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
    
    if (req.files.file1) {
      const file1 = req.files.file1[0];
      const file1Path = `${folder}/${file1.originalname}`;
      results.file1Path = await uploadToR2(file1Path, file1.buffer, file1.mimetype);
    }
    
    if (req.files.file2) {
      const file2 = req.files.file2[0];
      const file2Path = `${folder}/${file2.originalname}`;
      results.file2Path = await uploadToR2(file2Path, file2.buffer, file2.mimetype);
    }
    
    // Validate at least one file was uploaded
    if (!req.files.file1 && !req.files.file2) {
      return res.status(400).json({ error: "At least one file is required" });
    }
    
    res.json({
      success: true,
      message: "Files uploaded successfully",
      ...results,
      note: "Thank you for watching."
    });
  } catch (err) {
    console.error(err);
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
