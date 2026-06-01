import { Platform } from "react-native";
import { router } from "expo-router";

/**
 * Redireciona para a tela de login de forma correta em todas as plataformas.
 *
 * IMPORTANTE: Não usar window.location.href em produção — isso causa um reload
 * completo que, combinado com o script de baseUrl injetado no index.html
 * (que remove o prefixo /api/app do pathname), cria um loop infinito de
 * redirecionamentos na tela de login.
 *
 * Solução: usar sempre o router do Expo (navegação SPA sem reload).
 */
export function redirectToLogin(): void {
  // Usar sempre o router do Expo (funciona em web e mobile sem reload completo)
  // router.replace evita que o usuário volte à tela protegida com o botão voltar
  try {
    router.replace("/login" as any);
  } catch {
    // Fallback caso o router ainda não esteja montado (erro muito cedo na inicialização)
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }
}
