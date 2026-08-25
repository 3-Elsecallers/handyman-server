import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../middlewares/errorHandler.middleware";
import { config } from "../config/env";

export const s3 = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpoint,
  credentials: {
    accessKeyId: config.s3.accessKeyId,
    secretAccessKey: config.s3.secretAccessKey,
  },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function randomKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export function buildS3Key(conversationId: string, ext: string): string {
  return `conversations/${conversationId}/images/${randomKey()}.${ext}`;
}

export async function generateUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 300 });
}

export async function generateDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}
