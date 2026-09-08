import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
let ENCRYPTION_KEY: Buffer;

const getKey = (): Buffer => {
  if (!ENCRYPTION_KEY) {
    const secret = process.env.PAYOUT_ENCRYPTION_KEY;
    if (!secret || secret.length < 32) {
      throw new Error("PAYOUT_ENCRYPTION_KEY must be set (>= 32 chars) for payout method encryption");
    }
    ENCRYPTION_KEY = crypto.createHash("sha256").update(secret).digest();
  }
  return ENCRYPTION_KEY;
};

export const encryptString = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
};

export const decryptString = (encoded: string): string => {
  const [ivB64, tagB64, dataB64] = encoded.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted value");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};
