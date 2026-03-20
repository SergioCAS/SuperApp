import { Stack, useRouter } from "expo-router";
import Constants from "expo-constants";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, db, firebaseBootError } from "../src/config/firebase";

export default function HealthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const configured = !!auth && !!db && !firebaseBootError;
  const firestoreReady = !!db;
  const appVersion = Constants.expoConfig?.version ?? "sin versión";

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Estado Firebase" }} />
      <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.title}>Estado del proyecto</Text>

        <View style={styles.card}>
          <Text style={styles.row}>Versión app: {appVersion}</Text>
          <Text style={styles.row}>
            Variables Firebase: {configured ? "OK" : "Pendiente"}
          </Text>
          <Text style={styles.row}>
            Instancia Firestore: {firestoreReady ? "OK" : "Pendiente"}
          </Text>
        </View>

        {!configured ? (
          <Text style={styles.warning}>
            {firebaseBootError ?? "Firebase no se inicializó correctamente."}
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
