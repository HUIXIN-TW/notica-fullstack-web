import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const TOKEN_ENCRYPTION_PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = "aes-256-gcm";

function getKeyBytes() {
  const raw = (process.env.TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required but not set.");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-character hex string.");
  }
  return Buffer.from(raw, "hex");
}

export function encryptToken(value) {
  if (typeof value !== "string" || !value) return value;
  if (value.startsWith(TOKEN_ENCRYPTION_PREFIX)) return value;

  const key = getKeyBytes();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${TOKEN_ENCRYPTION_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptToken(value) {
  if (typeof value !== "string" || !value) return value;
  if (!value.startsWith(TOKEN_ENCRYPTION_PREFIX)) {
    throw new Error(
      "Token is not encrypted. All tokens must use enc:v1: format.",
    );
  }

  const key = getKeyBytes();
  const parts = value.split(":");
  if (parts.length !== 5) {
    throw new Error("Malformed encrypted token payload.");
  }

  const [, version, ivHex, tagHex, ciphertextHex] = parts;
  if (version !== "v1") {
    throw new Error(`Unsupported encrypted token version: ${version}`);
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  if (iv.length !== IV_BYTES) {
    throw new Error("Encrypted token payload has invalid IV length.");
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error("Encrypted token payload has invalid auth tag length.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
