import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SignaturePad } from "@/components/signature-pad";

type ItemReceipt = {
  itemId: number;
  receiptStatus: "recebido" | "devolvido";
  receiptNotes: string;
};

export default function MaloteReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const maloteId = parseInt(id ?? "0", 10);
  const router = useRouter();
  const colors = useColors();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.malotes.getById.useQuery({ id: maloteId });

  const receiveMutation = trpc.malotes.receive.useMutation({
    onSuccess: () => {
      utils.malotes.list.invalidate();
      utils.malotes.stats.invalidate();
      Alert.alert("Sucesso", "Recebimento registrado com sucesso!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const [receiptNotes, setReceiptNotes] = useState("");
  const [itemReceipts, setItemReceipts] = useState<Record<number, ItemReceipt>>({});
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  const setItemStatus = (itemId: number, status: "recebido" | "devolvido") => {
    setItemReceipts((prev) => ({
      ...prev,
      [itemId]: { itemId, receiptStatus: status, receiptNotes: prev[itemId]?.receiptNotes ?? "" },
    }));
  };

  const setItemNotes = (itemId: number, notes: string) => {
    setItemReceipts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        itemId,
        receiptStatus: prev[itemId]?.receiptStatus ?? "recebido",
        receiptNotes: notes,
      },
    }));
  };

  const handleConfirm = () => {
    if (!data?.items?.length) {
      Alert.alert("Atenção", "Este malote não possui itens.");
      return;
    }
    const unappointed = data.items.filter((item) => !itemReceipts[item.id]);
    if (unappointed.length > 0) {
      Alert.alert("Atenção", `Aponte o status de todos os ${data.items.length} item(s) antes de confirmar.`);
      return;
    }
    if (!signatureData) {
      Alert.alert(
        "Assinatura Obrigatória",
        "É necessário coletar a assinatura do responsável pelo recebimento.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Assinar Agora", onPress: () => setShowSignaturePad(true) },
        ]
      );
      return;
    }
    const hasReturn = Object.values(itemReceipts).some((r) => r.receiptStatus === "devolvido");
    Alert.alert(
      "Confirmar Recebimento",
      hasReturn
        ? "Há itens marcados como DEVOLVIDOS. As solicitações correspondentes serão reabertas automaticamente. Confirmar?"
        : "Confirmar o recebimento completo do malote?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () =>
            receiveMutation.mutate({
              maloteId,
              receiptNotes,
              signatureData: signatureData ?? undefined,
              itemReceipts: Object.values(itemReceipts),
            }),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>Malote não encontrado.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const { malote, items } = data;

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>{malote.maloteCode}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {malote.originUnit} → {malote.destinationUnit}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Instrução */}
        <View style={[styles.infoBox, { backgroundColor: "#3B82F622", borderColor: "#3B82F6" }]}>
          <IconSymbol name="info.circle.fill" size={18} color="#3B82F6" />
          <Text style={[styles.infoText, { color: "#3B82F6" }]}>
            Marque cada item como Recebido ou Devolvido e colete a assinatura do responsável.
          </Text>
        </View>

        {/* Itens */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Itens do Malote ({items.length})
        </Text>

        {items.map((item) => {
          const receipt = itemReceipts[item.id];
          const isRecebido = receipt?.receiptStatus === "recebido";
          const isDevolvido = receipt?.receiptStatus === "devolvido";

          return (
            <View
              key={item.id}
              style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.itemCode, { color: colors.foreground }]}>{item.requestCode}</Text>
              <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={2}>
                {item.application}
              </Text>
              <Text style={[styles.itemReq, { color: colors.muted }]}>Solicitante: {item.requesterName}</Text>

              <View style={styles.statusRow}>
                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    { borderColor: "#22C55E", backgroundColor: isRecebido ? "#22C55E" : "transparent" },
                  ]}
                  onPress={() => setItemStatus(item.id, "recebido")}
                >
                  <IconSymbol name="checkmark" size={16} color={isRecebido ? "#fff" : "#22C55E"} />
                  <Text style={{ color: isRecebido ? "#fff" : "#22C55E", fontWeight: "600", marginLeft: 4 }}>
                    Recebido
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusBtn,
                    { borderColor: "#EF4444", backgroundColor: isDevolvido ? "#EF4444" : "transparent" },
                  ]}
                  onPress={() => setItemStatus(item.id, "devolvido")}
                >
                  <IconSymbol name="xmark" size={16} color={isDevolvido ? "#fff" : "#EF4444"} />
                  <Text style={{ color: isDevolvido ? "#fff" : "#EF4444", fontWeight: "600", marginLeft: 4 }}>
                    Devolvido
                  </Text>
                </TouchableOpacity>
              </View>

              {isDevolvido && (
                <TextInput
                  style={[styles.notesInput, { color: colors.foreground, borderColor: "#EF4444", backgroundColor: colors.background }]}
                  placeholder="Motivo da devolução (obrigatório)"
                  placeholderTextColor={colors.muted}
                  value={receipt?.receiptNotes ?? ""}
                  onChangeText={(t) => setItemNotes(item.id, t)}
                  multiline
                />
              )}
            </View>
          );
        })}

        {/* Observações gerais */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 16 }]}>
          Observações Gerais
        </Text>
        <TextInput
          style={[styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
          placeholder="Observações sobre o recebimento (opcional)"
          placeholderTextColor={colors.muted}
          value={receiptNotes}
          onChangeText={setReceiptNotes}
          multiline
          numberOfLines={3}
        />

        {/* ─── Assinatura Digital ─── */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>
          Assinatura Digital do Responsável
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
          Obrigatória para confirmar o recebimento. O responsável deve assinar abaixo.
        </Text>

        {signatureData ? (
          <View style={[styles.signaturePreviewBox, { borderColor: "#22C55E", backgroundColor: colors.surface }]}>
            <View style={[styles.signaturePreviewHeader, { borderBottomColor: "#22C55E33" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol name="checkmark.seal.fill" size={16} color="#22C55E" />
                <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "600" }}>Assinatura coletada</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setSignatureData(null); setShowSignaturePad(true); }}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Refazer</Text>
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: signatureData }}
              style={styles.signaturePreviewImage}
              resizeMode="contain"
            />
          </View>
        ) : showSignaturePad ? (
          <View style={[styles.signaturePadBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <SignaturePad
              height={180}
              onSave={(svg) => {
                setSignatureData(svg);
                setShowSignaturePad(false);
              }}
              onClear={() => setSignatureData(null)}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.signatureOpenBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={() => setShowSignaturePad(true)}
            activeOpacity={0.8}
          >
            <IconSymbol name="pencil" size={22} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600", marginLeft: 8 }}>
              Coletar Assinatura
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Botão de confirmar */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: signatureData ? colors.primary : colors.border }]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={receiveMutation.isPending}
        >
          {receiveMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <IconSymbol name="checkmark.seal.fill" size={20} color="#fff" />
              <Text style={styles.confirmText}>Confirmar Recebimento</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  infoBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  itemCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemCode: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  itemApp: { fontSize: 13, marginBottom: 2 },
  itemReq: { fontSize: 12, marginBottom: 10 },
  statusRow: { flexDirection: "row", gap: 10 },
  statusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  notesInput: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
  },
  signatureOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  signaturePadBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  signaturePreviewBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  signaturePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  signaturePreviewImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#fff",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 0.5,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
