import { Modal, View, Text, TouchableOpacity, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmação cross-platform (web + mobile).
 * Substitui Alert.alert com múltiplos botões, que não funciona na web.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = useColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 400,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: colors.foreground,
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.muted,
              textAlign: "center",
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>
                {cancelText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: "center",
                backgroundColor: confirmDestructive ? colors.error : colors.primary,
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
