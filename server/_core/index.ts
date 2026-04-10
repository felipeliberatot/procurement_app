import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerWhatsAppWebhook } from "../whatsapp-webhook";
import { registerCronJobs } from "../cron";
import { runDailyReport } from "../daily-report";
import { registerApiIntegration } from "../api-integration";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
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
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerWhatsAppWebhook(app);
  registerApiIntegration(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Manual trigger for daily report (admin use only)
  app.post("/api/admin/daily-report", async (_req, res) => {
    console.log("[Admin] Manual daily report triggered via API");
    try {
      await runDailyReport();
      res.json({ ok: true, message: "Relatorio diario enviado com sucesso." });
    } catch (err) {
      console.error("[Admin] Daily report error:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Rota publica: Politica de Privacidade
  app.get("/privacidade", (_req, res) => {
    res.sendFile(path.resolve(process.cwd(), "public", "privacidade.html"));
  });

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // Em producao: servir o bundle estatico do Expo web
    // O bundle e gerado por `expo export --platform web` e fica em dist/web
    const webDistPath = path.resolve(process.cwd(), "dist", "web");
    console.log(`[Server] Production mode: serving static files from ${webDistPath}`);

    // Servir arquivos estaticos (JS, CSS, imagens, etc.)
    app.use(express.static(webDistPath));

    // SPA fallback: todas as rotas nao-API retornam o index.html
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      const indexPath = path.join(webDistPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`[Server] Failed to serve index.html: ${err.message}`);
          res.status(503).send("Frontend not built. Run: pnpm build:web");
        }
      });
    });
  } else {
    // Em desenvolvimento: fazer proxy para o Metro (Expo web frontend na porta 8081)
    const metroPort = parseInt(process.env.EXPO_PORT || "8081");
    const metroProxy = createProxyMiddleware({
      target: `http://127.0.0.1:${metroPort}`,
      changeOrigin: false,
      ws: true,
      on: {
        error: (_err, _req, res) => {
          if (res && "writeHead" in res) {
            (res as express.Response).status(502).json({ error: "Frontend not available" });
          }
        },
      },
    });

    // Proxy all non-API routes to Metro
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) {
        return next();
      }
      return metroProxy(req, res, next);
    });

    // Also upgrade WebSocket connections for Metro HMR
    server.on("upgrade", (req, socket, head) => {
      if (!req.url?.startsWith("/api/")) {
        (metroProxy as any).upgrade(req, socket, head);
      }
    });
  }

  // Global error handlers: always return JSON, never HTML
  // Catch-all for unmatched API routes
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  // Express error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[Server] Unhandled error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    // Register cron jobs after server is up
    registerCronJobs();
  });
}

startServer().catch(console.error);
