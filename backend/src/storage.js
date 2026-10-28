import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./config.js";
import { assert, HttpError } from "./lib.js";
export const storageEnabled = () =>
  !!(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
let client;
function s3() {
  assert(storageEnabled(), 503, "Storage is not configured");
  return (client ??= new S3Client({
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: !!env.S3_ENDPOINT,
    region: env.S3_REGION,
    maxAttempts: 2,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  }));
}
export async function putImage(key, bytes) {
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: "image/jpeg",
        CacheControl: "private, max-age=0",
        Metadata: { validated: "reencoded-image" },
      }),
      { abortSignal: AbortSignal.timeout(15000) },
    );
  } catch {
    throw new HttpError(
      503,
      "Answer storage is temporarily unavailable. Please retry.",
    );
  }
}
export async function readImage(key) {
  const object = await s3().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { abortSignal: AbortSignal.timeout(15000) },
  );
  assert(
    object.ContentLength <= 5_000_000,
    413,
    "Stored image exceeds size limit",
  );
  let size = 0,
    parts = [];
  for await (const part of object.Body) {
    size += part.length;
    assert(size <= 5_000_000, 413, "Stored image exceeds size limit");
    parts.push(Buffer.from(part));
  }
  return Buffer.concat(parts);
}
export const imageURL = (key) =>
  getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
    { expiresIn: 300 },
  );
export const deleteImage = (key) =>
  s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    abortSignal: AbortSignal.timeout(15000),
  });
