import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * HTML template para o app web (PWA).
 * Adiciona meta tags para instalação como PWA no iOS (Safari) e Android (Chrome).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* PWA - Título e Descrição */}
        <title>Compras CGS Agrícola</title>
        <meta name="description" content="Sistema de Gestão de Compras Empresariais - CGS Agrícola Ltda." />
        <meta name="application-name" content="CGS Compras" />

        {/* PWA - iOS Safari */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CGS Compras" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Ícones iOS - Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="57x57" href="/apple-touch-icon-57x57.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/apple-touch-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/apple-touch-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/apple-touch-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/apple-touch-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/apple-touch-icon-167x167.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png" />

        {/* Manifest PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* Cor do tema (barra de status Android/Chrome) */}
        <meta name="theme-color" content="#1a6b3c" />
        <meta name="msapplication-TileColor" content="#1a6b3c" />
        <meta name="msapplication-TileImage" content="/apple-touch-icon-144x144.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />

        {/* Reset de estilos recomendado pelo react-native-web */}
        <ScrollViewStyleReset />

        {/* Estilos base para PWA fullscreen */}
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body { height: 100%; margin: 0; padding: 0; }
            body { overflow: hidden; background-color: #ffffff; }
            #root { display: flex; height: 100%; flex: 1; }
            /* Suporte a safe area no iOS (notch) */
            :root {
              --sat: env(safe-area-inset-top);
              --sab: env(safe-area-inset-bottom);
              --sal: env(safe-area-inset-left);
              --sar: env(safe-area-inset-right);
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
