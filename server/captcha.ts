import { createHmac, randomInt } from "node:crypto";
import { ENV } from "./_core/env";

const MAX_AGE_MS = 10 * 60 * 1000;
const secret = () => ENV.cookieSecret || process.env.JWT_SECRET || "development-captcha-secret";

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createCaptcha() {
  const a = randomInt(2, 10);
  const b = randomInt(2, 10);
  const id = `${Date.now()}.${a}.${b}`;
  return { question: `${a} + ${b} = ?`, token: `${id}.${sign(id)}` };
}

export function verifyCaptcha(token: string, answer: string) {
  const [issued, a, b, signature] = token.split(".");
  if (!issued || !a || !b || !signature) return false;
  const payload = `${issued}.${a}.${b}`;
  if (sign(payload) !== signature) return false;
  const issuedAt = Number(issued);
  const expected = Number(a) + Number(b);
  return Number.isFinite(issuedAt) && Date.now() - issuedAt >= 0 && Date.now() - issuedAt <= MAX_AGE_MS && Number(answer) === expected;
}

export function createCaptchaProof() {
  const value = `${Date.now()}`;
  return `${value}.${sign(value)}`;
}

export function verifyCaptchaProof(value: string | undefined) {
  if (!value) return false;
  const [issued, signature] = value.split(".");
  return Boolean(issued && signature && sign(issued) === signature && Date.now() - Number(issued) <= MAX_AGE_MS);
}
