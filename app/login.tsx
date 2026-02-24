import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, loading]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Preencha o e-mail e a senha.");
      return;
    }
    setLoginLoading(true);
    setError(null);
    try {
      const result = await Api.loginWithPassword(email.trim().toLowerCase(), password);
      if (!result.success || !result.user) {
        setError(result.error ?? "E-mail ou senha incorretos.");
        return;
      }
      // Salvar token e dados do usuário
      if (result.token && Platform.OS !== "web") {
        await Auth.setSessionToken(result.token);
      }
      const userInfo: Auth.User = {
        id: result.user.id,
        openId: result.user.openId,
        name: result.user.name,
        email: result.user.email,
        loginMethod: "password",
        lastSignedIn: new Date(result.user.lastSignedIn),
        procurementRole: (result.user as any).procurementRole ?? null,
        approvalLevel: (result.user as any).approvalLevel ?? null,
        phone: (result.user as any).phone ?? null,
        active: (result.user as any).active ?? true,
      };
      await Auth.setUserInfo(userInfo);
      await refresh();
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message ?? "Erro ao fazer login. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.container}>
          {/* Logo e título */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: colors.primary + "1A" }]}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={{ width: 80, height: 80 }}
                contentFit="contain"
              />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>CGS Agrícola</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Sistema de Gestão de Compras
            </Text>
          </View>

          {/* Formulário */}
          <View style={styles.form}>
            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.inputLabel, { color: colors.muted }]}>E-mail</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com.br"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.inputLabel, { color: colors.muted }]}>Senha</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { color: colors.foreground }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  activeOpacity={0.6}
                  style={styles.eyeButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.eyeIcon, { color: colors.muted }]}>
                    {showPassword ? "🙈" : "👁"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.error + "1A", borderColor: colors.error + "40" }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }, loginLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loginLoading}
              activeOpacity={0.8}
            >
              {loginLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={[styles.footer, { color: colors.muted }]}>
            Acesso restrito a colaboradores CGS Agrícola
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    gap: 8,
    marginTop: 24,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
  },
  form: {
    gap: 14,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    paddingVertical: 0,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    textAlign: "center",
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    fontSize: 12,
    textAlign: "center",
    paddingBottom: 8,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeIcon: {
    fontSize: 18,
  },
});
