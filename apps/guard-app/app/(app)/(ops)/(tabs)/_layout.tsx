import { Tabs } from "expo-router";
import { Home, Package, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react-native";
import { View } from "react-native";

import { NetworkBanner } from "@/components/Status";
import { colors, typography } from "@/theme/tokens";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <NetworkBanner />
      <Tabs
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.ink, fontWeight: "700" },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: { fontSize: typography.caption, fontWeight: "600" },
          tabBarStyle: { height: 68, paddingBottom: 8, paddingTop: 6 }
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
            tabBarLabel: "Home"
          }}
        />
        <Tabs.Screen
          name="visitors"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => <UsersRound color={color} size={size} />,
            tabBarLabel: "Visitors"
          }}
        />
        <Tabs.Screen
          name="daily-help"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => <UserRoundCheck color={color} size={size} />,
            tabBarLabel: "Daily help"
          }}
        />
        <Tabs.Screen
          name="parcels"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
            tabBarLabel: "Parcels"
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />,
            tabBarLabel: "More"
          }}
        />
      </Tabs>
    </View>
  );
}
