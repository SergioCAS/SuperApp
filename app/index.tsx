import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Alert,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type UserProfile = {
  role?: "admin" | "member";
};

type CardDef = {
  route: "/list" | "/stores" | "/seasons" | "/reports";
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  subtitle: string;
  bg: string;
  iconBg: string;
  iconColor: string;
  accentBorder: string;
};

const CARDS: CardDef[] = [
  {
    route: "/list",
    icon: "cart-outline",
    title: "Lista",
    subtitle: "Pendientes y surtido",
    bg: "#f0fdf4",
    iconBg: "#10b981",
    iconColor: "#ffffff",
    accentBorder: "#6ee7b7"
  },
  {
    route: "/stores",
    icon: "storefront-outline",
    title: "Tiendas",
    subtitle: "Catálogo de compras",
    bg: "#fffbeb",
    iconBg: "#f59e0b",
    iconColor: "#ffffff",
    accentBorder: "#fcd34d"
  },
  {
    route: "/seasons",
    icon: "calendar-month-outline",
    title: "Épocas",
    subtitle: "Temporadas recurrentes",
    bg: "#fff1f2",
    iconBg: "#f43f5e",
    iconColor: "#ffffff",
    accentBorder: "#fda4af"
  },
  {
    route: "/reports",
    icon: "chart-bar",
    title: "Reportes",
    subtitle: "Pendientes y surtidos",
    bg: "#eef2ff",
    iconBg: "#6366f1",
    iconColor: "#ffffff",
    accentBorder: "#a5b4fc"
  }
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const appVersion = Constants.expoConfig?.version ?? "—";
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const cardWidth = Math.max(140, (windowWidth - 48) / 2);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile?.();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const userRef = doc(db, "users", user.uid);
      unsubscribeProfile = onSnapshot(
        userRef,
        (snap) => {
          const profile = snap.data() as UserProfile | undefined;
          setIsAdmin(profile?.role === "admin");
        },
        () => setIsAdmin(false)
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    Alert.alert(
      "Salir de la app",
      Platform.OS === "android"
        ? "Se cerrará tu sesión y se cerrará la app. ¿Deseas continuar?"
        : "Se cerrará tu sesión. ¿Deseas continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut(auth);
              if (Platform.OS === "android") BackHandler.exitApp();
            } finally {
              setSigningOut(false);
            }
          }
        }
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 16 + insets.top, paddingBottom: 32 + insets.bottom }
        ]}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {/* Decoración superior derecha */}
          <View style={styles.heroDot1} />
          <View style={styles.heroDot2} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>SúperApp</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>v{appVersion}</Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>
            Lista compartida, surtido y control de usuarios.
          </Text>
        </View>

        {/* ── Grid de módulos ── */}
        <View style={styles.grid}>
          {CARDS.map((card) => (
            <Pressable
              key={card.route}
              onPress={() => router.push(card.route)}
              android_ripple={{ color: "rgba(0,0,0,0.07)", borderless: false }}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth, backgroundColor: card.bg, borderColor: card.accentBorder },
                pressed && styles.cardPressed
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: card.iconBg }]}>
                <MaterialCommunityIcons name={card.icon} size={28} color={card.iconColor} />
              </View>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Acciones ── */}
        <View style={styles.actionsBlock}>
          {isAdmin && (
            <Pressable
              onPress={() => router.push("/admin")}
              android_ripple={{ color: "rgba(255,255,255,0.2)" }}
              style={styles.primaryAction}
            >
              <MaterialCommunityIcons name="account-cog-outline" size={20} color="#ffffff" />
              <Text style={styles.primaryActionText}>Administrar usuarios</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/health")}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            style={styles.secondaryAction}
          >
            <MaterialCommunityIcons name="cloud-check-outline" size={20} color="#475569" />
            <Text style={styles.secondaryActionText}>Estado Firebase</Text>
          </Pressable>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            android_ripple={{ color: "rgba(255,255,255,0.2)" }}
            style={[styles.dangerAction, signingOut && styles.disabledAction]}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#ffffff" />
            <Text style={styles.dangerActionText}>{signingOut ? "Saliendo…" : "Salir"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8
  },
  android: { elevation: 4 },
  default: {}
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9"
  },
  container: {
    paddingHorizontal: 16,
    gap: 14
  },

  /* Hero */
  hero: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: "#0f172a",
    overflow: "hidden",
    ...SHADOW
  },
  heroDot1: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#0f766e",
    opacity: 0.35,
    top: -30,
    right: -20
  },
  heroDot2: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#14b8a6",
    opacity: 0.2,
    top: 40,
    right: 55
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#f8fafc",
    flexShrink: 1,
    letterSpacing: -0.5
  },
  versionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)"
  },
  versionText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600"
  },
  heroSubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#94a3b8",
    lineHeight: 22
  },

  /* Grid */
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  card: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    minHeight: 140,
    ...SHADOW
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }]
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: {
    marginTop: 14,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3
  },
  cardSubtitle: {
    marginTop: 3,
    color: "#475569",
    fontSize: 13,
    lineHeight: 18
  },

  /* Acciones */
  actionsBlock: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 12,
    gap: 8,
    ...SHADOW
  },
  primaryAction: {
    borderRadius: 12,
    backgroundColor: "#1d4ed8",
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  primaryActionText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15
  },
  secondaryAction: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#f8fafc"
  },
  secondaryActionText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 15
  },
  dangerAction: {
    borderRadius: 12,
    backgroundColor: "#dc2626",
    paddingVertical: 13,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  dangerActionText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15
  },
  disabledAction: {
    opacity: 0.6
  }
});
