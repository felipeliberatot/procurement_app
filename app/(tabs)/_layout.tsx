import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

function DesktopLayout({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
      <DesktopSidebar />
      <View style={{ flex: 1, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useBreakpoint();
  // No Android edge-to-edge, insets.bottom já inclui a altura da barra de navegação.
  // Garantimos um mínimo de 8px e máximo confortável para não sobrepor a gesture bar.
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, Platform.OS === "android" ? 12 : 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: isDesktop
          ? { display: "none" }
          : {
              paddingTop: 8,
              paddingBottom: bottomPadding,
              height: tabBarHeight,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              borderTopWidth: 0.5,
            },
        // Wrap content in desktop layout when on wide screens
        sceneStyle: isDesktop
          ? { flex: 1 }
          : undefined,
      }}
      tabBar={isDesktop ? () => null : undefined}
      layout={isDesktop ? ({ children }) => <DesktopLayout>{children}</DesktopLayout> : undefined}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: "Solicitações",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: "Aprovações",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="checkmark.seal.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="malotes"
        options={{
          title: "Malotes",
          tabBarIcon: ({ color }) => {
            const { isAuthenticated } = useAuth();
            const colors = useColors();
            const { data: malotesList } = trpc.malotes.list.useQuery(undefined, {
              enabled: isAuthenticated,
              refetchInterval: 30000,
            });
            const openCount = (malotesList ?? []).filter((m: any) => m.status === "aberto").length;
            return (
              <View style={{ position: "relative" }}>
                <IconSymbol size={26} name="shippingbox.fill" color={color} />
                {openCount > 0 && (
                  <View style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    backgroundColor: colors.error,
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: "white", fontSize: 10, fontWeight: "700", lineHeight: 14 }}>
                      {openCount > 99 ? "99+" : openCount}
                    </Text>
                  </View>
                )}
              </View>
            );
          },
        }}
      />
      <Tabs.Screen
        name="registers"
        options={{
          title: "Cadastros",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="folder.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
