import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
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

  // Debug: verificar versao e existencia do dist/web
  const BUILD_ID = "2026-05-05_v2";
  app.get("/api/debug/fs", (_req, res) => {
    const webDistPath = path.resolve(process.cwd(), "dist", "web");
    const indexPath = path.join(webDistPath, "index.html");
    import("fs").then((fs) => {
      res.json({
        buildId: BUILD_ID,
        nodeEnv: process.env.NODE_ENV,
        cwd: process.cwd(),
        webDistPath,
        webDistExists: fs.existsSync(webDistPath),
        indexHtmlExists: fs.existsSync(indexPath),
      });
    });
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

    // IMPORTANTE: O proxy do Manus so roteia /api/* para o Express.
    // Rotas como /, /login, /_expo/* nunca chegam ao servidor.
    // Solucao: servir tudo em /api/app (frontend) e /api/assets (assets estaticos)

    // Servir assets estaticos em /api/assets/* (JS, CSS, imagens, etc.)
    app.use("/api/assets", express.static(webDistPath, {
      maxAge: "1d",
      etag: true,
    }));

    // Funcao para servir index.html com paths de assets reescritos
    // O index.html original usa /_expo/... e /favicon.ico que nao passam pelo proxy
    // Reescrevemos para /api/assets/_expo/... e /api/assets/favicon.ico
    const serveWebApp = (_req: express.Request, res: express.Response) => {
      const indexPath = path.join(webDistPath, "index.html");
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        // Reescrever paths absolutos de assets para /api/assets/*
        html = html
          .replace(/href="\/_expo\//g, 'href="/api/assets/_expo/')
          .replace(/src="\/_expo\//g, 'src="/api/assets/_expo/')
          .replace(/href="\/favicon/g, 'href="/api/assets/favicon')
          .replace(/href="\/apple-touch-icon/g, 'href="/api/assets/apple-touch-icon')
          .replace(/src="\/apple-touch-icon/g, 'src="/api/assets/apple-touch-icon');
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
      } catch (err) {
        console.error(`[Server] Failed to serve index.html: ${err}`);
        res.status(503).send("Frontend not built. Run: pnpm build:web");
      }
    };

    // Servir o app em /api/app e qualquer sub-rota (SPA fallback)
    app.get("/api/app", serveWebApp);
    app.get("/api/app/*", serveWebApp);

    console.log(`[Server] Web app available at /api/app`);
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
