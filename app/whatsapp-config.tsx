import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Linking,
  Alert,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";

const PROVIDERS = [
  {
    id: "zapi",
    name: "Z-API",
    description: "Solução brasileira, fácil configuração, ideal para pequenas e médias empresas.",
    url: "https://z-api.io",
    steps: [
      "Acesse z-api.io e crie uma conta",
      "Crie uma instância e conecte seu WhatsApp",
      "Copie o Instance ID e o Token",
      "Configure WHATSAPP_PROVIDER=zapi",
      "Configure WHATSAPP_API_URL=https://api.z-api.io/instances/{ID}/token/{TOKEN}",
      "Configure WHATSAPP_API_TOKEN={TOKEN}",
      "Configure o webhook: URL do servidor + /api/whatsapp/webhook",
    ],
    color: "#25D366",
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Plataforma global robusta com suporte oficial ao WhatsApp Business.",
    url: "https://twilio.com/whatsapp",
    steps: [
      "Acesse console.twilio.com e crie uma conta",
      "Ative o WhatsApp Sandbox ou solicite número aprovado",
      "Copie o Account SID e Auth Token",
      "Configure WHATSAPP_PROVIDER=twilio",
      "Configure WHATSAPP_API_URL=https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json",
      "Configure WHATSAPP_API_TOKEN={SID}:{AUTH_TOKEN} (base64)",
      "Configure o webhook no console Twilio: URL + /api/whatsapp/webhook",
    ],
    color: "#F22F46",
  },
  {
    id: "meta",
    name: "Meta Business API",
    description: "API oficial do WhatsApp Business, recomendada para grandes volumes.",
    url: "https://developers.facebook.com/docs/whatsapp",
    steps: [
      "Acesse developers.facebook.com e crie um app",
      "Adicione o produto WhatsApp Business",
      "Gere um token de acesso permanente",
      "Configure WHATSAPP_PROVIDER=meta",
      "Configure WHATSAPP_API_URL=https://graph.facebook.com/v18.0/{PHONE_ID}/messages",
      "Configure WHATSAPP_API_TOKEN={ACCESS_TOKEN}",
      "Configure o webhook no Meta: URL + /api/whatsapp/webhook",
      "Configure WHATSAPP_VERIFY_TOKEN com um token secreto",
    ],
    color: "#0866FF",
  },
];

export default function WhatsAppConfigScreen() {
  const colors = useColors();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  // Status is determined by environment variables (configured server-side)
  const isConfigured = false; // Will be true when WHATSAPP_API_URL and WHATSAPP_API_TOKEN are set
  const provider = "não configurado";
  const webhookUrl = "";

  const handleOpenProvider = (url: string) => {
    Linking.openURL(url);
  };

  const handleCopyWebhook = () => {
    Alert.alert(
      "URL do Webhook",
      webhookUrl || "Configure o servidor primeiro",
      [{ text: "OK" }]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.backText, { color: colors.foreground }]}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Integração WhatsApp
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Configure para que aprovadores recebam notificações e possam aprovar ou rejeitar solicitações diretamente pelo WhatsApp.
          </Text>
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, { backgroundColor: isConfigured ? "#dcfce7" : "#fef3c7", borderColor: isConfigured ? "#86efac" : "#fcd34d" }]}>
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>{isConfigured ? "✅" : "⚠️"}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: isConfigured ? "#166534" : "#92400e" }]}>
                {isConfigured ? "WhatsApp Configurado" : "WhatsApp Não Configurado"}
              </Text>
              <Text style={[styles.statusText, { color: isConfigured ? "#166534" : "#92400e" }]}>
                {isConfigured ? `Provedor: ${provider}` : "Configure as variáveis de ambiente abaixo"}
              </Text>
            </View>
          </View>
          {webhookUrl ? (
            <TouchableOpacity
              onPress={handleCopyWebhook}
              style={[styles.webhookBtn, { backgroundColor: isConfigured ? "#86efac" : "#fcd34d" }]}
            >
              <Text style={[styles.webhookText, { color: isConfigured ? "#166534" : "#92400e" }]}>
                🔗 Ver URL do Webhook
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* How it works */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Como funciona</Text>
          <View style={styles.flowStep}>
            <Text style={styles.flowNum}>1</Text>
            <Text style={[styles.flowText, { color: colors.muted }]}>
              Solicitação criada → aprovador recebe mensagem no WhatsApp com todos os detalhes
            </Text>
          </View>
          <View style={styles.flowStep}>
            <Text style={styles.flowNum}>2</Text>
            <Text style={[styles.flowText, { color: colors.muted }]}>
              Aprovador responde <Text style={{ fontWeight: "700", color: "#16a34a" }}>APROVAR</Text> ou <Text style={{ fontWeight: "700", color: "#dc2626" }}>REJEITAR motivo</Text>
            </Text>
          </View>
          <View style={styles.flowStep}>
            <Text style={styles.flowNum}>3</Text>
            <Text style={[styles.flowText, { color: colors.muted }]}>
              Sistema processa automaticamente e avança o fluxo para a próxima etapa
            </Text>
          </View>
          <View style={styles.flowStep}>
            <Text style={styles.flowNum}>4</Text>
            <Text style={[styles.flowText, { color: colors.muted }]}>
              Solicitante recebe confirmação do resultado no WhatsApp
            </Text>
          </View>
        </View>

        {/* Provider selection */}
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
          Escolha o provedor WhatsApp
        </Text>

        {PROVIDERS.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => setSelectedProvider(selectedProvider === p.id ? null : p.id)}
            style={[
              styles.providerCard,
              {
                backgroundColor: colors.surface,
                borderColor: selectedProvider === p.id ? p.color : colors.border,
                borderWidth: selectedProvider === p.id ? 2 : 1,
              },
            ]}
          >
            <View style={styles.providerHeader}>
              <View style={[styles.providerBadge, { backgroundColor: p.color }]}>
                <Text style={styles.providerBadgeText}>{p.name}</Text>
              </View>
              <Text style={[styles.providerArrow, { color: colors.muted }]}>
                {selectedProvider === p.id ? "▲" : "▼"}
              </Text>
            </View>
            <Text style={[styles.providerDesc, { color: colors.muted }]}>{p.description}</Text>

            {selectedProvider === p.id && (
              <View style={styles.providerSteps}>
                <Text style={[styles.stepsTitle, { color: colors.foreground }]}>Passo a passo:</Text>
                {p.steps.map((step, idx) => (
                  <View key={idx} style={styles.step}>
                    <Text style={[styles.stepNum, { color: p.color }]}>{idx + 1}.</Text>
                    <Text style={[styles.stepText, { color: colors.muted }]}>{step}</Text>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => handleOpenProvider(p.url)}
                  style={[styles.openBtn, { backgroundColor: p.color }]}
                >
                  <Text style={styles.openBtnText}>Abrir site do {p.name}</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Environment variables */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Variáveis de ambiente</Text>
          <Text style={[styles.envDesc, { color: colors.muted }]}>
            Configure estas variáveis no painel de Secrets do Manus (ícone ⚙️ → Settings → Secrets):
          </Text>
          {[
            { key: "WHATSAPP_PROVIDER", example: "zapi | twilio | meta", required: true },
            { key: "WHATSAPP_API_URL", example: "URL da API do provedor", required: true },
            { key: "WHATSAPP_API_TOKEN", example: "Token de autenticação", required: true },
            { key: "WHATSAPP_VERIFY_TOKEN", example: "cgs-agricola-webhook (Meta apenas)", required: false },
            { key: "APP_BASE_URL", example: "URL pública do app (para links nas mensagens)", required: false },
          ].map((env) => (
            <View key={env.key} style={[styles.envRow, { borderColor: colors.border }]}>
              <View style={styles.envKeyRow}>
                <Text style={[styles.envKey, { color: colors.foreground }]}>{env.key}</Text>
                {env.required && (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredText}>obrigatório</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.envExample, { color: colors.muted }]}>{env.example}</Text>
            </View>
          ))}
        </View>

        {/* Tip */}
        <View style={[styles.tipCard, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={[styles.tipText, { color: "#1e40af" }]}>
            Certifique-se de que cada usuário aprovador tem o número de WhatsApp cadastrado corretamente na aba Cadastros → Usuários.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20 },
  backBtn: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: "500" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  statusCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusIcon: { fontSize: 20 },
  statusTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  statusText: { fontSize: 13 },
  webhookBtn: { marginTop: 10, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start" },
  webhookText: { fontSize: 13, fontWeight: "600" },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  flowStep: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  flowNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#1d4ed8", color: "#fff", textAlign: "center", lineHeight: 24, fontSize: 13, fontWeight: "700" },
  flowText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  providerCard: { borderRadius: 12, padding: 14, marginBottom: 12 },
  providerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  providerBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  providerBadgeText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  providerArrow: { fontSize: 12 },
  providerDesc: { fontSize: 13, lineHeight: 18 },
  providerSteps: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  stepsTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  step: { flexDirection: "row", gap: 6, marginBottom: 6 },
  stepNum: { fontSize: 13, fontWeight: "700", minWidth: 18 },
  stepText: { flex: 1, fontSize: 12, lineHeight: 17 },
  openBtn: { marginTop: 12, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  openBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  envDesc: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  envRow: { borderTopWidth: 1, paddingTop: 10, paddingBottom: 6, marginBottom: 4 },
  envKeyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  envKey: { fontSize: 13, fontFamily: "monospace", fontWeight: "600" },
  requiredBadge: { backgroundColor: "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  requiredText: { fontSize: 10, color: "#dc2626", fontWeight: "600" },
  envExample: { fontSize: 12 },
  tipCard: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", gap: 10, marginBottom: 8 },
  tipIcon: { fontSize: 18 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
