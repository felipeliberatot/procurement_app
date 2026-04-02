import React, { useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

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
  sentAt?: string | Date | null;
  notes?: string | null;
  items?: MaloteItem[];
};

const ALL_STATUSES = ["todos", "aberto", "enviado", "recebido", "devolvido"] as const;

// ─── Helpers de ícone por tipo de unidade ────────────────────────────────────
type UnitEntry = { name: string; type: string };

function getUnitIcon(type: string): string {
  switch (type) {
    case "fazenda": return "🌾";
    case "escritorio": return "🏢";
    case "filial": return "🏗️";
    case "deposito": return "📦";
    default: return "📍";
  }
}

// ─── Componente de seleção de unidade inline ─────────────────────────────────
function UnitSelector({
  label,
  value,
  units,
  onChange,
  colors,
}: {
  label: string;
  value: string;
  units: UnitEntry[];
  onChange: (v: string) => void;
  colors: ReturnType<typeof import("@/hooks/use-colors").useColors>;
}) {
  const [open, setOpen] = useState(false);
  const selectedEntry = units.find((u) => u.name === value);
  const displayIcon = selectedEntry ? getUnitIcon(selectedEntry.type) : "";

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 10 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
        style={{
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderColor: open ? colors.primary : colors.border,
          backgroundColor: colors.background,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: value ? colors.foreground : colors.muted, fontSize: 15, flex: 1 }}>
          {value ? `${displayIcon} ${value}` : "Selecionar unidade..."}
        </Text>
        <IconSymbol
          name={open ? "chevron.up" : "chevron.down"}
          size={16}
          color={open ? colors.primary : colors.muted}
        />
      </TouchableOpacity>

      {open && (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 10,
            marginTop: 4,
            backgroundColor: colors.background,
            overflow: "hidden",
            maxHeight: 220,
          }}
        >
          {units.length === 0 ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>
                Nenhuma unidade cadastrada.{"\n"}Vá em Cadastros → Unidades.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {units.map((entry) => {
                const selected = value === entry.name;
                const icon = getUnitIcon(entry.type);
                return (
                  <TouchableOpacity
                    key={entry.name}
                    onPress={() => {
                      onChange(entry.name);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.border,
                      backgroundColor: selected ? colors.primary + "12" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        color: selected ? colors.primary : colors.foreground,
                        fontWeight: selected ? "700" : "400",
                        flex: 1,
                      }}
                    >
                      {icon} {entry.name}
                    </Text>
                    {selected && (
                      <IconSymbol name="checkmark.seal.fill" size={18} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────────────
export default function MalotesScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);

  const { data: malotes = [], isLoading } = trpc.malotes.list.useQuery();
  const { data: readyRequests = [] } = trpc.malotes.readyRequests.useQuery();
  const { data: unitsList = [] } = trpc.units.list.useQuery();
  const { data: businessUnitsList = [] } = trpc.businessUnits.list.useQuery();

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

  const [showCreate, setShowCreate] = useState(false);
  const [originUnit, setOriginUnit] = useState("");
  const [destinationUnit, setDestinationUnit] = useState("");
  const [newMaloteNotes, setNewMaloteNotes] = useState("");
  const [selectedMalote, setSelectedMalote] = useState<Malote | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterUnit, setFilterUnit] = useState<string>("todas");
  const [showUnitPicker, setShowUnitPicker] = useState<"filter" | null>(null);
  const [confirmSendMaloteId, setConfirmSendMaloteId] = useState<number | null>(null);

  const { data: maloteDetail } = trpc.malotes.getById.useQuery(
    { id: selectedMalote?.id ?? 0 },
    { enabled: !!selectedMalote && showDetail }
  );

  // Combina Fazendas (units) + Unidades (businessUnits) em lista única com tipo
  const unitEntries: UnitEntry[] = useMemo(() => {
    const fromUnits: UnitEntry[] = (unitsList as any[]).map((u) => ({ name: u.name, type: "fazenda" }));
    const fromBU: UnitEntry[] = (businessUnitsList as any[]).map((u) => ({ name: u.name, type: u.type ?? "outro" }));
    const all = [...fromUnits, ...fromBU];
    // Remove duplicatas por nome, mantendo o primeiro encontrado
    const seen = new Set<string>();
    return all.filter((e) => { if (seen.has(e.name)) return false; seen.add(e.name); return true; })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [unitsList, businessUnitsList]);
  // Lista de nomes para filtro e compatibilidade
  const unitNames: string[] = useMemo(() => unitEntries.map((e) => e.name), [unitEntries]);

  const filteredMalotes = useMemo(() => {
    let list = malotes as Malote[];
    if (filterStatus !== "todos") list = list.filter((m) => m.status === filterStatus);
    if (filterUnit !== "todas") list = list.filter((m) => m.originUnit === filterUnit || m.destinationUnit === filterUnit);
    return list;
  }, [malotes, filterStatus, filterUnit]);

  const handleCreate = () => {
    if (!originUnit.trim() || !destinationUnit.trim()) {
      Alert.alert("Atenção", "Selecione a unidade de origem e destino.");
      return;
    }
    if (originUnit === destinationUnit) {
      Alert.alert("Atenção", "Origem e destino não podem ser iguais.");
      return;
    }
    createMutation.mutate(
      { originUnit, destinationUnit, notes: newMaloteNotes.trim() || undefined },
      {
        onSuccess: () => {
          setShowCreate(false);
          setOriginUnit("");
          setDestinationUnit("");
          setNewMaloteNotes("");
        },
        onError: (e) => Alert.alert("Erro", e.message),
      }
    );
  };

  const handleSend = (maloteId: number) => {
    setConfirmSendMaloteId(maloteId);
  };

  const handleAddRequest = (req: { id: number; requestNumber: string; requesterName: string; application: string }) => {
    if (!selectedMalote) return;
    addRequestMutation.mutate(
      { maloteId: selectedMalote.id, requestId: req.id, requestCode: req.requestNumber, requesterName: req.requesterName, application: req.application },
      {
        onSuccess: () => { setShowAddRequest(false); utils.malotes.getById.invalidate({ id: selectedMalote.id }); },
        onError: (e) => Alert.alert("Erro", e.message),
      }
    );
  };

  const handleRemoveItem = (itemId: number) => {
    Alert.alert("Remover", "Remover esta solicitação do malote?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive",
        onPress: () => removeRequestMutation.mutate(
          { maloteItemId: itemId },
          {
            onSuccess: () => { if (selectedMalote) utils.malotes.getById.invalidate({ id: selectedMalote.id }); },
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
      <Text style={[styles.route, { color: colors.muted }]}>📦 {item.originUnit} → {item.destinationUnit}</Text>
      <Text style={[styles.meta, { color: colors.muted }]}>Criado por {item.createdByName} · {formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Malotes</Text>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCreate(true)} activeOpacity={0.8}>
          <IconSymbol name="plus" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ALL_STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setFilterStatus(s)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: filterStatus === s ? colors.primary : colors.surface, borderWidth: 1, borderColor: filterStatus === s ? colors.primary : colors.border }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: filterStatus === s ? "#fff" : colors.muted }}>
                {s === "todos" ? "Todos" : STATUS_LABEL[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          onPress={() => setShowUnitPicker("filter")}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: filterUnit !== "todas" ? colors.primary + "15" : colors.surface, borderWidth: 1, borderColor: filterUnit !== "todas" ? colors.primary : colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13, color: filterUnit !== "todas" ? colors.primary : colors.muted, fontWeight: "600" }}>
            🏭 {filterUnit === "todas" ? "Todas as unidades" : filterUnit}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : filteredMalotes.length === 0 ? (
        <View style={styles.empty}>
          <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {(malotes as Malote[]).length === 0 ? "Nenhum malote criado" : "Nenhum malote com esses filtros"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMalotes}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMalote}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: Math.max(insets.bottom + 16, 32) }}
        />
      )}

      {/* ─── Modal: Criar Malote ─── */}
      <Modal visible={showCreate} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: colors.surface }]}>
              {/* Cabeçalho */}
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Novo Malote</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCreate(false);
                    setOriginUnit("");
                    setDestinationUnit("");
                    setNewMaloteNotes("");
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IconSymbol name="xmark" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>

              {/* Conteúdo rolável */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Seletor de Origem — inline dropdown */}
                <UnitSelector
                  label="Unidade de Origem *"
                  value={originUnit}
                  units={unitEntries}
                  onChange={setOriginUnit}
                  colors={colors}
                />

                {/* Seletor de Destino — inline dropdown */}
                <UnitSelector
                  label="Unidade de Destino *"
                  value={destinationUnit}
                  units={unitEntries}
                  onChange={setDestinationUnit}
                  colors={colors}
                />

                {/* Observações */}
                <Text style={[styles.label, { color: colors.muted }]}>Observações</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      height: 80,
                      textAlignVertical: "top",
                    },
                  ]}
                  placeholder="Informações adicionais sobre o malote..."
                  placeholderTextColor={colors.muted}
                  value={newMaloteNotes}
                  onChangeText={setNewMaloteNotes}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />

                {/* Botões */}
                <View style={[styles.row, { marginTop: 20 }]}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.border }]}
                    onPress={() => {
                      setShowCreate(false);
                      setOriginUnit("");
                      setDestinationUnit("");
                      setNewMaloteNotes("");
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.primary }]}
                    onPress={handleCreate}
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: "#fff", fontWeight: "600" }}>Criar Malote</Text>
                    }
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Modal: Filtro por Unidade ─── */}
      <Modal visible={showUnitPicker !== null} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, maxHeight: "70%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Filtrar por Unidade</Text>
              <TouchableOpacity onPress={() => setShowUnitPicker(null)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.unitOption, { borderBottomColor: colors.border }]}
                onPress={() => { setFilterUnit("todas"); setShowUnitPicker(null); }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 15, color: filterUnit === "todas" ? colors.primary : colors.foreground, fontWeight: filterUnit === "todas" ? "700" : "400" }}>
                  Todas as unidades
                </Text>
                {filterUnit === "todas" && <IconSymbol name="checkmark.seal.fill" size={18} color={colors.primary} />}
              </TouchableOpacity>
              {unitNames.length === 0 ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center" }}>
                    Nenhuma unidade cadastrada.{"\n"}Vá em Cadastros → Unidades para cadastrar.
                  </Text>
                </View>
              ) : (
                unitNames.map((name) => {
                  const isSelected = filterUnit === name;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[styles.unitOption, { borderBottomColor: colors.border }]}
                      onPress={() => { setFilterUnit(name); setShowUnitPicker(null); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 15, color: isSelected ? colors.primary : colors.foreground, fontWeight: isSelected ? "700" : "400" }}>
                        🏭 {name}
                      </Text>
                      {isSelected && <IconSymbol name="checkmark.seal.fill" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Detalhe do Malote ─── */}
      <Modal visible={showDetail} transparent animationType="slide" statusBarTranslucent>
        <View style={styles.overlay}>
          <View style={[
            styles.modal,
            { backgroundColor: colors.surface, maxHeight: "90%", paddingBottom: 0 },
          ]}>
            {/* Barra de arraste */}
            <View style={{ alignItems: "center", marginBottom: 8, marginTop: -4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            </View>

            {/* Cabeçalho fixo */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selectedMalote?.maloteCode}</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Conteúdo rolável */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: bottomPad + 8 }}
            >
              {selectedMalote && (
                <View style={[styles.infoBadge, { backgroundColor: STATUS_COLOR[selectedMalote.status] + "22" }]}>
                  <Text style={{ color: STATUS_COLOR[selectedMalote.status], fontWeight: "600" }}>
                    {STATUS_LABEL[selectedMalote.status]}
                  </Text>
                </View>
              )}
              <Text style={[styles.route, { color: colors.muted, marginBottom: selectedMalote?.notes ? 6 : 12 }]}>
                📦 {selectedMalote?.originUnit} → {selectedMalote?.destinationUnit}
              </Text>
              {selectedMalote?.notes ? (
                <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginBottom: 2 }}>OBSERVAÇÕES</Text>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>{selectedMalote.notes}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Solicitações ({(maloteDetail?.items ?? []).length})
                </Text>
                {selectedMalote?.status === "aberto" && (
                  <TouchableOpacity onPress={() => setShowAddRequest(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} activeOpacity={0.7}>
                    <IconSymbol name="plus" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Adicionar</Text>
                  </TouchableOpacity>
                )}
              </View>
              {maloteDetail?.items && maloteDetail.items.length > 0 ? (
                maloteDetail.items.map((item) => (
                  <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemCode, { color: colors.foreground }]}>{item.requestCode}</Text>
                      <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={2}>{item.application}</Text>
                    </View>
                    {selectedMalote?.status === "aberto" && (
                      <TouchableOpacity onPress={() => handleRemoveItem(item.id)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <IconSymbol name="trash.fill" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: 13, marginVertical: 12 }]}>
                  Nenhuma solicitação adicionada
                </Text>
              )}

              {/* Botões de ação com espaço extra para não ficar cortado */}
              {selectedMalote?.status === "aberto" && (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: "#F59E0B", marginTop: 20, justifyContent: "center", paddingVertical: 16 },
                  ]}
                  onPress={() => handleSend(selectedMalote.id)}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 15 }}>Enviar Malote</Text>
                </TouchableOpacity>
              )}
              {selectedMalote?.status === "enviado" && (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: "#22C55E", marginTop: 20, justifyContent: "center", paddingVertical: 16 },
                  ]}
                  onPress={() => { setShowDetail(false); router.push(`/malote/${selectedMalote.id}`); }}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="checkmark.seal.fill" size={18} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 15 }}>Registrar Recebimento</Text>
                </TouchableOpacity>
              )}

              {/* Botão de impressão — disponível em todos os status */}
              {selectedMalote && (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, marginTop: 12, justifyContent: "center", paddingVertical: 14 },
                  ]}
                  onPress={async () => {
                    const malote = selectedMalote;
                    const dataEnvio = malote.sentAt ? new Date(malote.sentAt).toLocaleDateString("pt-BR") : "—";
                    const itensHtml = (malote.items ?? []).map((item: MaloteItem, idx: number) => `
                      <tr style="background:${idx % 2 === 0 ? "#f9fafb" : "#fff"}">
                        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;">${item.requestCode}</td>
                        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${item.application}</td>
                        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${item.requesterName}</td>
                        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:center;">
                          <span style="background:${item.receiptStatus === 'recebido' ? '#dcfce7' : item.receiptStatus === 'devolvido' ? '#fee2e2' : '#fef9c3'};color:${item.receiptStatus === 'recebido' ? '#166534' : item.receiptStatus === 'devolvido' ? '#991b1b' : '#854d0e'};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">
                            ${item.receiptStatus === 'recebido' ? 'Recebido' : item.receiptStatus === 'devolvido' ? 'Devolvido' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    `).join("");
                    const html = `
                      <!DOCTYPE html>
                      <html lang="pt-BR">
                      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <title>Malote ${malote.maloteCode}</title>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; }
                        .header { background: #1a7a4a; color: white; padding: 24px 32px; }
                        .header h1 { margin: 0; font-size: 22px; }
                        .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
                        .content { padding: 24px 32px; }
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
                        .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
                        .info-box label { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px; }
                        .info-box span { font-size: 14px; font-weight: 700; color: #111; }
                        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
                        .status-aberto { background: #dbeafe; color: #1d4ed8; }
                        .status-enviado { background: #fef3c7; color: #92400e; }
                        .status-recebido { background: #dcfce7; color: #166534; }
                        .status-devolvido { background: #fee2e2; color: #991b1b; }
                        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
                        th { background: #1a7a4a; color: white; padding: 10px; font-size: 11px; text-align: left; }
                        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
                        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                      </style></head>
                      <body>
                        <div class="header">
                          <h1>CGS Agrícola — Malote ${malote.maloteCode}</h1>
                          <p>Documento gerado em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                        </div>
                        <div class="content">
                          <div class="info-grid">
                            <div class="info-box"><label>Código</label><span>${malote.maloteCode}</span></div>
                            <div class="info-box"><label>Status</label><span class="status-badge status-${malote.status}">${{ aberto: "Aberto", enviado: "Enviado", recebido: "Recebido", devolvido: "Devolvido" }[malote.status] ?? malote.status}</span></div>
                            <div class="info-box"><label>Origem</label><span>${malote.originUnit}</span></div>
                            <div class="info-box"><label>Destino</label><span>${malote.destinationUnit}</span></div>
                            <div class="info-box"><label>Criado por</label><span>${malote.createdByName}</span></div>
                            <div class="info-box"><label>Data de Envio</label><span>${dataEnvio}</span></div>
                          </div>
                          ${malote.notes ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px;"><strong style="font-size:12px;">Observações:</strong><p style="margin:4px 0 0;font-size:13px;">${malote.notes}</p></div>` : ""}
                          <h3 style="font-size:14px;margin-bottom:8px;">Solicitações no Malote (${(malote.items ?? []).length})</h3>
                          <table>
                            <thead><tr><th>Código</th><th>Aplicação</th><th>Solicitante</th><th style="text-align:center;">Status</th></tr></thead>
                            <tbody>${itensHtml || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#9ca3af;">Nenhuma solicitação</td></tr>'}</tbody>
                          </table>
                          <div class="footer">CGS Agrícola • Sistema de Compras • ${malote.maloteCode}</div>
                        </div>
                      </body></html>
                    `;
                    try {
                      const { uri } = await Print.printToFileAsync({ html, base64: false });
                      const canShare = await Sharing.isAvailableAsync();
                      if (canShare) {
                        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Salvar / Imprimir PDF", UTI: "com.adobe.pdf" });
                      } else {
                        Alert.alert("PDF gerado", "Arquivo salvo em: " + uri);
                      }
                    } catch (e) {
                      Alert.alert("Erro", "Não foi possível gerar o PDF.");
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 16 }}>🖨️</Text>
                  <Text style={{ color: colors.foreground, fontWeight: "700", marginLeft: 6, fontSize: 14 }}>Imprimir / Salvar PDF</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Adicionar Solicitação ─── */}
      <Modal visible={showAddRequest} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Solicitação</Text>
              <TouchableOpacity onPress={() => setShowAddRequest(false)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.meta, { color: colors.muted, marginBottom: 8 }]}>Solicitações concluídas disponíveis:</Text>
            <FlatList
              data={readyRequests}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.itemRow, { borderBottomColor: colors.border }]} onPress={() => handleAddRequest(item)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemCode, { color: colors.foreground }]}>{item.requestNumber}</Text>
                    <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={1}>{item.application} · {item.department}</Text>
                  </View>
                  <IconSymbol name="plus" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: 13 }]}>Nenhuma solicitação disponível para malote</Text>
              }
            />
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmSendMaloteId !== null}
        title="Enviar Malote"
        message="Confirma o envio deste malote para a unidade de destino?"
        confirmText="Enviar"
        onConfirm={() => {
          if (confirmSendMaloteId !== null) {
            sendMutation.mutate(
              { maloteId: confirmSendMaloteId },
              {
                onSuccess: () => { setShowDetail(false); Alert.alert("Sucesso", "Malote enviado!"); },
                onError: (e) => Alert.alert("Erro", e.message),
              }
            );
          }
          setConfirmSendMaloteId(null);
        }}
        onCancel={() => setConfirmSendMaloteId(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  title: { fontSize: 22, fontWeight: "700" },
  newBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  card: { borderRadius: 12, padding: 14, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  code: { fontSize: 16, fontWeight: "700" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  route: { fontSize: 13, marginBottom: 4 },
  meta: { fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, marginBottom: 4, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 4 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 10, gap: 4 },
  infoBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, gap: 8 },
  itemCode: { fontSize: 14, fontWeight: "600" },
  itemApp: { fontSize: 12, marginTop: 2 },
  unitOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 0.5 },
});
