import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type AuthMode = "login" | "register";

function normalizeFirebaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Ocurrió un error inesperado.";
  }

  if (error.message.includes("auth/invalid-credential")) {
    return "Correo o contraseña incorrectos.";
  }
  if (error.message.includes("auth/email-already-in-use")) {
    return "Ese correo ya está registrado.";
  }
  if (error.message.includes("auth/invalid-email")) {
    return "Correo no válido.";
  }
  if (error.message.includes("auth/weak-password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (error.message.includes("auth/too-many-requests")) {
    return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  }
  if (error.message.includes("auth/operation-not-allowed")) {
    return "El proveedor Email/Password no está habilitado en Firebase Auth.";
  }

  return error.message;
}

async function ensureUserDoc(user: User, displayNameInput?: string) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return;
  }

  const profileName =
    (displayNameInput ?? "").trim() || user.displayName || user.email?.split("@")[0] || "Usuario";

  await setDoc(userRef, {
    uid: user.uid,
    email: user.email ?? "",
    displayName: profileName,
    role: "member",
    approved: false,
    createdAt: serverTimestamp()
  });
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(auth.currentUser?.email ?? null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentEmail(user?.email ?? null);
    });
    return unsubscribe;
  }, []);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password.trim()) {
      return false;
    }
    if (mode === "register" && !displayName.trim()) {
      return false;
    }
    return true;
  }, [displayName, email, mode, password]);

  async function handleAuth() {
    setBusy(true);
    setErrorText("");
    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password.trim()
        );
        await ensureUserDoc(credential.user, displayName);
      } else {
        const credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password.trim()
        );
        await ensureUserDoc(credential.user);
      }
      setPassword("");
    } catch (error) {
      setErrorText(normalizeFirebaseError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setErrorText("");
    try {
      await signOut(auth);
    } catch (error) {
      setErrorText(normalizeFirebaseError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Autenticación" }} />
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
        <Text style={styles.title}>Autenticación</Text>
        <Text style={styles.subtitle}>Módulo 1: registro/login con Firebase Auth</Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode("login")}
            style={[styles.modeButton, mode === "login" && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === "login" && styles.modeTextActive]}>
              Iniciar sesión
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("register")}
            style={[styles.modeButton, mode === "register" && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === "register" && styles.modeTextActive]}>
              Registrarme
            </Text>
          </Pressable>
        </View>

        {mode === "register" ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput
              placeholder="Tu nombre"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              style={styles.input}
            />
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Correo</Text>
          <TextInput
            placeholder="correo@ejemplo.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            placeholder="******"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <Pressable
          onPress={handleAuth}
          disabled={!canSubmit || busy}
          style={[styles.submitButton, (!canSubmit || busy) && styles.submitButtonDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitText}>
              {mode === "register" ? "Crear cuenta" : "Entrar"}
            </Text>
          )}
        </Pressable>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Sesión actual</Text>
          <Text style={styles.statusText}>
            {currentEmail ? `Conectado: ${currentEmail}` : "No hay sesión iniciada"}
          </Text>
          <Pressable
            onPress={handleLogout}
            disabled={!currentEmail || busy}
            style={[styles.logoutButton, (!currentEmail || busy) && styles.logoutButtonDisabled]}
          >
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f7fafc"
  },
  container: {
    padding: 16,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 16,
    color: "#334155"
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  modeButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#94a3b8",
    paddingVertical: 10,
    paddingHorizontal: 14
  },
  modeButtonActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  modeText: {
    color: "#334155",
    fontWeight: "600"
  },
  modeTextActive: {
    color: "#ffffff"
  },
  fieldBlock: {
    gap: 6
  },
  label: {
    color: "#0f172a",
    fontWeight: "600"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  error: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  submitButton: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center"
  },
  submitButtonDisabled: {
    opacity: 0.55
  },
  submitText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  statusCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: "#ffffff"
  },
  statusTitle: {
    fontWeight: "700",
    color: "#0f172a"
  },
  statusText: {
    color: "#334155"
  },
  logoutButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  logoutButtonDisabled: {
    opacity: 0.45
  },
  logoutText: {
    color: "#dc2626",
    fontWeight: "600"
  }
});
