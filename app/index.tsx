import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type UserProfile = {
  role?: "admin" | "member";
};

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [isAdmin, setIsAdmin] = useState(false);
  const contentHorizontalPadding = 36;
  const gridGap = 10;
  const isSingleColumn = windowWidth < 320;
  const cardWidth = isSingleColumn
    ? windowWidth - contentHorizontalPadding
    : Math.max(140, (windowWidth - contentHorizontalPadding - gridGap) / 2);

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
        () => {
          setIsAdmin(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: 16 + insets.top, paddingBottom: 28 + insets.bottom }
        ]}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MVP FAMILIAR</Text>
          <Text style={styles.title}>Super App</Text>
          <Text style={styles.subtitle}>
            Lista compartida, surtido y control de usuarios desde una sola pantalla.
          </Text>
        </View>

        <View style={styles.grid}>
          <Pressable
            onPress={() => router.push("/list")}
            style={[styles.card, { width: cardWidth }, styles.cardEmerald]}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="cart-outline" size={26} color="#064e3b" />
            </View>
            <Text style={styles.cardTitle}>Lista</Text>
            <Text style={styles.cardSubtitle}>Pendientes y surtido</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/auth")}
            style={[styles.card, { width: cardWidth }, styles.cardSky]}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="account-key-outline" size={26} color="#0c4a6e" />
            </View>
            <Text style={styles.cardTitle}>Acceso</Text>
            <Text style={styles.cardSubtitle}>Registro y login</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/stores")}
            style={[styles.card, { width: cardWidth }, styles.cardAmber]}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="storefront-outline" size={26} color="#78350f" />
            </View>
            <Text style={styles.cardTitle}>Tiendas</Text>
            <Text style={styles.cardSubtitle}>Catálogo de compras</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/seasons")}
            style={[styles.card, { width: cardWidth }, styles.cardRose]}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="calendar-month-outline" size={26} color="#881337" />
            </View>
            <Text style={styles.cardTitle}>Épocas</Text>
            <Text style={styles.cardSubtitle}>Temporadas recurrentes</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/reports")}
            style={[styles.card, { width: cardWidth }, styles.cardIndigo]}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name="chart-bar" size={26} color="#312e81" />
            </View>
            <Text style={styles.cardTitle}>Reportes</Text>
            <Text style={styles.cardSubtitle}>Pendientes y surtidos</Text>
          </Pressable>
        </View>

        <View style={styles.actionsBlock}>
          {isAdmin ? (
            <Pressable onPress={() => router.push("/admin")} style={styles.primaryAction}>
              <MaterialCommunityIcons name="account-cog-outline" size={20} color="#ffffff" />
              <Text style={styles.primaryActionText}>Administrar usuarios</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push("/health")} style={styles.secondaryAction}>
            <MaterialCommunityIcons name="cloud-check-outline" size={20} color="#334155" />
            <Text style={styles.secondaryActionText}>Estado Firebase</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef3ff"
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 28
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: "#0f172a"
  },
  eyebrow: {
    color: "#93c5fd",
    fontWeight: "700",
    letterSpacing: 1,
    fontSize: 11
  },
  title: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: "800",
    color: "#f8fafc"
  },
  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: "#cbd5e1"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  card: {
    marginBottom: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbe1ef",
    minHeight: 132
  },
  cardEmerald: {
    backgroundColor: "#ecfdf5"
  },
  cardSky: {
    backgroundColor: "#f0f9ff"
  },
  cardAmber: {
    backgroundColor: "#fffbeb"
  },
  cardRose: {
    backgroundColor: "#fff1f2"
  },
  cardIndigo: {
    backgroundColor: "#eef2ff"
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: {
    marginTop: 12,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800"
  },
  cardSubtitle: {
    marginTop: 2,
    color: "#334155",
    fontSize: 13
  },
  actionsBlock: {
    marginTop: 2,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#dbe1ef"
  },
  primaryAction: {
    borderRadius: 10,
    backgroundColor: "#1d4ed8",
    paddingVertical: 11,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  primaryActionText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryAction: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 11,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  secondaryActionText: {
    color: "#334155",
    fontWeight: "700"
  }
});
