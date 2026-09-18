import { createHmac, timingSafeEqual } from "node:crypto";

export function signLink4SubPostback(token: string, secret: string) {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function verifyLink4SubPostback(token: string, signature: string, secret: string) {
  const expected = signLink4SubPostback(token, secret);
  const provided = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
}
