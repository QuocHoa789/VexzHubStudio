import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { completeVerifiedRewardAttempt } from "../db";
import { verifyLink4SubPostback } from "../link4sub";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const requestBuckets = new Map<string, { startedAt: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;

function rewardsRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  if (requestBuckets.size > 1000) {
    requestBuckets.forEach((bucket, bucketKey) => {
      if (now - bucket.startedAt >= RATE_WINDOW_MS) requestBuckets.delete(bucketKey);
    });
  }
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    next();
    return;
  }
  if (current.count >= RATE_LIMIT) {
    res.status(429).json({ error: "Too many reward requests. Try again shortly." });
    return;
  }
  current.count += 1;
  next();
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/link4sub/postback", rewardsRateLimit, async (req, res) => {
    const secret = process.env.LINK4SUB_POSTBACK_SECRET;
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const signature = typeof req.body?.signature === "string" ? req.body.signature : "";
    if (!secret) {
      res.status(503).json({ error: "Link4Sub postback verification is not configured." });
      return;
    }
    if (!token || !signature || !verifyLink4SubPostback(token, signature, secret)) {
      res.status(401).json({ error: "Invalid postback signature." });
      return;
    }
    try {
      const result = await completeVerifiedRewardAttempt(token);
      if (!result.accepted) {
        res.status(404).json({ error: "Unknown or invalid reward attempt." });
        return;
      }
      res.json({ ok: true, claimed: result.claimed });
    } catch (error) {
      console.error("[Link4Sub] Postback failed:", error);
      res.status(500).json({ error: "Unable to process postback." });
    }
  });
  // tRPC API
  app.use("/api/trpc/rewards", rewardsRateLimit);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
