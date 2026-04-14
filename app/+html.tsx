import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * HTML template para o app web (PWA).
 * Totalmente otimizado para instalação como PWA no iOS (Safari) e Android (Chrome).
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
        <meta name="keywords" content="compras, gestão, CGS, agrícola, procurement" />

        {/* PWA - iOS Safari (modo standalone = tela cheia sem barra do Safari) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CGS Compras" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />

        {/* Ícones iOS - Apple Touch Icons (todos os tamanhos para compatibilidade) */}
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

        {/* Splash Screens iOS - iPhone */}
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash-iphone-14-pro-max.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash-iphone-14-pro.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash-iphone-14.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)"
          href="/splash-iphone-8-plus.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash-iphone-8.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash-iphone-se.png"
        />

        {/* Splash Screens iOS - iPad */}
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash-ipad-pro-12-9.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash-ipad-pro-11.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)"
          href="/splash-ipad-mini.png"
        />

        {/* Manifest PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* Cor do tema */}
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
            /* Suporte a safe area no iOS (notch e Dynamic Island) */
            :root {
              --sat: env(safe-area-inset-top);
              --sab: env(safe-area-inset-bottom);
              --sal: env(safe-area-inset-left);
              --sar: env(safe-area-inset-right);
            }
            /* Previne zoom em inputs no iOS */
            input, select, textarea {
              font-size: 16px !important;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
