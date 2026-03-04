import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../src/config/firebase";

function isConfigured() {
  const extras = Constants.expoConfig?.extra ?? {};
  const publicVars = [
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID
  ];
  const fromExtra = Object.values(extras).some(Boolean);
  return publicVars.every(Boolean) || fromExtra;
}

export default function HealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const configured = isConfigured();
  const firestoreReady = !!db;

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Estado Firebase" }} />
      <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.title}>Estado del proyecto</Text>

        <View style={styles.card}>
          <Text style={styles.row}>
            Variables Firebase: {configured ? "OK" : "Pendiente"}
          </Text>
          <Text style={styles.row}>
            Instancia Firestore: {firestoreReady ? "OK" : "Pendiente"}
          </Text>
        </View>

        {!configured ? (
          <Text style={styles.warning}>
            Completa `mobile/.env` con las credenciales de Firebase.
          </Text>
        ) : null}

        <Pressable onPress={() => router.push("/")} style={styles.linkButton}>
          <Text style={styles.link}>Volver al inicio</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f7fafc"
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827"
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8
  },
  row: {
    color: "#1f2937",
    fontWeight: "500"
  },
  warning: {
    color: "#b45309"
  },
  link: {
    color: "#0f766e",
    fontWeight: "600"
  },
  linkButton: {
    alignSelf: "flex-start"
  }
});
