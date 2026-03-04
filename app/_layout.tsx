import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [booting, setBooting] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
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

    if (inAuth || inPending) {
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
  }
});
