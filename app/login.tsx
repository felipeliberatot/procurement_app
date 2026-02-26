import AsyncStorage from "@react-native-async-storage/async-storage";
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
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Forgot Password Modal ────────────────────────────────────────────────────
function ForgotPasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setEmail("");
    setLoading(false);
    setStep("form");
    setTempPassword(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Informe o e-mail cadastrado.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await Api.forgotPassword(email.trim().toLowerCase());
      if (!result.success) {
        setError(result.error ?? "Erro ao processar solicitação.");
        return;
      }
      setTempPassword(result.tempPassword ?? null);
      setStep("success");
    } catch (e: any) {
      setError(e?.message ?? "Erro ao processar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 400 }}>
            {step === "form" ? (
              <>
                <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>🔑 Esqueceu a senha?</Text>
                <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 20 }}>
                  Informe seu e-mail cadastrado. Uma senha temporária será gerada para você.
                </Text>

                <View style={{
                  borderWidth: 1,
                  borderColor: error ? colors.error : colors.border,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  backgroundColor: colors.background,
                  marginBottom: 12,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, color: colors.muted, marginBottom: 4 }}>
                    E-mail
                  </Text>
                  <TextInput
                    style={{ fontSize: 16, color: colors.foreground, paddingVertical: 0 }}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(null); }}
                    placeholder="seu@email.com.br"
                    placeholderTextColor={colors.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>

                {error && (
                  <View style={{ backgroundColor: colors.error + "1A", borderWidth: 1, borderColor: colors.error + "40", borderRadius: 10, padding: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, color: colors.error, textAlign: "center" }}>{error}</Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={loading || !email.trim()}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      opacity: loading || !email.trim() ? 0.6 : 1,
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Enviar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>✅ Senha gerada!</Text>

                {tempPassword ? (
                  <>
                    <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 16 }}>
                      O SMTP não está configurado. Use a senha temporária abaixo para acessar o sistema e altere-a em seguida:
                    </Text>
                    <View style={{ backgroundColor: colors.primary + "15", borderWidth: 1.5, borderColor: colors.primary + "40", borderRadius: 14, padding: 20, alignItems: "center", marginBottom: 20 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, color: colors.muted, marginBottom: 8 }}>
                        Senha Temporária
                      </Text>
                      <Text style={{ fontSize: 28, fontWeight: "700", letterSpacing: 4, color: colors.primary }}>
                        {tempPassword}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginBottom: 20, lineHeight: 18 }}>
                      Anote esta senha. Ela não será exibida novamente.
                    </Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: 20 }}>
                    Se o e-mail <Text style={{ fontWeight: "700", color: colors.foreground }}>{email}</Text> estiver cadastrado, você receberá a nova senha por e-mail em breve.
                  </Text>
                )}

                <TouchableOpacity
                  onPress={handleClose}
                  style={{ paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Fechar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const { isAuthenticated, loading, refresh } = useAuth();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Carregar credenciais salvas ao montar
  useEffect(() => {
    AsyncStorage.getItem("@cgs:remember_credentials").then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.email) setEmail(saved.email);
          if (saved.password) setPassword(saved.password);
          setRememberMe(true);
        } catch {}
      }
    });
  }, []);

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
      // Salvar ou limpar credenciais conforme opção
      if (rememberMe) {
        await AsyncStorage.setItem("@cgs:remember_credentials", JSON.stringify({ email: email.trim().toLowerCase(), password }));
      } else {
        await AsyncStorage.removeItem("@cgs:remember_credentials");
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

            {/* Lembrar-me + Esqueceu a senha */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              {/* Checkbox Lembrar-me */}
              <TouchableOpacity
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  borderWidth: 2,
                  borderColor: rememberMe ? colors.primary : colors.border,
                  backgroundColor: rememberMe ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {rememberMe && (
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", lineHeight: 14 }}>✓</Text>
                  )}
                </View>
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "500" }}>Lembrar-me</Text>
              </TouchableOpacity>

              {/* Link "Esqueceu a senha?" */}
              <TouchableOpacity
                onPress={() => setShowForgotModal(true)}
                activeOpacity={0.6}
              >
                <Text style={[styles.forgotText, { color: colors.primary }]}>Esqueceu a senha?</Text>
              </TouchableOpacity>
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

      {/* Modal de recuperação de senha */}
      <ForgotPasswordModal
        visible={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
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
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -4,
    paddingVertical: 2,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: "600",
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
