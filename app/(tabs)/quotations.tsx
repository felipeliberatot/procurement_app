import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuotationItem {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

interface SupplierForm {
  supplierName: string;
  supplierContact: string;
  paymentTerms: string;
  deliveryDays: string;
  observations: string;
  items: QuotationItem[];
}

type ViewMode = "list" | "create" | "detail";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newItem(): QuotationItem {
  return {
    id: String(Date.now() + Math.random()),
    description: "",
    quantity: "1",
    unit: "un",
    unitPrice: "",
    totalPrice: "",
  };
}

function emptySupplier(): SupplierForm {
  return {
    supplierName: "",
    supplierContact: "",
    paymentTerms: "",
    deliveryDays: "",
    observations: "",
    items: [newItem()],
  };
}

function parseValue(v: string): number {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcSupplierTotal(supplier: SupplierForm): number {
  return supplier.items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
    const price = parseValue(item.unitPrice);
    return sum + qty * price;
  }, 0);
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    em_andamento: { bg: "#FEF3C7", text: "#92400E", label: "Em andamento" },
    concluido: { bg: "#D1FAE5", text: "#065F46", label: "Concluído" },
    cancelado: { bg: "#FEE2E2", text: "#991B1B", label: "Cancelado" },
  };
  const s = colors[status] ?? colors.em_andamento;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: s.text, fontSize: 12, fontWeight: "600" }}>{s.label}</Text>
    </View>
  );
}

// ─── Supplier Card (in detail view) ──────────────────────────────────────────

function SupplierCard({
  supplier,
  isLowest,
  isSelected,
  onSelect,
  onUseForRequest,
  groupStatus,
}: {
  supplier: any;
  isLowest: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onUseForRequest: () => void;
  groupStatus: string;
}) {
  const colors = useColors();
  const items: QuotationItem[] = (() => {
    try { return JSON.parse(supplier.items); } catch { return []; }
  })();
  const total = parseFloat(supplier.totalValue) || 0;

  return (
    <View style={{
      borderWidth: isLowest ? 2 : 1,
      borderColor: isLowest ? "#16A34A" : (isSelected ? "#2563EB" : colors.border),
      borderRadius: 12,
      marginBottom: 16,
      backgroundColor: isLowest ? "#F0FDF4" : (isSelected ? "#EFF6FF" : colors.surface),
      overflow: "hidden",
    }}>
      {/* Header */}
      <View style={{ padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
              {supplier.supplierName}
            </Text>
            {isLowest && (
              <View style={{ backgroundColor: "#16A34A", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>✓ MENOR PREÇO</Text>
              </View>
            )}
            {isSelected && !isLowest && (
              <View style={{ backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>SELECIONADO</Text>
              </View>
            )}
          </View>
          {supplier.supplierContact ? (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{supplier.supplierContact}</Text>
          ) : null}
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: isLowest ? "#16A34A" : colors.foreground }}>
          {formatCurrency(total)}
        </Text>
      </View>

      {/* Meta info */}
      {(supplier.paymentTerms || supplier.deliveryDays) ? (
        <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 14, paddingBottom: 10, flexWrap: "wrap" }}>
          {supplier.paymentTerms ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>💳 {supplier.paymentTerms}</Text>
          ) : null}
          {supplier.deliveryDays ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>🚚 {supplier.deliveryDays} dias</Text>
          ) : null}
        </View>
      ) : null}

      {/* Items */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        {items.map((item, idx) => (
          <View key={idx} style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 5,
            borderTopWidth: idx === 0 ? 1 : 0,
            borderTopColor: colors.border,
          }}>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: 13 }} numberOfLines={2}>
              {item.description}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 8 }}>
              {item.quantity} {item.unit} × {formatCurrency(parseValue(item.unitPrice))}
            </Text>
          </View>
        ))}
      </View>

      {/* Observations */}
      {supplier.observations ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontStyle: "italic" }}>
            Obs: {supplier.observations}
          </Text>
        </View>
      ) : null}

      {/* Actions */}
      {groupStatus === "em_andamento" && (
        <View style={{ flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={onSelect}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isSelected ? "#2563EB" : colors.border,
              backgroundColor: isSelected ? "#EFF6FF" : "transparent",
              alignItems: "center",
            }}
          >
            <Text style={{ color: isSelected ? "#2563EB" : colors.muted, fontWeight: "600", fontSize: 14 }}>
              {isSelected ? "✓ Selecionado" : "Selecionar"}
            </Text>
          </TouchableOpacity>
          {isSelected && (
            <TouchableOpacity
              onPress={onUseForRequest}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: "#16A34A",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                Abrir Solicitação →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {groupStatus === "concluido" && isSelected && (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TouchableOpacity
            onPress={onUseForRequest}
            style={{
              paddingVertical: 10,
              borderRadius: 8,
              backgroundColor: "#16A34A",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
              Abrir Solicitação com esta Cotação →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Item Row (in supplier form) ──────────────────────────────────────────────

function ItemRow({
  item,
  onChange,
  onRemove,
  canRemove,
  colors,
}: {
  item: QuotationItem;
  onChange: (field: keyof QuotationItem, value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const qty = parseFloat(item.quantity.replace(",", ".")) || 0;
  const price = parseValue(item.unitPrice);
  const total = qty * price;

  return (
    <View style={{
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      backgroundColor: colors.background,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>Item</Text>
        {canRemove && (
          <TouchableOpacity onPress={onRemove}>
            <Text style={{ color: "#EF4444", fontSize: 13 }}>Remover</Text>
          </TouchableOpacity>
        )}
      </View>
      <TextInput
        value={item.description}
        onChangeText={(v) => onChange("description", v)}
        placeholder="Descrição do item *"
        placeholderTextColor={colors.muted}
        style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: 8,
          padding: 10, color: colors.foreground, fontSize: 14,
          backgroundColor: colors.surface, marginBottom: 8,
        }}
      />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <TextInput
          value={item.quantity}
          onChangeText={(v) => onChange("quantity", v)}
          placeholder="Qtd"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={{
            flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 10, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface,
          }}
        />
        <TextInput
          value={item.unit}
          onChangeText={(v) => onChange("unit", v)}
          placeholder="Un"
          placeholderTextColor={colors.muted}
          style={{
            width: 60, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 10, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface,
          }}
        />
        <TextInput
          value={item.unitPrice}
          onChangeText={(v) => onChange("unitPrice", v)}
          placeholder="Preço unit."
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={{
            flex: 2, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 10, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface,
          }}
        />
      </View>
      {total > 0 && (
        <Text style={{ color: "#16A34A", fontSize: 13, fontWeight: "600", textAlign: "right" }}>
          Subtotal: {formatCurrency(total)}
        </Text>
      )}
    </View>
  );
}

// ─── Supplier Form Section ────────────────────────────────────────────────────

function SupplierFormSection({
  index,
  supplier,
  onChange,
  total,
  colors,
}: {
  index: number;
  supplier: SupplierForm;
  onChange: (updated: SupplierForm) => void;
  total: number;
  colors: ReturnType<typeof useColors>;
}) {
  const updateField = (field: keyof SupplierForm, value: string) => {
    onChange({ ...supplier, [field]: value });
  };

  const updateItem = (itemId: string, field: keyof QuotationItem, value: string) => {
    onChange({
      ...supplier,
      items: supplier.items.map((it) =>
        it.id === itemId ? { ...it, [field]: value } : it
      ),
    });
  };

  const addItem = () => {
    onChange({ ...supplier, items: [...supplier.items, newItem()] });
  };

  const removeItem = (itemId: string) => {
    onChange({ ...supplier, items: supplier.items.filter((it) => it.id !== itemId) });
  };

  return (
    <View style={{
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      marginBottom: 20,
      overflow: "hidden",
    }}>
      {/* Header */}
      <View style={{
        backgroundColor: colors.surface,
        padding: 14,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          Fornecedor {index + 1}
        </Text>
        {total > 0 && (
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#16A34A" }}>
            {formatCurrency(total)}
          </Text>
        )}
      </View>

      <View style={{ padding: 14 }}>
        {/* Supplier name */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
          Nome do Fornecedor *
        </Text>
        <TextInput
          value={supplier.supplierName}
          onChangeText={(v) => updateField("supplierName", v)}
          placeholder="Ex: Distribuidora XYZ"
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 10, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface, marginBottom: 12,
          }}
        />

        {/* Contact & payment */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
              Contato
            </Text>
            <TextInput
              value={supplier.supplierContact}
              onChangeText={(v) => updateField("supplierContact", v)}
              placeholder="Telefone / e-mail"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                padding: 10, color: colors.foreground, fontSize: 14,
                backgroundColor: colors.surface,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
              Prazo (dias)
            </Text>
            <TextInput
              value={supplier.deliveryDays}
              onChangeText={(v) => updateField("deliveryDays", v)}
              placeholder="Ex: 7"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={{
                borderWidth: 1, borderColor: colors.border, borderRadius: 8,
                padding: 10, color: colors.foreground, fontSize: 14,
                backgroundColor: colors.surface,
              }}
            />
          </View>
        </View>

        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
          Condições de Pagamento
        </Text>
        <TextInput
          value={supplier.paymentTerms}
          onChangeText={(v) => updateField("paymentTerms", v)}
          placeholder="Ex: 30 dias, à vista, boleto..."
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 10, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface, marginBottom: 12,
          }}
        />

        {/* Items */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>
          Itens
        </Text>
        {supplier.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            onChange={(field, value) => updateItem(item.id, field, value)}
            onRemove={() => removeItem(item.id)}
            canRemove={supplier.items.length > 1}
            colors={colors}
          />
        ))}
        <TouchableOpacity
          onPress={addItem}
          style={{
            borderWidth: 1, borderColor: colors.primary, borderRadius: 8, borderStyle: "dashed",
            padding: 10, alignItems: "center", marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 14 }}>+ Adicionar Item</Text>
        </TouchableOpacity>

        {/* Observations */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
          Observações
        </Text>
        <TextInput
          value={supplier.observations}
          onChangeText={(v) => updateField("observations", v)}
          placeholder="Observações sobre esta cotação..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={2}
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 10, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface, minHeight: 60, textAlignVertical: "top",
          }}
        />
      </View>
    </View>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateForm({
  onCancel,
  onSuccess,
}: {
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const colors = useColors();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [supplierCount, setSupplierCount] = useState(2);
  const [suppliers, setSuppliers] = useState<SupplierForm[]>([emptySupplier(), emptySupplier()]);

  const { data: costCenters } = trpc.costCenters.list.useQuery();
  const { data: departments } = trpc.departments.list.useQuery();
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedCC, setSelectedCC] = useState("");

  const createMutation = trpc.quotations.create.useMutation({
    onSuccess: () => {
      utils.quotations.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess();
    },
    onError: (err) => {
      Alert.alert("Erro", err.message);
    },
  });

  const totals = suppliers.slice(0, supplierCount).map(calcSupplierTotal);
  const lowestIdx = totals.reduce((minIdx, v, i) => (v > 0 && (totals[minIdx] === 0 || v < totals[minIdx]) ? i : minIdx), 0);

  const handleSupplierCountChange = (count: number) => {
    setSupplierCount(count);
    if (count > suppliers.length) {
      setSuppliers([...suppliers, emptySupplier()]);
    }
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert("Atenção", "Informe o título da cotação.");
      return;
    }
    const activeSups = suppliers.slice(0, supplierCount);
    for (const [i, s] of activeSups.entries()) {
      if (!s.supplierName.trim()) {
        Alert.alert("Atenção", `Informe o nome do Fornecedor ${i + 1}.`);
        return;
      }
      for (const item of s.items) {
        if (!item.description.trim()) {
          Alert.alert("Atenção", `Preencha a descrição de todos os itens do Fornecedor ${i + 1}.`);
          return;
        }
      }
    }

    const suppliersPayload = activeSups.map((s, idx) => {
      const total = calcSupplierTotal(s);
      return {
        supplierName: s.supplierName.trim(),
        supplierContact: s.supplierContact.trim() || undefined,
        paymentTerms: s.paymentTerms.trim() || undefined,
        deliveryDays: s.deliveryDays ? parseInt(s.deliveryDays) : undefined,
        observations: s.observations.trim() || undefined,
        items: s.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          totalPrice: String(
            (parseFloat(it.quantity.replace(",", ".")) || 0) * parseValue(it.unitPrice)
          ),
        })),
        totalValue: String(total),
        position: idx + 1,
      };
    });

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      department: selectedDept || undefined,
      costCenterCode: selectedCC || undefined,
      suppliers: suppliersPayload,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={onCancel} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, flex: 1 }}>
            Nova Cotação
          </Text>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
          Título *
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Compra de fertilizantes — Safra 2026"
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 12, color: colors.foreground, fontSize: 15,
            backgroundColor: colors.surface, marginBottom: 14,
          }}
        />

        {/* Description */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
          Descrição / Finalidade
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descreva o objetivo desta cotação..."
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={2}
          style={{
            borderWidth: 1, borderColor: colors.border, borderRadius: 8,
            padding: 12, color: colors.foreground, fontSize: 14,
            backgroundColor: colors.surface, minHeight: 60,
            textAlignVertical: "top", marginBottom: 14,
          }}
        />

        {/* Department & Cost Center */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
              Departamento
            </Text>
            <View style={{
              borderWidth: 1, borderColor: colors.border, borderRadius: 8,
              backgroundColor: colors.surface, overflow: "hidden",
            }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", padding: 4, gap: 6 }}>
                  {[{ name: "—", code: "" }, ...(departments ?? [])].map((d: any) => (
                    <TouchableOpacity
                      key={d.code}
                      onPress={() => setSelectedDept(d.code)}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                        backgroundColor: selectedDept === d.code ? colors.primary : colors.background,
                      }}
                    >
                      <Text style={{
                        color: selectedDept === d.code ? "white" : colors.foreground,
                        fontSize: 13, fontWeight: "500",
                      }}>
                        {d.name ?? d.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Number of suppliers */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>
          Número de Fornecedores
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          {[1, 2, 3].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => handleSupplierCountChange(n)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center",
                borderWidth: 2,
                borderColor: supplierCount === n ? colors.primary : colors.border,
                backgroundColor: supplierCount === n ? `${colors.primary}15` : colors.surface,
              }}
            >
              <Text style={{
                color: supplierCount === n ? colors.primary : colors.muted,
                fontWeight: "700", fontSize: 18,
              }}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Price comparison preview */}
        {totals.some((t) => t > 0) && (
          <View style={{
            backgroundColor: "#F0FDF4",
            borderWidth: 1,
            borderColor: "#BBF7D0",
            borderRadius: 10,
            padding: 12,
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#166534", marginBottom: 8 }}>
              📊 Comparativo de Preços
            </Text>
            {suppliers.slice(0, supplierCount).map((s, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: "#166534", fontSize: 13 }}>
                  {s.supplierName.trim() || `Fornecedor ${i + 1}`}
                </Text>
                <Text style={{
                  color: i === lowestIdx && totals[i] > 0 ? "#16A34A" : "#166534",
                  fontWeight: i === lowestIdx && totals[i] > 0 ? "700" : "400",
                  fontSize: 13,
                }}>
                  {totals[i] > 0 ? formatCurrency(totals[i]) : "—"}
                  {i === lowestIdx && totals[i] > 0 ? " ✓" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Supplier forms */}
        {suppliers.slice(0, supplierCount).map((s, i) => (
          <SupplierFormSection
            key={i}
            index={i}
            supplier={s}
            onChange={(updated) => {
              const copy = [...suppliers];
              copy[i] = updated;
              setSuppliers(copy);
            }}
            total={totals[i]}
            colors={colors}
          />
        ))}

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            marginTop: 8,
            opacity: createMutation.isPending ? 0.6 : 1,
          }}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              Salvar Cotação
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Detail View ──────────────────────────────────────────────────────────────

function DetailView({
  groupId,
  onBack,
  onOpenRequest,
}: {
  groupId: number;
  onBack: () => void;
  onOpenRequest: (supplierId: number, groupId: number) => void;
}) {
  const colors = useColors();
  const utils = trpc.useUtils();
  const { data: group, isLoading } = trpc.quotations.getById.useQuery({ id: groupId });

  const selectMutation = trpc.quotations.selectSupplier.useMutation({
    onSuccess: () => {
      utils.quotations.getById.invalidate({ id: groupId });
      utils.quotations.list.invalidate();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  const deleteMutation = trpc.quotations.delete.useMutation({
    onSuccess: () => {
      utils.quotations.list.invalidate();
      onBack();
    },
    onError: (err) => Alert.alert("Erro", err.message),
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.muted }}>Cotação não encontrada.</Text>
        <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.primary }}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const suppliers = group.suppliers ?? [];
  const totals = suppliers.map((s: any) => parseFloat(s.totalValue) || 0);
  const lowestIdx = totals.reduce(
    (minIdx: number, v: number, i: number) =>
      v > 0 && (totals[minIdx] === 0 || v < totals[minIdx]) ? i : minIdx,
    0
  );

  const handleDelete = () => {
    Alert.alert(
      "Excluir Cotação",
      "Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ id: groupId }),
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 16 }}>
        <TouchableOpacity onPress={onBack} style={{ marginRight: 12, marginTop: 2 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
            {group.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge status={group.status} />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {formatDate(group.createdAt)}
            </Text>
          </View>
          {group.description ? (
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
              {group.description}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleDelete} style={{ padding: 4 }}>
          <Text style={{ color: "#EF4444", fontSize: 13 }}>Excluir</Text>
        </TouchableOpacity>
      </View>

      {/* Linked request */}
      {group.requestId ? (
        <View style={{
          backgroundColor: "#EFF6FF",
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}>
          <Text style={{ color: "#1D4ED8", fontSize: 13, fontWeight: "600" }}>
            📋 Solicitação vinculada: #{group.requestId}
          </Text>
          <TouchableOpacity onPress={() => router.push(`/request/${group.requestId}` as any)}>
            <Text style={{ color: "#2563EB", fontSize: 13, textDecorationLine: "underline" }}>
              Ver →
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Summary comparison */}
      {suppliers.length > 1 && (
        <View style={{
          backgroundColor: "#F8FAFC",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 14,
          marginBottom: 20,
        }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 10 }}>
            📊 Comparativo de Preços
          </Text>
          {suppliers.map((s: any, i: number) => {
            const total = parseFloat(s.totalValue) || 0;
            const isLow = i === lowestIdx && total > 0;
            const diff = total > 0 && totals[lowestIdx] > 0 && !isLow
              ? total - totals[lowestIdx]
              : 0;
            return (
              <View key={s.id} style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 6,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: isLow ? "700" : "400" }}>
                    {s.supplierName}
                    {isLow ? " ✓" : ""}
                  </Text>
                  {diff > 0 && (
                    <Text style={{ color: "#EF4444", fontSize: 11 }}>
                      +{formatCurrency(diff)} acima do menor
                    </Text>
                  )}
                </View>
                <Text style={{
                  color: isLow ? "#16A34A" : colors.foreground,
                  fontWeight: isLow ? "800" : "600",
                  fontSize: 15,
                }}>
                  {total > 0 ? formatCurrency(total) : "—"}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Supplier cards */}
      {suppliers.map((s: any, i: number) => (
        <SupplierCard
          key={s.id}
          supplier={s}
          isLowest={i === lowestIdx && (parseFloat(s.totalValue) || 0) > 0}
          isSelected={group.selectedSupplierId === s.id}
          groupStatus={group.status}
          onSelect={() => {
            if (group.status !== "em_andamento") return;
            selectMutation.mutate({ groupId: group.id, supplierId: s.id });
          }}
          onUseForRequest={() => onOpenRequest(s.id, group.id)}
        />
      ))}
    </ScrollView>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  onNew,
  onSelect,
}: {
  onNew: () => void;
  onSelect: (id: number) => void;
}) {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { data: groups, isLoading, refetch, isRefetching } = trpc.quotations.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }}>
          Cotações
        </Text>
        <TouchableOpacity
          onPress={onNew}
          style={{
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {(!groups || groups.length === 0) ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📋</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>
            Nenhuma cotação ainda
          </Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginBottom: 24 }}>
            Compare preços de até 3 fornecedores e gere uma solicitação com o melhor preço.
          </Text>
          <TouchableOpacity
            onPress={onNew}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 24,
              paddingVertical: 12,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
              Criar primeira cotação
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item: any) => String(item.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }: { item: any }) => {
            const isCompleted = item.status === "concluido";
            return (
              <TouchableOpacity
                onPress={() => onSelect(item.id)}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 6 }} numberOfLines={1}>
                        {item.description}
                      </Text>
                    ) : null}
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {formatDate(item.createdAt)} · {item.createdByName}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>
                {item.requestId ? (
                  <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={{ color: "#2563EB", fontSize: 12 }}>
                      📋 Solicitação #{item.requestId} vinculada
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function QuotationsScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [view, setView] = useState<ViewMode>("list");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Pending request creation from quotation
  const [pendingQuotation, setPendingQuotation] = useState<{
    supplierId: number;
    groupId: number;
  } | null>(null);

  const linkMutation = trpc.quotations.linkToRequest.useMutation({
    onSuccess: () => utils.quotations.list.invalidate(),
  });

  const handleOpenRequest = useCallback((supplierId: number, groupId: number) => {
    // Navigate to new request with quotation params
    router.push({
      pathname: "/request/new" as any,
      params: {
        fromQuotationGroupId: String(groupId),
        fromQuotationSupplierId: String(supplierId),
      },
    });
  }, []);

  return (
    <ScreenContainer>
      {view === "list" && (
        <ListView
          onNew={() => setView("create")}
          onSelect={(id) => {
            setSelectedGroupId(id);
            setView("detail");
          }}
        />
      )}
      {view === "create" && (
        <CreateForm
          onCancel={() => setView("list")}
          onSuccess={() => setView("list")}
        />
      )}
      {view === "detail" && selectedGroupId !== null && (
        <DetailView
          groupId={selectedGroupId}
          onBack={() => setView("list")}
          onOpenRequest={handleOpenRequest}
        />
      )}
    </ScreenContainer>
  );
}
