import { useState } from "react";
import { Stack } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { auth } from "../src/config/firebase";

function toText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "No se pudo cerrar sesión.";
}

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");

  async function handleLogout() {
    setBusy(true);
    setErrorText("");
    try {
      await signOut(auth);
    } catch (error) {
      setErrorText(toText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Pendiente de aprobación" }} />
      <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.title}>Cuenta pendiente de aprobación</Text>
        <Text style={styles.subtitle}>
          Tu cuenta ya fue creada, pero un administrador aún no te ha aprobado para entrar a la
          app.
        </Text>
        <Text style={styles.note}>
          Cuando te aprueben en Firestore (`users/{'{uid}'}.approved = true`), entrarás
          automáticamente.
        </Text>

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
        <Pressable
          onPress={handleLogout}
          disabled={busy}
          style={[styles.button, busy && styles.buttonDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Cerrar sesión</Text>
          )}
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
    color: "#0f172a"
  },
  subtitle: {
    color: "#334155",
    fontSize: 16
  },
  note: {
    color: "#475569",
    fontSize: 15
  },
  error: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  button: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#dc2626"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
