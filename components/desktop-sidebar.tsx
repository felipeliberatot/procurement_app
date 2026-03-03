import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { router, usePathname } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import type { ProcurementRole } from "@/shared/types";
import { ROLE_LABELS } from "@/shared/types";

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: ProcurementRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Início",        icon: "🏠", route: "/(tabs)/" },
  { label: "Solicitações",  icon: "📋", route: "/(tabs)/requests" },
  { label: "Aprovações",    icon: "✅", route: "/(tabs)/approvals" },
  { label: "Malotes",       icon: "📦", route: "/(tabs)/malotes" },
  { label: "Relatório",     icon: "📊", route: "/(tabs)/report" },
  { label: "Cadastros",     icon: "🗂️", route: "/(tabs)/registers" },
  { label: "Perfil",        icon: "👤", route: "/(tabs)/profile" },
];

export function DesktopSidebar() {
  const colors = useColors();
  const pathname = usePathname();
  const { user } = useAuth();

  const userRole = (user as any)?.procurementRole as ProcurementRole ?? "solicitante";

  function isActive(route: string) {
    const normalized = route.replace("/(tabs)", "");
    if (normalized === "/" || normalized === "") {
      return pathname === "/" || pathname === "";
    }
    return pathname.startsWith(normalized);
  }

  return (
    <View
      style={{
        width: 220,
        height: "100%",
        backgroundColor: colors.background,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingTop: 24,
        paddingBottom: 24,
        paddingHorizontal: 12,
        flexShrink: 0,
      }}
    >
      {/* Logo + App Name */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, marginBottom: 28 }}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={{ width: 36, height: 36, borderRadius: 8 }}
          resizeMode="contain"
        />
        <View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground, letterSpacing: -0.3 }}>
            CGS Agrícola
          </Text>
          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 1 }}>Gestão de Compras</Text>
        </View>
      </View>

      {/* Nav Items */}
      <View style={{ flex: 1, gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.route);
          return (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as any)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: active
                  ? `${colors.primary}18`
                  : pressed
                  ? `${colors.primary}08`
                  : "transparent",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16 }}>{item.icon}</Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: active ? "700" : "500",
                  color: active ? colors.primary : colors.foreground,
                  flex: 1,
                }}
              >
                {item.label}
              </Text>
              {active && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* User Info at bottom */}
      {user && (
        <Pressable
          onPress={() => router.push("/(tabs)/profile" as any)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: pressed ? `${colors.primary}08` : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
            marginTop: 8,
          })}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: `${colors.primary}25`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
              {user.name?.charAt(0).toUpperCase() ?? "U"}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}
              numberOfLines={1}
            >
              {user.name}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginTop: 1 }}>
              {ROLE_LABELS[userRole]}
            </Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}
