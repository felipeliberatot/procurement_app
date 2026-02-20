import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { router } from "expo-router";
import React from "react";
import { Linking, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function WhatsAppSetupScreen() {
  const colors = useColors();

  const steps = [
    {
      icon: "1️⃣",
      title: "Configure a API do WhatsApp",
      description: "Crie uma conta no Meta Business e ative a WhatsApp Business API, ou use um gateway como Twilio, Z-API ou WPPConnect.",
    },
    {
      icon: "2️⃣",
      title: "Configure as variáveis de ambiente",
      description: "Adicione WHATSAPP_API_URL e WHATSAPP_API_TOKEN nas configurações do servidor.",
    },
    {
      icon: "3️⃣",
      title: "Cadastre os números dos aprovadores",
      description: "Acesse Cadastros → Usuários e adicione o número WhatsApp de cada aprovador (com DDI, ex: +5511999999999).",
    },
    {
      icon: "4️⃣",
      title: "Pronto!",
      description: "Os aprovadores receberão notificações automáticas a cada nova solicitação ou mudança de status.",
    },
  ];

  return (
    <ScreenContainer>
      <View className="flex-row items-center px-5 py-4 border-b border-border">
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Text className="text-primary text-base">← Voltar</Text>
        </Pressable>
        <Text className="flex-1 text-center text-base font-bold text-foreground">Integração WhatsApp</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="items-center mb-6">
          <Text className="text-6xl mb-3">💬</Text>
          <Text className="text-xl font-bold text-foreground text-center">Notificações via WhatsApp</Text>
          <Text className="text-sm text-muted text-center mt-2">
            Configure para que aprovadores recebam notificações e possam acompanhar o fluxo de compras diretamente pelo WhatsApp.
          </Text>
        </View>

        {/* Funcionalidades */}
        <View className="bg-success/10 border border-success/30 rounded-2xl p-4 mb-4">
          <Text className="text-sm font-bold text-success mb-2">✅ O que é notificado automaticamente:</Text>
          <View className="gap-1.5">
            {[
              "Nova solicitação criada → Gerente de Unidade",
              "Aprovação do Gerente → Solicitante (anexar orçamento)",
              "Orçamento anexado → Controladoria",
              "Aprovação da Controladoria → Diretoria",
              "Aprovação da Diretoria → Financeiro (ordem de compra)",
              "Ordem emitida → Financeiro (pagamento)",
              "Rejeição em qualquer etapa → Solicitante (corrigir em 48h)",
              "Cancelamento automático por prazo → Solicitante",
            ].map((item, i) => (
              <View key={i} className="flex-row items-start gap-2">
                <Text className="text-xs text-success mt-0.5">•</Text>
                <Text className="text-xs text-foreground flex-1">{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Passos */}
        <Text className="text-sm font-bold text-foreground mb-3">Como configurar</Text>
        {steps.map((step, i) => (
          <View key={i} className="bg-surface border border-border rounded-2xl p-4 mb-3 flex-row gap-3">
            <Text className="text-2xl">{step.icon}</Text>
            <View className="flex-1">
              <Text className="text-sm font-bold text-foreground mb-1">{step.title}</Text>
              <Text className="text-xs text-muted leading-relaxed">{step.description}</Text>
            </View>
          </View>
        ))}

        {/* Links úteis */}
        <Text className="text-sm font-bold text-foreground mb-3">Links Úteis</Text>
        <View className="gap-2">
          {[
            { label: "Meta WhatsApp Business API", url: "https://developers.facebook.com/docs/whatsapp" },
            { label: "Twilio WhatsApp", url: "https://www.twilio.com/whatsapp" },
            { label: "Z-API (Brasil)", url: "https://z-api.io" },
          ].map((link, i) => (
            <TouchableOpacity key={i} onPress={() => Linking.openURL(link.url)}
              className="bg-surface border border-border rounded-xl px-4 py-3 flex-row items-center justify-between">
              <Text className="text-sm text-primary">{link.label}</Text>
              <Text className="text-muted">→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="mt-4 bg-warning/10 border border-warning/30 rounded-2xl p-4">
          <Text className="text-xs text-warning font-semibold mb-1">⚠️ Nota sobre o número do WhatsApp</Text>
          <Text className="text-xs text-foreground">
            Certifique-se de cadastrar o número de cada aprovador no formato internacional: +55 seguido do DDD e número (ex: +5511999999999). O número deve ser o mesmo cadastrado no WhatsApp Business.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
