import React, { useMemo, useState } from "react";
import { ConfirmModal } from "@/components/confirm-modal";
import { useAuth } from "@/hooks/use-auth";
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

type OcItem = {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice?: string | null;
  totalPrice?: string | null;
};
type MaloteItem = {
  id: number;
  requestCode: string;
  requesterName: string;
  application: string;
  sentStatus: string;
  receiptStatus: string;
  ocItems?: OcItem[];
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
  const { user } = useAuth();
  const isMaster = (user as any)?.approvalLevel === "master";
  const userRole = (user as any)?.procurementRole as string ?? "";
  const parseJsonArr = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  };
  const allRoles: string[] = [
    userRole,
    ...parseJsonArr((user as any)?.extraRoles),
    ...((user as any)?.approvalLevel && !['nenhum','master'].includes((user as any)?.approvalLevel) ? [(user as any).approvalLevel] : []),
    ...parseJsonArr((user as any)?.extraApprovalLevels).filter((l: string) => !['nenhum','master'].includes(l)),
  ];
  const isOrcamento = allRoles.includes("orcamento");
  // master pode editar e excluir; orcamento pode apenas editar
  const canEdit = isMaster || isOrcamento;
  const canDelete = isMaster;

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
  const sendPartialMutation = trpc.malotes.sendPartial.useMutation({
    onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.getById.invalidate(); },
  });
  const updateMutation = trpc.malotes.update.useMutation({
    onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.getById.invalidate(); },
  });
  const deleteMutation = trpc.malotes.delete.useMutation({
    onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.stats.invalidate(); },
  });
  const addRemessaMutation = trpc.malotes.addRemessaManual.useMutation({
    onSuccess: () => {
      setShowRemessa(false);
      setRemessaDesc("");
      setRemessaQty("");
      setRemessaObs("");
      if (selectedMalote) utils.malotes.getById.invalidate({ id: selectedMalote.id });
      utils.malotes.list.invalidate();
    },
    onError: (e) => Alert.alert("Erro", e.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [originUnit, setOriginUnit] = useState("");
  const [destinationUnit, setDestinationUnit] = useState("");
  const [newMaloteNotes, setNewMaloteNotes] = useState("");
  const [selectedMalote, setSelectedMalote] = useState<Malote | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAddRequest, setShowAddRequest] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [showRemessa, setShowRemessa] = useState(false);
  const [remessaDesc, setRemessaDesc] = useState("");
  const [remessaQty, setRemessaQty] = useState("");
  const [remessaObs, setRemessaObs] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterUnit, setFilterUnit] = useState<string>("todas");
  const [showUnitPicker, setShowUnitPicker] = useState<"filter" | null>(null);
  const [confirmSendMaloteId, setConfirmSendMaloteId] = useState<number | null>(null);
  const [confirmDeleteMaloteId, setConfirmDeleteMaloteId] = useState<number | null>(null);
  const [partialSendMode, setPartialSendMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [showEdit, setShowEdit] = useState(false);
  const [editOriginUnit, setEditOriginUnit] = useState("");
  const [editDestinationUnit, setEditDestinationUnit] = useState("");
  const [editNotes, setEditNotes] = useState("");

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

  const handleOpenEdit = (item: Malote) => {
    setSelectedMalote(item);
    setEditOriginUnit(item.originUnit);
    setEditDestinationUnit(item.destinationUnit);
    setEditNotes(item.notes ?? "");
    setShowEdit(true);
  };

  const handleEdit = () => {
    if (!selectedMalote) return;
    if (!editOriginUnit.trim() || !editDestinationUnit.trim()) {
      Alert.alert("Atenção", "Selecione a unidade de origem e destino.");
      return;
    }
    if (editOriginUnit === editDestinationUnit) {
      Alert.alert("Atenção", "Origem e destino não podem ser iguais.");
      return;
    }
    updateMutation.mutate(
      { id: selectedMalote.id, originUnit: editOriginUnit, destinationUnit: editDestinationUnit, notes: editNotes.trim() || null },
      {
        onSuccess: () => {
          setShowEdit(false);
          Alert.alert("Sucesso", "Malote atualizado!");
        },
        onError: (e) => Alert.alert("Erro", e.message),
      }
    );
  };

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
      {/* Botões de ação rápida — visíveis por papel */}
      {(canEdit || canDelete) && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {canEdit && item.status === "aberto" && (
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary + "18", borderWidth: 1, borderColor: colors.primary + "44" }}
              onPress={() => handleOpenEdit(item)}
              activeOpacity={0.7}
            >
              <IconSymbol name="pencil" size={14} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Editar</Text>
            </TouchableOpacity>
          )}
          {canDelete && item.status !== "enviado" && (
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#EF444418", borderWidth: 1, borderColor: "#EF444444" }}
              onPress={() => { setSelectedMalote(item); setConfirmDeleteMaloteId(item.id); }}
              activeOpacity={0.7}
            >
              <IconSymbol name="trash.fill" size={14} color="#EF4444" />
              <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "600" }}>Excluir</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TouchableOpacity onPress={() => setShowRemessa(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} activeOpacity={0.7}>
                      <Text style={{ fontSize: 14 }}>📦</Text>
                      <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600" }}>Remessa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowAddRequest(true)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} activeOpacity={0.7}>
                      <IconSymbol name="plus" size={16} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}>Adicionar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {maloteDetail?.items && maloteDetail.items.length > 0 ? (
                maloteDetail.items.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const alreadySent = item.sentStatus === "enviado";
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={partialSendMode && !alreadySent ? 0.7 : 1}
                      onPress={() => {
                        if (!partialSendMode || alreadySent) return;
                        setSelectedItemIds(prev => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          return next;
                        });
                      }}
                      style={[
                        { borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: 10 },
                        partialSendMode && !alreadySent && { backgroundColor: isSelected ? "#F59E0B15" : "transparent" },
                        alreadySent && { opacity: 0.55 },
                      ]}
                    >
                      {/* Cabeçalho da solicitação */}
                      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                        {/* Checkbox de seleção no modo parcial */}
                        {partialSendMode && (
                          <View style={{
                            width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                            borderColor: alreadySent ? colors.muted : isSelected ? "#F59E0B" : colors.border,
                            backgroundColor: alreadySent ? colors.border : isSelected ? "#F59E0B" : "transparent",
                            alignItems: "center", justifyContent: "center", marginTop: 2,
                          }}>
                            {(isSelected || alreadySent) && <Text style={{ color: "white", fontSize: 13, fontWeight: "700", lineHeight: 16 }}>✓</Text>}
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={[styles.itemCode, { color: (item as any).isRemessaManual ? colors.warning : colors.foreground }]}>
                              {(item as any).isRemessaManual ? "📦 Remessa Manual" : item.requestCode}
                            </Text>
                            {(item as any).isRemessaManual && (
                              <View style={{ backgroundColor: `${colors.warning}20`, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 9, fontWeight: "800", color: colors.warning }}>REMESSA</Text>
                              </View>
                            )}
                            {alreadySent && (
                              <View style={{ backgroundColor: "#F59E0B20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                <Text style={{ fontSize: 9, fontWeight: "800", color: "#F59E0B" }}>ENVIADO</Text>
                              </View>
                            )}
                          </View>
                          {(item as any).isRemessaManual ? (
                            <View style={{ marginTop: 2 }}>
                              <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "500" }}>{(item as any).remessaDescription}</Text>
                              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>Qtd: {(item as any).remessaQty}</Text>
                              {(item as any).remessaObservations ? (
                                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1, fontStyle: "italic" }}>{(item as any).remessaObservations}</Text>
                              ) : null}
                            </View>
                          ) : (
                            <>
                              <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={2}>{item.application}</Text>
                              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>Solicitante: {item.requesterName}</Text>
                            </>
                          )}
                        </View>
                        {selectedMalote?.status === "aberto" && !partialSendMode && (
                          <TouchableOpacity onPress={() => handleRemoveItem(item.id)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <IconSymbol name="trash.fill" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                      {/* Itens da OC — apenas comprados visíveis, pendentes com aviso */}
                      {item.ocItems && item.ocItems.length > 0 && (() => {
                        const boughtItems = item.ocItems.filter((oc: any) => oc.itemStatus === "comprado" || oc.itemStatus === "autorizado" || oc.itemStatus === "aprovado" || !oc.itemStatus);
                        const pendingItems = item.ocItems.filter((oc: any) => oc.itemStatus === "pendente" || oc.itemStatus === "parcial");
                        const hasPartial = pendingItems.length > 0;
                        if (boughtItems.length === 0 && !hasPartial) return null;
                        return (
                          <View style={{ marginTop: 8, backgroundColor: colors.background, borderRadius: 8, padding: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Itens da Ordem de Compra</Text>
                              {hasPartial && (
                                <View style={{ backgroundColor: "#F59E0B20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#F59E0B" }}>PARCIAL — {pendingItems.length} pendente(s)</Text>
                                </View>
                              )}
                            </View>
                            {boughtItems.map((oc: any, idx: number) => (
                              <View key={oc.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, borderTopWidth: idx > 0 ? 0.5 : 0, borderTopColor: colors.border }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "500" }}>{oc.description}</Text>
                                  <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
                                    {parseFloat(oc.quantity || "0").toLocaleString("pt-BR")} {oc.unit}
                                    {oc.unitPrice ? ` · R$ ${parseFloat(oc.unitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} un.` : ""}
                                  </Text>
                                </View>
                                {oc.totalPrice ? (
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
                                    R$ {parseFloat(oc.totalPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                  </Text>
                                ) : null}
                              </View>
                            ))}
                            {hasPartial && (
                              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                                <Text style={{ fontSize: 10, color: "#F59E0B", fontStyle: "italic" }}>
                                  ⚠️ {pendingItems.map((p: any) => p.description).join(", ")} — aguardando recompra
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })()}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: 13, marginVertical: 12 }]}>
                  Nenhuma solicitação adicionada
                </Text>
              )}

              {/* Botões de ação */}
              {selectedMalote?.status === "aberto" && !partialSendMode && (
                <View style={{ gap: 10, marginTop: 20 }}>
                  {/* Enviar Tudo */}
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: "#F59E0B", justifyContent: "center", paddingVertical: 14 }]}
                    onPress={() => handleSend(selectedMalote.id)}
                    activeOpacity={0.8}
                  >
                    <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 14 }}>Enviar Malote Completo</Text>
                  </TouchableOpacity>
                  {/* Envio Parcial */}
                  {(maloteDetail?.items ?? []).length >= 1 && (() => {
                    // Verificar se há solicitações parciais ou mais de 1 item
                    const hasPartialRequests = (maloteDetail?.items ?? []).some(
                      (it: any) => it.ocItems?.some((oc: any) => oc.itemStatus === "pendente" || oc.itemStatus === "parcial")
                    );
                    const showPartialBtn = (maloteDetail?.items ?? []).length > 1 || hasPartialRequests;
                    if (!showPartialBtn) return null;
                    return (
                      <TouchableOpacity
                        style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "#F59E0B", justifyContent: "center", paddingVertical: 14 }]}
                        onPress={() => {
                          setPartialSendMode(true);
                          // Pré-selecionar apenas itens cujos ocItems são todos comprados (ou sem itens pendentes)
                          const preSelected = new Set<number>();
                          (maloteDetail?.items ?? []).forEach((it: any) => {
                            if (it.sentStatus === "enviado") return; // já enviado
                            const hasPending = it.ocItems?.some((oc: any) => oc.itemStatus === "pendente" || oc.itemStatus === "parcial");
                            if (!hasPending) preSelected.add(it.id); // só pré-seleciona se não tem pendentes
                          });
                          setSelectedItemIds(preSelected);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 16 }}>📦</Text>
                        <Text style={{ color: "#F59E0B", fontWeight: "700", marginLeft: 6, fontSize: 14 }}>
                          {hasPartialRequests ? "Envio Parcial (itens comprados pré-selecionados)" : "Envio Parcial (selecionar itens)"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>
              )}
              {/* Barra de confirmação do envio parcial */}
              {selectedMalote?.status === "aberto" && partialSendMode && (
                <View style={{ marginTop: 20, gap: 8 }}>
                  <View style={{ backgroundColor: "#F59E0B15", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#F59E0B40" }}>
                    <Text style={{ fontSize: 13, color: "#92400E", fontWeight: "600", textAlign: "center" }}>
                      {selectedItemIds.size === 0
                        ? "Toque nas solicitações acima para selecioná-las"
                        : `${selectedItemIds.size} item(s) selecionado(s) para envio`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.btn, {
                      backgroundColor: selectedItemIds.size > 0 ? "#F59E0B" : colors.border,
                      justifyContent: "center", paddingVertical: 14,
                    }]}
                    disabled={selectedItemIds.size === 0 || sendPartialMutation.isPending}
                    onPress={() => {
                      if (!selectedMalote || selectedItemIds.size === 0) return;
                      sendPartialMutation.mutate(
                        { maloteId: selectedMalote.id, itemIds: Array.from(selectedItemIds) },
                        {
                          onSuccess: (res) => {
                            setPartialSendMode(false);
                            setSelectedItemIds(new Set());
                            if (res.remainingCount === 0) {
                              Alert.alert("Enviado!", "Todos os itens foram enviados. Malote marcado como enviado.");
                            } else {
                              Alert.alert("Envio Parcial", `${res.sentCount} item(s) enviado(s). ${res.remainingCount} item(s) ainda pendente(s) no malote.`);
                            }
                          },
                          onError: (e) => Alert.alert("Erro", e.message),
                        }
                      );
                    }}
                    activeOpacity={0.8}
                  >
                    <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6, fontSize: 14 }}>
                      {sendPartialMutation.isPending ? "Enviando..." : `Confirmar Envio (${selectedItemIds.size})`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, justifyContent: "center", paddingVertical: 12 }]}
                    onPress={() => { setPartialSendMode(false); setSelectedItemIds(new Set()); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
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
                    const itensHtml = (malote.items ?? []).map((item: MaloteItem, idx: number) => {
                      const ocItemsHtml = item.ocItems && item.ocItems.length > 0
                        ? `<tr><td colspan="4" style="padding:0;">
                            <table style="width:100%;border-collapse:collapse;background:#f0fdf4;">
                              <thead><tr>
                                <th style="padding:5px 10px 5px 24px;font-size:10px;color:#166534;background:#dcfce7;text-align:left;font-weight:700;">Item</th>
                                <th style="padding:5px 8px;font-size:10px;color:#166534;background:#dcfce7;text-align:center;font-weight:700;">Qtd</th>
                                <th style="padding:5px 8px;font-size:10px;color:#166534;background:#dcfce7;text-align:center;font-weight:700;">Un.</th>
                                <th style="padding:5px 10px;font-size:10px;color:#166534;background:#dcfce7;text-align:right;font-weight:700;">Vlr Unit.</th>
                              </tr></thead>
                              <tbody>${item.ocItems.map((oc: OcItem, oi: number) => `
                                <tr style="background:${oi % 2 === 0 ? '#f0fdf4' : '#fff'}">
                                  <td style="padding:5px 10px 5px 24px;font-size:11px;border-bottom:1px solid #d1fae5;">${oc.description}</td>
                                  <td style="padding:5px 8px;font-size:11px;border-bottom:1px solid #d1fae5;text-align:center;">${Number(oc.quantity).toLocaleString('pt-BR')}</td>
                                  <td style="padding:5px 8px;font-size:11px;border-bottom:1px solid #d1fae5;text-align:center;">${oc.unit ?? '—'}</td>
                                  <td style="padding:5px 10px;font-size:11px;border-bottom:1px solid #d1fae5;text-align:right;">${oc.unitPrice ? 'R$ ' + Number(oc.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                                </tr>
                              `).join('')}</tbody>
                            </table>
                          </td></tr>`
                        : '';
                      return `
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
                      ${ocItemsHtml}
                    `;
                    }).join("");
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

      {/* ─── Modal: Remessa Manual ─── */}
      <Modal visible={showRemessa} transparent animationType="slide" onRequestClose={() => setShowRemessa(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>📦 Nova Remessa Manual</Text>
              <TouchableOpacity onPress={() => setShowRemessa(false)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 14, lineHeight: 18 }}>
              Adicione um item físico ao malote sem vínculo com uma solicitação de compra.
            </Text>
            {/* Descrição */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>
              Descrição <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              value={remessaDesc}
              onChangeText={setRemessaDesc}
              placeholder="Ex: Peça de reposición do trator, documento fiscal..."
              placeholderTextColor={colors.muted}
              style={{ borderWidth: 1.5, borderColor: remessaDesc.trim() ? colors.primary : colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.background, marginBottom: 12 }}
              returnKeyType="next"
            />
            {/* Quantidade */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>
              Quantidade <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              value={remessaQty}
              onChangeText={setRemessaQty}
              placeholder="Ex: 1 peça, 2 caixas, 1 envelope..."
              placeholderTextColor={colors.muted}
              style={{ borderWidth: 1.5, borderColor: remessaQty.trim() ? colors.primary : colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.background, marginBottom: 12 }}
              returnKeyType="next"
            />
            {/* Observações */}
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, marginBottom: 6 }}>
              Observações <Text style={{ color: colors.muted, fontWeight: "400" }}>(opcional)</Text>
            </Text>
            <TextInput
              value={remessaObs}
              onChangeText={setRemessaObs}
              placeholder="Informações adicionais..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.foreground, backgroundColor: colors.background, marginBottom: 16, minHeight: 72, textAlignVertical: "top" }}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => {
                if (!remessaDesc.trim()) return Alert.alert("Atenção", "Informe a descrição do item.");
                if (!remessaQty.trim()) return Alert.alert("Atenção", "Informe a quantidade.");
                if (!selectedMalote) return;
                addRemessaMutation.mutate({
                  maloteId: selectedMalote.id,
                  description: remessaDesc.trim(),
                  qty: remessaQty.trim(),
                  observations: remessaObs.trim() || undefined,
                });
              }}
              disabled={addRemessaMutation.isPending}
              style={{ backgroundColor: remessaDesc.trim() && remessaQty.trim() ? colors.warning : colors.border, borderRadius: 12, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: addRemessaMutation.isPending ? 0.7 : 1 }}
            >
              {addRemessaMutation.isPending
                ? <ActivityIndicator color="white" />
                : <><Text style={{ fontSize: 16 }}>📦</Text><Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Adicionar Remessa</Text></>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Modal: Adicionar Solicitação ─── */}
      <Modal visible={showAddRequest} transparent animationType="slide" onRequestClose={() => { setShowAddRequest(false); setAddSearchQuery(""); }}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface, maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Solicitação</Text>
              <TouchableOpacity onPress={() => { setShowAddRequest(false); setAddSearchQuery(""); }}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            {/* Campo de busca */}
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: colors.border }}>
              <IconSymbol name="magnifyingglass" size={16} color={colors.muted} />
              <TextInput
                style={{ flex: 1, marginLeft: 8, fontSize: 14, color: colors.foreground }}
                placeholder="Buscar por número, descrição ou departamento..."
                placeholderTextColor={colors.muted}
                value={addSearchQuery}
                onChangeText={setAddSearchQuery}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {addSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setAddSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <IconSymbol name="xmark" size={14} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.meta, { color: colors.muted, marginBottom: 6 }]}>
              {addSearchQuery ? `${readyRequests.filter((r: any) => {
                const q = addSearchQuery.toLowerCase();
                return r.requestNumber?.toLowerCase().includes(q) || r.application?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q) || r.requesterName?.toLowerCase().includes(q);
              }).length} resultado(s)` : `${readyRequests.length} solicitação(s) disponível(is)`}
            </Text>
            <FlatList
              data={readyRequests.filter((r: any) => {
                if (!addSearchQuery) return true;
                const q = addSearchQuery.toLowerCase();
                return r.requestNumber?.toLowerCase().includes(q) || r.application?.toLowerCase().includes(q) || r.department?.toLowerCase().includes(q) || r.requesterName?.toLowerCase().includes(q);
              })}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item }) => {
                const isPartial = (item as any).status === "parcialmente_concluida";
                return (
                  <TouchableOpacity style={[styles.itemRow, { borderBottomColor: colors.border }]} onPress={() => { handleAddRequest(item); setAddSearchQuery(""); }} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={[styles.itemCode, { color: colors.foreground }]}>{item.requestNumber}</Text>
                        {isPartial && (
                          <View style={{ backgroundColor: "#F59E0B20", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ fontSize: 9, fontWeight: "800", color: "#F59E0B" }}>PARCIAL</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.itemApp, { color: colors.muted }]} numberOfLines={1}>{item.application} · {item.department}</Text>
                      {item.requesterName ? <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>👤 {item.requesterName}</Text> : null}
                      {isPartial && (
                        <Text style={{ fontSize: 10, color: "#F59E0B", marginTop: 2 }}>Alguns itens ainda pendentes de recompra</Text>
                      )}
                    </View>
                    <IconSymbol name="plus" size={20} color={colors.primary} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.muted, fontSize: 13 }]}>
                  {addSearchQuery ? "Nenhuma solicitação encontrada para esta busca" : "Nenhuma solicitação disponível para malote"}
                </Text>
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
          const id = confirmSendMaloteId;
          setConfirmSendMaloteId(null);
          if (id !== null) {
            sendMutation.mutate(
              { maloteId: id },
              {
                onSuccess: () => { utils.malotes.list.invalidate(); utils.malotes.stats.invalidate(); Alert.alert("Sucesso", "Malote enviado!"); },
                onError: (e) => Alert.alert("Erro", e.message),
              }
            );
          }
        }}
        onCancel={() => setConfirmSendMaloteId(null)}
      />

      {/* ConfirmModal: Excluir Malote */}
      <ConfirmModal
        visible={confirmDeleteMaloteId !== null}
        title="Excluir Malote"
        message={`Tem certeza que deseja excluir o malote ${selectedMalote?.maloteCode}? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        confirmDestructive
        onConfirm={() => {
          if (confirmDeleteMaloteId !== null) {
            deleteMutation.mutate(
              { id: confirmDeleteMaloteId },
              {
                onSuccess: () => {
                  setConfirmDeleteMaloteId(null);
                  setShowDetail(false);
                  setSelectedMalote(null);
                  Alert.alert("Excluído", "Malote excluído com sucesso.");
                },
                onError: (e) => {
                  setConfirmDeleteMaloteId(null);
                  Alert.alert("Erro", e.message);
                },
              }
            );
          }
        }}
        onCancel={() => setConfirmDeleteMaloteId(null)}
      />

      {/* Modal: Editar Malote */}
      <Modal visible={showEdit} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.overlay}>
            <View style={[styles.modal, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Editar Malote</Text>
                <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <IconSymbol name="xmark" size={22} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true} contentContainerStyle={{ paddingBottom: 8 }}>
                <UnitSelector
                  label="Unidade de Origem *"
                  value={editOriginUnit}
                  units={unitEntries}
                  onChange={setEditOriginUnit}
                  colors={colors}
                />
                <UnitSelector
                  label="Unidade de Destino *"
                  value={editDestinationUnit}
                  units={unitEntries}
                  onChange={setEditDestinationUnit}
                  colors={colors}
                />
                <Text style={[styles.label, { color: colors.muted }]}>Observações</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground, height: 80, textAlignVertical: "top" }]}
                  placeholder="Informações adicionais..."
                  placeholderTextColor={colors.muted}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
                <View style={[styles.row, { marginTop: 20 }]}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={() => setShowEdit(false)}>
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleEdit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={{ color: "#fff", fontWeight: "600" }}>Salvar</Text>
                    }
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
