import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import unzipper from "unzipper";

// ESM-compatible __dirname (esbuild ESM bundles don't define __dirname)
const __filename = fileURLToPath(import.meta.url);
const __currentDir = path.dirname(__filename);
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerWhatsAppWebhook } from "../whatsapp-webhook";
import { registerCronJobs } from "../cron";
import { runDailyReport } from "../daily-report";
import { registerApiIntegration } from "../api-integration";
import { registerPrintRoute } from "../print-route";

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
  registerPrintRoute(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Debug: verificar versao e existencia do dist/web
  const BUILD_ID = "2026-05-05_v5";  // baseUrl injetado via script no index.html
  app.get("/api/debug/fs", (_req, res) => {
    const webDistPath = path.resolve(__currentDir, "web");
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

  // Hot-deploy: atualiza o bundle web sem precisar reconstruir o container
  // Recebe um ZIP com o conteudo de dist/web/ e extrai para o webDistPath
  app.post("/api/admin/hot-deploy", async (req, res) => {
    const token = req.headers["x-deploy-token"] || req.query.token;
    const expectedToken = process.env.HOT_DEPLOY_TOKEN;
    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const webDistPath = path.resolve(__currentDir, "web");
    try {
      // Receber o ZIP do body (raw buffer via express.raw)
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", resolve);
        req.on("error", reject);
      });
      const zipBuffer = Buffer.concat(chunks);
      if (zipBuffer.length === 0) {
        return res.status(400).json({ ok: false, error: "Empty body" });
      }
      // Extrair o ZIP para o webDistPath
      const { Readable } = await import("stream");
      const readable = Readable.from(zipBuffer);
      await pipeline(
        readable,
        unzipper.Extract({ path: webDistPath })
      );
      console.log(`[HotDeploy] Bundle atualizado em ${webDistPath} (${zipBuffer.length} bytes)`);
      res.json({ ok: true, message: "Bundle atualizado com sucesso", bytes: zipBuffer.length });
    } catch (err) {
      console.error("[HotDeploy] Erro:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Endpoint temporário para executar SQL admin (apenas com token)
  app.post("/api/admin/exec-sql", express.json(), async (req: any, res: any) => {
    const token = req.headers["x-deploy-token"] || req.query.token;
    const expectedToken = process.env.HOT_DEPLOY_TOKEN;
    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    try {
      const { sql } = req.body;
      if (!sql) return res.status(400).json({ ok: false, error: "sql required" });
      const { getPool } = await import("../db.js");
      const pool = await getPool();
      const [result] = await (pool as any).execute(sql);
      return res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Hot-deploy para arquivos PWA (landing page, manifest, icones, sw)
  app.post("/api/admin/hot-deploy-pwa", async (req, res) => {
    const token = req.headers["x-deploy-token"] || req.query.token;
    const expectedToken = process.env.HOT_DEPLOY_TOKEN;
    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const pwaDistPath = path.resolve(__currentDir, "pwa");
    try {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", resolve);
        req.on("error", reject);
      });
      const zipBuffer = Buffer.concat(chunks);
      if (zipBuffer.length === 0) {
        return res.status(400).json({ ok: false, error: "Empty body" });
      }
      const { Readable } = await import("stream");
      const readable = Readable.from(zipBuffer);
      await pipeline(readable, unzipper.Extract({ path: pwaDistPath }));
      console.log(`[HotDeploy-PWA] Arquivos PWA atualizados em ${pwaDistPath} (${zipBuffer.length} bytes)`);
      res.json({ ok: true, message: "Arquivos PWA atualizados com sucesso", bytes: zipBuffer.length });
    } catch (err) {
      console.error("[HotDeploy-PWA] Erro:", err);
      res.status(500).json({ ok: false, error: String(err) });
    }
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

  // ── Landing Page PWA ──────────────────────────────────────────────────────
  // Servir assets estaticos da landing page (icones, manifest, sw)
  // Em producao: os arquivos PWA ficam em dist/web/pwa/ (incluidos no hot-deploy)
  // Em desenvolvimento: usa process.cwd()/public/pwa
  const pwaPublicPath = isProduction
    ? path.resolve(__currentDir, "web", "pwa")
    : path.resolve(process.cwd(), "public", "pwa");
  const pwaIconsPath = isProduction
    ? path.resolve(__currentDir, "web", "pwa", "icons")
    : path.resolve(process.cwd(), "public", "icons");

  // Servir icones PWA
  app.use("/api/pwa/icons", express.static(pwaIconsPath, { maxAge: "7d" }));

  // Servir manifest.json e sw.js
  app.get("/api/pwa/manifest.json", (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(pwaPublicPath, "manifest.json"));
  });

  app.get("/api/pwa/sw.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(pwaPublicPath, "sw.js"));
  });

  // Landing page principal — servida na raiz do dominio
  app.get("/", (_req, res) => {
    const landingPath = path.join(pwaPublicPath, "index.html");
    if (fs.existsSync(landingPath)) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(landingPath);
    } else {
      res.redirect("/api/app/");
    }
  });

  if (isProduction) {
    // Em producao: servir o bundle estatico do Expo web
    // O bundle e gerado por `expo export --platform web` e fica em dist/web
    // Usar __currentDir (ESM-compatible) para garantir o path correto
    // Em producao o servidor compila para dist/index.js, entao __currentDir = dist/
    // O dist/web fica em dist/web/ (mesmo nivel)
    const webDistPath = path.resolve(__currentDir, "web");
    console.log(`[Server] Production mode: serving static files from ${webDistPath}`);

    // IMPORTANTE: O proxy do Manus so roteia /api/* para o Express.
    // O build foi gerado com experiments.baseUrl: "/api/app" no app.config.ts
    // Isso faz o Expo gerar assets com paths /api/app/_expo/... automaticamente
    // e o Expo Router reconhece /api/app como a rota raiz.

    // Servir assets estaticos em /api/app/_expo/* e /api/app/favicon.ico
    // O express.static serve os arquivos de dist/web/ no prefixo /api/app/
    app.use("/api/app", express.static(webDistPath, {
      maxAge: "1d",
      etag: true,
      index: false, // Nao servir index.html automaticamente - controlamos isso abaixo
    }));

    // Script injetado no index.html para garantir que o Expo Router
    // reconheca /api/app como a rota raiz, independente do bundle.
    // O script usa history.replaceState para normalizar o pathname
    // antes do bundle JS carregar e inicializar o Expo Router.
    const BASE_URL = "/api/app";
    const baseUrlScript = `<script>
  (function() {
    var base = '${BASE_URL}';
    var p = window.location.pathname;
    // Se o pathname comecar com /api/app, remover o prefixo para o Expo Router
    if (p === base || p.startsWith(base + '/')) {
      var newPath = p.slice(base.length) || '/';
      window.history.replaceState(null, '', newPath + window.location.search + window.location.hash);
    }
  })();
</script>`;

    // Servir o index.html para /api/app e qualquer sub-rota (SPA fallback)
    const serveWebApp = (_req: express.Request, res: express.Response) => {
      const indexPath = path.join(webDistPath, "index.html");
      try {
        let html = fs.readFileSync(indexPath, "utf-8");
        // Injetar o script de baseUrl antes do bundle JS carregar
        html = html.replace("</head>", `${baseUrlScript}</head>`);
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);
      } catch (err) {
        console.error(`[Server] Failed to serve index.html: ${err}`);
        res.status(503).send("Frontend not built. Run: pnpm build:web");
      }
    };

    // Rota especial: landing page PWA (servir HTML estatico, nao SPA fallback)
    const servePwaLanding = (_req: express.Request, res: express.Response) => {
      const pwaLandingPath = path.join(webDistPath, "pwa", "index.html");
      if (fs.existsSync(pwaLandingPath)) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.sendFile(pwaLandingPath);
      } else {
        serveWebApp(_req, res);
      }
    };
    app.get("/api/app/pwa", servePwaLanding);
    app.get("/api/app/pwa/", servePwaLanding);

    // SPA fallback: qualquer rota /api/app/* que nao seja um arquivo estatico
    // serve o index.html (o Expo Router cuida do roteamento no cliente)
    app.get("/api/app", serveWebApp);
    app.get("/api/app/*", (req, res, next) => {
      // Se for um asset estatico (tem extensao), deixa o express.static acima tratar
      const hasExtension = path.extname(req.path).length > 0;
      if (hasExtension) return next();
      // Caso contrario, serve o index.html (rota do SPA)
      serveWebApp(req, res);
    });

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
