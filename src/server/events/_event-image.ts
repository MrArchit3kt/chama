import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const EVENT_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "events");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * Le champ `file.type` vient du client (Content-Type déclaré par le
 * navigateur) : rien n'empêche un fichier renommé/mal étiqueté de passer
 * le filtre MIME. On vérifie donc aussi la signature binaire réelle avant
 * d'écrire quoi que ce soit sur le disque.
 */
function matchesImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return pngSignature.every((byte, i) => buffer[i] === byte);
  }

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

function getExtensionFromMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}

function normalizeUrlInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function isAbsoluteHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLocalEventImage(imageUrl?: string | null) {
  return Boolean(imageUrl && imageUrl.startsWith("/uploads/events/"));
}

export async function deleteLocalEventImage(imageUrl?: string | null) {
  if (!imageUrl || !isLocalEventImage(imageUrl)) {
    return;
  }

  const filePath = path.join(process.cwd(), "public", imageUrl.replace(/^\/+/, ""));

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore si déjà supprimé
  }
}

export async function saveUploadedEventImage(file: File) {
  if (!(file instanceof File) || file.size <= 0) {
    return null;
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("INVALID_IMAGE_TYPE");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const extension = getExtensionFromMimeType(file.type);

  if (!extension) {
    throw new Error("INVALID_IMAGE_TYPE");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!matchesImageSignature(buffer, file.type)) {
    throw new Error("INVALID_IMAGE_TYPE");
  }

  await fs.mkdir(EVENT_UPLOAD_DIR, { recursive: true });

  const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(EVENT_UPLOAD_DIR, fileName);
  const relativeUrl = `/uploads/events/${fileName}`;

  await fs.writeFile(absolutePath, buffer);

  return relativeUrl;
}

export async function resolveEventImageInput(
  rawUrlInput: FormDataEntryValue | null,
  rawFileInput: FormDataEntryValue | null,
) {
  let uploadedLocalImageUrl: string | null = null;

  if (rawFileInput instanceof File && rawFileInput.size > 0) {
    uploadedLocalImageUrl = await saveUploadedEventImage(rawFileInput);

    return {
      nextImageUrl: uploadedLocalImageUrl,
      uploadedLocalImageUrl,
    };
  }

  const coverImageUrl = normalizeUrlInput(rawUrlInput);

  if (!coverImageUrl) {
    return {
      nextImageUrl: null,
      uploadedLocalImageUrl: null,
    };
  }

  if (
    coverImageUrl.startsWith("/uploads/events/") ||
    isAbsoluteHttpUrl(coverImageUrl)
  ) {
    return {
      nextImageUrl: coverImageUrl,
      uploadedLocalImageUrl: null,
    };
  }

  throw new Error("INVALID_IMAGE_URL");
}