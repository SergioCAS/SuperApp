import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db, firebaseBootError } from "../src/config/firebase";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [booting, setBooting] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    if (firebaseBootError) {
      setBooting(false);
      return;
    }

    let userUnsubscribe: (() => void) | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      userUnsubscribe?.();

      if (!user) {
        setHasSession(false);
        setIsApproved(false);
        setBooting(false);
        return;
      }

      setHasSession(true);
      setBooting(true);

      const userRef = doc(db, "users", user.uid);
      userUnsubscribe = onSnapshot(
        userRef,
        (snap) => {
          setIsApproved(!!snap.data()?.approved);
          setBooting(false);
        },
        () => {
          setIsApproved(false);
          setBooting(false);
        }
      );
    });

    return () => {
      authUnsubscribe();
      userUnsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (booting) {
      return;
    }

    const current = segments[0] ?? "";
    const inAuth = current === "auth";
    const inPending = current === "pending";

    if (!hasSession) {
      if (!inAuth) {
        router.replace("/auth");
      }
      return;
    }

    if (!isApproved) {
      if (!inPending) {
        router.replace("/pending");
      }
      return;
    }

    if (inPending) {
      router.replace("/");
    }
  }, [booting, hasSession, isApproved, router, segments]);

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#0f766e" />
          <Text style={styles.text}>Cargando sesión...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (firebaseBootError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>No se pudo iniciar Firebase</Text>
          <Text style={styles.errorText}>{firebaseBootError}</Text>
          <Pressable onPress={() => router.replace("/health")} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Abrir diagnóstico</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: {
          backgroundColor: "#f8fafc"
        },
        headerTintColor: "#0f172a",
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: "#e8eefb"
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f7fafc"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  text: {
    color: "#334155",
    fontWeight: "600"
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#991b1b",
    textAlign: "center"
  },
  errorText: {
    color: "#334155",
    textAlign: "center"
  },
  errorButton: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#0f766e",
    borderRadius: 8
  },
  errorButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
