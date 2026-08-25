import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../middlewares/errorHandler.middleware";

const BUCKET = process.env.AWS_S3_BUCKET || "handyman-bucket";
const REGION = process.env.AWS_REGION || "us-east-1";
const ENDPOINT = process.env.AWS_S3_ENDPOINT || "http://localhost:4566";
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || "test";
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || "test";

export const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_FILES_PER_REQUEST = 10;

function randomKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildS3Key(
  providerId: string,
  category: string,
  ext: string,
): string {
  return `providers/${providerId}/documents/${category}/${randomKey()}.${ext}`;
}

export async function generateUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}

export async function generateDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function assertObjectExists(key: string): Promise<void> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    throw new AppError(400, "File not found in storage. Please upload before confirming.");
  }
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mime] || "bin";
}

export function validateFileType(mime: string): void {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    throw new AppError(
      400,
      `Invalid file type "${mime}". Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }
}

export function validateFileSize(size: number): void {
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      400,
      `File size ${size} exceeds maximum ${MAX_FILE_SIZE_BYTES} bytes`,
    );
  }
}
