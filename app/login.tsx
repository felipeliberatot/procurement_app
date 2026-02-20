import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { useColors } from "@/hooks/use-colors";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { isAuthenticated, loading } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 items-center justify-between px-8 py-12">
        <View className="flex-1 items-center justify-center gap-6">
          <View className="w-24 h-24 rounded-3xl bg-primary/10 items-center justify-center overflow-hidden">
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
          </View>
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">CompraFácil</Text>
            <Text className="text-base text-muted text-center leading-relaxed">
              Sistema de Gestão de Compras{"\n"}Empresariais
            </Text>
          </View>
          <View className="w-full gap-3 mt-4">
            {[
              { icon: "📝", text: "Solicitações com fluxo de aprovação em 7 etapas" },
              { icon: "⏱", text: "Prazos automáticos por nível de urgência" },
              { icon: "💬", text: "Notificações via WhatsApp para aprovadores" },
            ].map((item, i) => (
              <View key={i} className="flex-row items-center gap-3 bg-surface rounded-xl p-3 border border-border">
                <Text className="text-xl">{item.icon}</Text>
                <Text className="text-sm text-foreground flex-1">{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="w-full gap-4">
          <TouchableOpacity
            onPress={startOAuthLogin}
            className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-white text-base font-bold">Entrar com Manus</Text>
          </TouchableOpacity>
          <Text className="text-xs text-muted text-center">
            Ao entrar, você concorda com os termos de uso
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
