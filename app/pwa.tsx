import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StyleSheet,
  Image,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";

// Detectar plataforma do usuário
function detectPlatform(): "ios" | "android" | "other" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  // Web: detectar via userAgent
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
  }
  return "other";
}

const STEPS_IOS = [
  {
    num: "1",
    title: "Abra no Safari",
    desc: "Certifique-se de estar usando o Safari (não Chrome ou outro navegador).",
  },
  {
    num: "2",
    title: "Toque em Compartilhar",
    desc: 'Toque no ícone de compartilhamento (□↑) na barra inferior do Safari.',
  },
  {
    num: "3",
    title: "Adicionar à Tela de Início",
    desc: 'Role para baixo e toque em "Adicionar à Tela de Início".',
  },
  {
    num: "4",
    title: "Confirmar instalação",
    desc: 'Toque em "Adicionar" no canto superior direito. O ícone aparecerá na sua tela de início!',
  },
];

const STEPS_ANDROID = [
  {
    num: "1",
    title: "Abra no Chrome",
    desc: "Use o Google Chrome para acessar esta página no seu Android.",
  },
  {
    num: "2",
    title: "Toque no menu ⋮",
    desc: "Toque nos três pontos no canto superior direito do Chrome.",
  },
  {
    num: "3",
    title: "Adicionar à tela inicial",
    desc: '"Adicionar à tela inicial" ou "Instalar app".',
  },
  {
    num: "4",
    title: "Confirmar",
    desc: 'Toque em "Adicionar". O ícone do app aparecerá na sua tela inicial!',
  },
];

const FEATURES = [
  { icon: "📋", title: "Solicitações", desc: "Crie e acompanhe pedidos de compra" },
  { icon: "✅", title: "Aprovações", desc: "Fluxo completo de aprovação" },
  { icon: "📊", title: "Relatórios", desc: "Análises e relatórios mensais" },
  { icon: "💬", title: "WhatsApp", desc: "Notificações em tempo real" },
];

export default function PWALandingPage() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [activeTab, setActiveTab] = useState<"ios" | "android">("ios");

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    if (p === "android") setActiveTab("android");
    else setActiveTab("ios");
  }, []);

  const steps = activeTab === "ios" ? STEPS_IOS : STEPS_ANDROID;

  const handleOpenApp = () => {
    Linking.openURL("/api/app/login");
  };

  return (
    <ScreenContainer containerClassName="bg-white" edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.appIcon}
            resizeMode="cover"
          />
          <Text style={styles.appName}>Compras CGS Agrícola</Text>
          <Text style={styles.appSubtitle}>Sistema de Gestão de Compras</Text>
          <TouchableOpacity style={styles.openBtn} onPress={handleOpenApp}>
            <Text style={styles.openBtnText}>🚀 Abrir o App</Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo */}
        <View style={styles.content}>
          {/* Banner de instalação */}
          <View style={styles.installBanner}>
            <Text style={styles.installBannerIcon}>📲</Text>
            <View style={styles.installBannerText}>
              <Text style={styles.installBannerTitle}>Adicione à tela de início</Text>
              <Text style={styles.installBannerDesc}>
                Instale o app no seu celular para acesso rápido, sem precisar abrir o navegador.
              </Text>
            </View>
          </View>

          {/* Seção de instruções */}
          <Text style={styles.sectionTitle}>📱 INSTRUÇÕES DE INSTALAÇÃO</Text>

          {/* Tabs */}
          <View style={styles.platformTabs}>
            <TouchableOpacity
              style={[styles.platformTab, activeTab === "ios" && styles.platformTabActive]}
              onPress={() => setActiveTab("ios")}
            >
              <Text style={[styles.platformTabText, activeTab === "ios" && styles.platformTabTextActive]}>
                🍎 iPhone (iOS)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.platformTab, activeTab === "android" && styles.platformTabActive]}
              onPress={() => setActiveTab("android")}
            >
              <Text style={[styles.platformTabText, activeTab === "android" && styles.platformTabTextActive]}>
                🤖 Android
              </Text>
            </TouchableOpacity>
          </View>

          {/* Steps */}
          <View style={styles.stepsCard}>
            {steps.map((step, index) => (
              <View key={step.num} style={[styles.step, index < steps.length - 1 && styles.stepBorder]}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.num}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Funcionalidades */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>✨ FUNCIONALIDADES</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>

          {/* Footer */}
          <Text style={styles.footer}>© 2026 CGS Agrícola · Acesso restrito a colaboradores</Text>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenApp}>
        <Text style={styles.fabText}>🚀 Acessar o Sistema</Text>
      </TouchableOpacity>
    </ScreenContainer>
  );
}

const GREEN = "#166534";
const GREEN_BG = "#f0fdf4";
const GREEN_BORDER = "#bbf7d0";

const styles = StyleSheet.create({
  header: {
    backgroundColor: GREEN,
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  appIcon: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: "white",
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 28,
  },
  openBtn: {
    backgroundColor: "white",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  openBtnText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  installBanner: {
    backgroundColor: GREEN_BG,
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  installBannerIcon: {
    fontSize: 32,
  },
  installBannerText: {
    flex: 1,
  },
  installBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: GREEN,
    marginBottom: 3,
  },
  installBannerDesc: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9ca3af",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  platformTabs: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  platformTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 9,
  },
  platformTabActive: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  platformTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9ca3af",
  },
  platformTabTextActive: {
    color: GREEN,
  },
  stepsCard: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    overflow: "hidden",
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 16,
  },
  stepBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumberText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 3,
    textAlign: "center",
  },
  featureDesc: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 15,
  },
  footer: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    backgroundColor: GREEN,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 50,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
  },
});
