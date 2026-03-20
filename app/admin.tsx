import { useEffect, useMemo, useState } from "react";
import { Stack } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp
} from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type UserProfile = {
  uid: string;
  displayName?: string;
  email?: string;
  householdId?: string;
  role?: "admin" | "member";
  approved?: boolean;
  createdAt?: Timestamp;
};

function asTextError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser ?? null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [householdDrafts, setHouseholdDrafts] = useState<Record<string, string>>({});
  const [newHouseholdId, setNewHouseholdId] = useState("");
  const [newHouseholdName, setNewHouseholdName] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setMyProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    const myRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(
      myRef,
      (snap) => {
        const data = snap.data() as UserProfile | undefined;
        setMyProfile(data ? { ...data, uid: currentUser.uid } : null);
        setLoadingProfile(false);
      },
      () => {
        setMyProfile(null);
        setLoadingProfile(false);
      }
    );
    return unsubscribe;
  }, [currentUser]);

  const isAdmin = myProfile?.role === "admin" && myProfile?.approved === true;

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const nextUsers = snap.docs.map((d) => {
          const data = d.data() as Omit<UserProfile, "uid">;
          return {
            uid: d.id,
            ...data
          };
        });
        setUsers(nextUsers);
        setLoadingUsers(false);
        setHouseholdDrafts((prev) => {
          const next = { ...prev };
          for (const user of nextUsers) {
            if (next[user.uid] === undefined) {
              next[user.uid] = user.householdId ?? "";
            }
          }
          return next;
        });
      },
      () => {
        setUsers([]);
        setLoadingUsers(false);
      }
    );
    return unsubscribe;
  }, [isAdmin]);

  const canCreateHousehold = useMemo(() => {
    return (
      isAdmin &&
      !!newHouseholdId.trim() &&
      !!newHouseholdName.trim() &&
      !busy &&
      !!currentUser
    );
  }, [busy, currentUser, isAdmin, newHouseholdId, newHouseholdName]);

  async function handleCreateHousehold() {
    if (!currentUser || !canCreateHousehold) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const id = newHouseholdId.trim();
      const name = newHouseholdName.trim();
      const householdRef = doc(db, "households", id);
      await setDoc(householdRef, {
        name,
        createdByUid: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewHouseholdId("");
      setNewHouseholdName("");
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleApproved(user: UserProfile) {
    if (!isAdmin || busy) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { approved: !user.approved });
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleRole(user: UserProfile) {
    if (!isAdmin || busy) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const nextRole = user.role === "admin" ? "member" : "admin";
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { role: nextRole });
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveHousehold(user: UserProfile) {
    if (!isAdmin || busy) {
      return;
    }
    const nextHousehold = (householdDrafts[user.uid] ?? "").trim();
    setBusy(true);
    setErrorText("");
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { householdId: nextHousehold });
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteUser(user: UserProfile) {
    if (!isAdmin || busy) {
      return;
    }
    if (currentUser?.uid === user.uid) {
      setErrorText("No puedes eliminar tu propio perfil desde esta pantalla.");
      return;
    }

    Alert.alert(
      "Eliminar usuario",
      `Se eliminará el perfil de ${user.displayName || user.email || user.uid} en Firestore. La cuenta de acceso en Firebase Auth no se borra desde aquí.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setErrorText("");
            try {
              const userRef = doc(db, "users", user.uid);
              await deleteDoc(userRef);
            } catch (error) {
              setErrorText(asTextError(error));
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  }

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#0f766e" />
          <Text style={styles.helper}>Cargando perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Administrar usuarios" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Administración</Text>
        <Text style={styles.subtitle}>
          Admin: {isAdmin ? "Sí" : "No"} | Tu hogar: {myProfile?.householdId || "sin asignar"}
        </Text>
        {isAdmin ? (
          <Text style={styles.helper}>
            Eliminar usuario borra solo su perfil en Firestore. La cuenta de Firebase Auth se
            elimina desde la consola.
          </Text>
        ) : null}

        {!isAdmin ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Acceso restringido</Text>
            <Text style={styles.warnText}>
              Esta pantalla requiere `role=admin` y `approved=true`.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Crear hogar</Text>
              <TextInput
                placeholder="ID hogar (ej. casa-sergio)"
                value={newHouseholdId}
                onChangeText={setNewHouseholdId}
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                placeholder="Nombre hogar (ej. Casa Sergio)"
                value={newHouseholdName}
                onChangeText={setNewHouseholdName}
                style={styles.input}
              />
              <Pressable
                onPress={handleCreateHousehold}
                disabled={!canCreateHousehold}
                style={[styles.primaryButton, !canCreateHousehold && styles.primaryButtonDisabled]}
              >
                <Text style={styles.primaryText}>Crear hogar</Text>
              </Pressable>
            </View>

            {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

            {loadingUsers ? (
              <View style={styles.center}>
                <ActivityIndicator color="#0f766e" />
                <Text style={styles.helper}>Cargando usuarios...</Text>
              </View>
            ) : (
              <FlatList
                data={users}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
                renderItem={({ item }) => (
                  <View style={styles.userCard}>
                    <Text style={styles.userName}>{item.displayName || "Sin nombre"}</Text>
                    <Text style={styles.userMeta}>{item.email || "Sin correo"}</Text>
                    <Text style={styles.userMeta}>UID: {item.uid}</Text>
                    <Text style={styles.userMeta}>
                      Rol: {item.role || "member"} | Aprobado: {item.approved ? "Sí" : "No"}
                    </Text>

                    <View style={styles.row}>
                      <TextInput
                        placeholder="householdId"
                        value={householdDrafts[item.uid] ?? ""}
                        onChangeText={(value) =>
                          setHouseholdDrafts((prev) => ({ ...prev, [item.uid]: value }))
                        }
                        style={[styles.input, styles.grow]}
                      />
                      <Pressable
                        onPress={() => handleSaveHousehold(item)}
                        style={styles.inlineButton}
                      >
                        <Text style={styles.inlineText}>Guardar</Text>
                      </Pressable>
                    </View>

                    <View style={styles.row}>
                      <Pressable
                        onPress={() => handleToggleApproved(item)}
                        style={styles.ghostButton}
                      >
                        <Text style={styles.ghostText}>
                          {item.approved ? "Revocar" : "Aprobar"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleToggleRole(item)}
                        style={styles.ghostButton}
                      >
                        <Text style={styles.ghostText}>
                          {item.role === "admin" ? "Hacer member" : "Hacer admin"}
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => handleDeleteUser(item)}
                      disabled={busy || currentUser?.uid === item.uid}
                      style={[
                        styles.dangerButton,
                        (busy || currentUser?.uid === item.uid) && styles.primaryButtonDisabled
                      ]}
                    >
                      <Text style={styles.dangerText}>
                        {currentUser?.uid === item.uid ? "No puedes eliminarte" : "Eliminar usuario"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2ff"
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 12
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0b1324"
  },
  subtitle: {
    color: "#334155"
  },
  helper: {
    color: "#64748b"
  },
  warnCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    padding: 12,
    gap: 6
  },
  warnTitle: {
    color: "#92400e",
    fontWeight: "700"
  },
  warnText: {
    color: "#78350f"
  },
  formCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  formTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  grow: {
    flex: 1
  },
  primaryButton: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.55
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  error: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  list: {
    gap: 8,
    paddingBottom: 24
  },
  userCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  userName: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16
  },
  userMeta: {
    color: "#334155"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  inlineButton: {
    backgroundColor: "#1d4ed8",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  inlineText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  ghostText: {
    color: "#1d4ed8",
    fontWeight: "700"
  },
  dangerButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#dc2626",
    alignItems: "center"
  },
  dangerText: {
    color: "#ffffff",
    fontWeight: "800"
  }
});
