import { Platform } from "react-native";
import { router } from "expo-router";

/**
 * Redireciona para a tela de login de forma correta tanto em dev quanto em produção.
 *
 * Em produção, o app é servido em /api/app/ pelo servidor Express.
 * O script de baseUrl no index.html normaliza o pathname removendo /api/app,
 * mas ao fazer window.location.href = "/login", o browser vai para /login
 * (fora do prefixo /api/app), resultando em 404.
 *
 * Solução: usar window.location.href com o prefixo correto em produção.
 */
export function redirectToLogin(): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    // Detectar se estamos no servidor permanente (URL contém /api/app ou domínio .manus.space)
    const isProd =
      window.location.pathname.startsWith("/api/app") ||
      window.location.hostname.endsWith(".manus.space");

    if (isProd) {
      // Em produção: redirecionar para /api/app/login com reload completo
      window.location.href = "/api/app/login";
    } else {
      // Em desenvolvimento: reload completo para limpar estado React
      window.location.href = "/login";
    }
  } else {
    // Mobile: usar o router do Expo
    router.replace("/login" as any);
  }
}
