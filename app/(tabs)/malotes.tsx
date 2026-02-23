import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  enviado: "Enviado",
  recebido: "Recebido",
  devolvido: "Devolvido",
};

const STATUS_COLOR: Record<string, string> = {
  aberto: "#3B82F6",
  enviado: "#F59E0B",
  recebido: "#22C55E",
  devolvido: "#EF4444",
};

type MaloteItem = {
  id: number;
  requestCode: string;
  requesterName: string;
  application: string;
  receiptStatus: string;
};

type Malote = {
  id: number;
  maloteCode: string;
  status: string;
  originUnit: string;
  destinationUnit: string;
  createdByName: string;
  createdAt: string | Date;
  items?: MaloteItem[];
};

export default function MalotesScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();

  const { data: malotes = [], isLoading } = trpc.malotes.list.useQuery();
  const { data: readyRequests = [] } = trpc.malotes.readyRequests.useQuery();

  const createMutation = trpc.malotes.create.useMutation({
    onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.stats.invalidate(); },
  });
  const addRequestMutation = trpc.malotes.addRequest.useMutation({
    onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.readyRequests.invalidate(); },
  });
  const removeRequestMutation = trpc.malotes.removeRequest.useMutation({
    onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.readyRequests.invalidate(); },
  });
  const sendMutation = trpc.malotes.send.useMutation({
    onSuccess: () => utils.malotes.list.invalidate(),
  });

  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [originUnit, setOriginUnit] = useState("");
  const [destinationUnit, setDestinationUnit] = useState("");

  const [selectedMalote, setSelectedMalote] = useState<Malote | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: maloteDetail } = trpc.malotes.getById.useQuery(
    { id: selectedMalote?.id ?? 0 },
    { enabled: !!selectedMalote && showDetail }
  );

  const [showAddRequest, setShowAddRequest] = useState(false);

  const handleCreate = () => {
    if (!originUnit.trim() || !destinationUnit.trim()) {
      Alert.alert("Atenção", "Preencha a unidade de origem e destino.");
      return;
    }
    createMutation.mutate(
      { originUnit: originUnit.trim(), destinationUnit: destinationUnit.trim() },
      {
        onSuccess: () => {
          setShowCreate(false);
          setOriginUnit("");
          setDestinationUnit("");
        },
        onError: (e) => Alert.alert("Erro", e.message),
      }
    );
  };

  const handleSend = (maloteId: number) => {
    Alert.alert(
      "Enviar Malote",
      "Confirma o envio deste malote para a unidade de destino?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: () =>
            sendMutation.mutate(
              { maloteId },
              {
                onSuccess: () => {
                  setShowDetail(false);
                  Alert.alert("Sucesso", "Malote enviado!");
                },
                onError: (e) => Alert.alert("Erro", e.message),
              }
            ),
        },
      ]
    );
  };

  const handleAddRequest = (req: { id: number; requestNumber: string; requesterName: string; application: string }) => {
    if (!selectedMalote) return;
    addRequestMutation.mutate(
      {
        maloteId: selectedMalote.id,
        requestId: req.id,
        requestCode: req.requestNumber,
        requesterName: req.requesterName,
        application: req.application,
      },
      {
        onSuccess: () => {
          setShowAddRequest(false);
          utils.malotes.getById.invalidate({ id: selectedMalote.id });
        },
        onError: (e) => Alert.alert("Erro", e.message),
      }
    );
  };

  const handleRemoveItem = (itemId: number) => {
    Alert.alert("Remover", "Remover esta solicitação do malote?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () =>
          removeRequestMutation.mutate(
            { maloteItemId: itemId },
            {
              onSuccess: () => {
                if (selectedMalote) utils.malotes.getById.invalidate({ id: selectedMalote.id });
              },
              onError: (e) => Alert.alert("Erro", e.message),
            }
          ),
      },
    ]);
  };

  const formatDate = (d: string | Date) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const renderMalote = ({ item }: { item: Malote }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => { setSelectedMalote(item); setShowDetail(true); }}
      activeOpacity={0.75}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.code, { color: colors.foreground }]}>{item.maloteCode}</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + "22" }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Text>
        </View>
      </View>
      <Text style={[styles.route, { color: colors.muted }]}>
        {item.originUnit} → {item.destinationUnit}
      </Text>
      <Text style={[styles.meta, { color: colors.muted }]}>
        Criado por {item.createdByName} · {formatDate(item.createdAt)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Malotes</Text>
        <TouchableOpacity
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowCreate(true)}
          activeOpacity={0.8}
        >
          <IconSymbol name="plus" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : malotes.length === 0 ? (
        <View style={styles.empty}>
          <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum malote criado</Text>
        </View>
      ) : (
        <FlatList
          data={malotes as Malote[]}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMalote}
          contentContainerStyle={{ padding: 16, gap: 10 }}
        />
      )}

      {/* Modal: Criar Malote */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo Malote</Text>
            <Text style={[styles.label, { color: colors.muted }]}>Unidade de Origem</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={originUnit}
              onChangeText={setOriginUnit}
              placeholder="Ex: Matriz - Cuiabá"
              placeholderTextColor={colors.muted}
            />
            <Text style={[styles.label, { color: colors.muted }]}>Unidade de Destino</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              value={destinationUnit}
              onChangeText={setDestinationUnit}
              placeholder="Ex: Fazenda São João"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.border }]}
                onPress={() => setShowCreate(false)}
              >
                <Text style={{ color: colors.foreground }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={handleCreate}
              >
                {createMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: "#fff", fontWeight: "600" }}>Criar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Detalhe do Malote */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {selectedMalote?.maloteCode}
              </Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {selectedMalote && (
              <View style={[styles.infoBadge, { backgroundColor: STATUS_COLOR[selectedMalote.status] + "22" }]}>
                <Text style={{ color: STATUS_COLOR[selectedMalote.status], fontWeight: "600" }}>
                  {STATUS_LABEL[selectedMalote.status]}
                </Text>
              </View>
            )}

            <Text style={[styles.route, { color: colors.muted, marginBottom: 12 }]}>
              {selectedMalote?.originUnit} → {selectedMalote?.destinationUnit}
            </Text>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Solicitações</Text>

            <ScrollView style={{ maxHeight: 260 }}>
              {maloteDetail?.items && maloteDetail.items.length > 0 ? (
                maloteDetail.items.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.itemRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemCode, { color: colors.foreground }]}>{item.requestCode}</Text>
                      <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={1}>
                        {item.application}
                      </Text>
                    </View>
                    {selectedMalote?.status === "aberto" && (
                      <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                        <IconSymbol name="trash.fill" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: 13 }]}>
                  Nenhuma solicitação adicionada
                </Text>
              )}
            </ScrollView>

            {selectedMalote?.status === "aberto" && (
              <View style={[styles.row, { marginTop: 16 }]}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.border, flex: 1 }]}
                  onPress={() => setShowAddRequest(true)}
                >
                  <IconSymbol name="plus" size={16} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, marginLeft: 4 }}>Adicionar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#F59E0B", flex: 1 }]}
                  onPress={() => handleSend(selectedMalote.id)}
                >
                  <IconSymbol name="paperplane.fill" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 4 }}>Enviar</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedMalote?.status === "enviado" && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: "#22C55E", marginTop: 16, justifyContent: "center" }]}
                onPress={() => {
                  setShowDetail(false);
                  router.push(`/malote/${selectedMalote.id}`);
                }}
              >
                <IconSymbol name="checkmark.seal.fill" size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 4 }}>Registrar Recebimento</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal: Adicionar Solicitação */}
      <Modal visible={showAddRequest} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Solicitação</Text>
              <TouchableOpacity onPress={() => setShowAddRequest(false)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.meta, { color: colors.muted, marginBottom: 8 }]}>
              Solicitações concluídas disponíveis:
            </Text>
            <FlatList
              data={readyRequests}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.itemRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleAddRequest(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemCode, { color: colors.foreground }]}>{item.requestNumber}</Text>
                    <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={1}>
                      {item.application} · {item.department}
                    </Text>
                  </View>
                  <IconSymbol name="plus" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: 13 }]}>
                  Nenhuma solicitação disponível para malote
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  title: { fontSize: 22, fontWeight: "700" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  code: { fontSize: 16, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  route: { fontSize: 13, marginBottom: 4 },
  meta: { fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  infoBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginBottom: 8 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  itemCode: { fontSize: 14, fontWeight: "600" },
  itemApp: { fontSize: 12, marginTop: 2 },
});
