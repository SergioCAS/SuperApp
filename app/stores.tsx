import { useEffect, useMemo, useRef, useState } from "react";
import { Stack } from "expo-router";
import {
  ActivityIndicator,
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
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../src/config/firebase";
import { levenshtein, normalizeForMatch } from "../src/utils/normalize";

type UserProfile = {
  householdId?: string;
  role?: "admin" | "member";
};

type StoreView = {
  id: string;
  name: string;
};

function asTextError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

function isLikelyDuplicateStoreName(a: string, b: string) {
  const na = normalizeForMatch(a);
  const nb = normalizeForMatch(b);
  if (!na || !nb) {
    return false;
  }
  if (na === nb) {
    return true;
  }
  const joinedA = na.replace(/\s+/g, "");
  const joinedB = nb.replace(/\s+/g, "");
  if (joinedA === joinedB) {
    return true;
  }
  if (joinedA.includes(joinedB) || joinedB.includes(joinedA)) {
    return Math.min(joinedA.length, joinedB.length) >= 5;
  }
  const distance = levenshtein(joinedA, joinedB);
  const maxLen = Math.max(joinedA.length, joinedB.length);
  const threshold = maxLen <= 6 ? 1 : 2;
  return distance <= threshold;
}

export default function StoresScreen() {
  const listRef = useRef<FlatList<StoreView>>(null);
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [stores, setStores] = useState<StoreView[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [nameHasFocus, setNameHasFocus] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editingStoreName, setEditingStoreName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [highlightedStoreId, setHighlightedStoreId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setLoadingProfile(false);
      return;
    }
    setLoadingProfile(true);
    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        setProfile((snap.data() as UserProfile | undefined) ?? null);
        setLoadingProfile(false);
      },
      () => {
        setProfile(null);
        setLoadingProfile(false);
      }
    );
    return unsubscribe;
  }, [currentUser]);

  const householdId = profile?.householdId?.trim() ?? "";
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!householdId) {
      setStores([]);
      setLoadingStores(false);
      return;
    }
    setLoadingStores(true);
    const storesRef = collection(db, "households", householdId, "stores_catalog");
    const q = query(storesRef, orderBy("normalizedName", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((storeDoc) => {
          const data = storeDoc.data();
          return {
            id: storeDoc.id,
            name: String(data.name ?? "")
          };
        });
        setStores(next);
        setLoadingStores(false);
      },
      () => {
        setStores([]);
        setLoadingStores(false);
      }
    );
    return unsubscribe;
  }, [householdId]);

  const duplicateCreate = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    return stores.find((store) => isLikelyDuplicateStoreName(store.name, trimmed)) ?? null;
  }, [name, stores]);

  const duplicateEdit = useMemo(() => {
    if (!editingStoreId || !editingStoreName.trim()) {
      return null;
    }
    return (
      stores.find(
        (store) =>
          store.id !== editingStoreId && isLikelyDuplicateStoreName(store.name, editingStoreName)
      ) ?? null
    );
  }, [editingStoreId, editingStoreName, stores]);

  const canCreate = useMemo(() => {
    return !!householdId && !!name.trim() && !busy && !duplicateCreate;
  }, [busy, duplicateCreate, householdId, name]);

  async function handleCreate() {
    if (!householdId || !name.trim() || duplicateCreate) {
      return;
    }
    setBusy(true);
    setErrorText("");
    setInfoText("");
    try {
      const storesRef = collection(db, "households", householdId, "stores_catalog");
      const storeName = name.trim();
      await addDoc(storesRef, {
        name: storeName,
        normalizedName: storeName.toLowerCase(),
        createdAt: serverTimestamp(),
        lastUsedAt: serverTimestamp()
      });
      setName("");
      setNameHasFocus(false);
      setFormOpen(false);
      setInfoText(`Tienda creada: ${storeName}.`);
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  function handleUseExistingDuplicate() {
    if (!duplicateCreate) {
      return;
    }
    const index = stores.findIndex((store) => store.id === duplicateCreate.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    }
    setHighlightedStoreId(duplicateCreate.id);
    setName("");
    setErrorText("");
    setInfoText(`Se usará la tienda existente: ${duplicateCreate.name}.`);
  }

  useEffect(() => {
    if (!highlightedStoreId) {
      return;
    }
    const timer = setTimeout(() => setHighlightedStoreId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedStoreId]);

  async function handleDelete(storeId: string) {
    if (!householdId || !isAdmin || busy) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const storeRef = doc(db, "households", householdId, "stores_catalog", storeId);
      await deleteDoc(storeRef);
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(storeId: string) {
    if (!householdId || !isAdmin || busy || !editingStoreName.trim() || duplicateEdit) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const storeName = editingStoreName.trim();
      const storeRef = doc(db, "households", householdId, "stores_catalog", storeId);
      await updateDoc(storeRef, {
        name: storeName,
        normalizedName: storeName.toLowerCase()
      });
      setEditingStoreId(null);
      setEditingStoreName("");
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
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
      <Stack.Screen options={{ title: "Tiendas" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Tiendas</Text>
        <Text style={styles.subtitle}>
          Hogar: {householdId || "Sin configurar"} | Rol: {profile?.role || "member"}
        </Text>

        {!householdId ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Falta householdId en tu perfil</Text>
            <Text style={styles.warnText}>No se puede administrar tiendas sin hogar asignado.</Text>
          </View>
        ) : formOpen ? (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Agregar tienda</Text>
              <Pressable onPress={() => setFormOpen(false)} style={styles.closeButton} hitSlop={8}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              placeholder="Ej. Soriana"
              value={name}
              onFocus={() => setNameHasFocus(true)}
              onBlur={() => setNameHasFocus(false)}
              onChangeText={setName}
              style={styles.input}
            />
            {!nameHasFocus && duplicateCreate ? (
              <View style={styles.duplicateBox}>
                <Text style={styles.inlineWarn}>
                  Posible duplicado con: {duplicateCreate.name}. Revisa el nombre antes de guardar.
                </Text>
                <Pressable onPress={handleUseExistingDuplicate} style={styles.useExistingButton}>
                  <Text style={styles.useExistingText}>Usar existente</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              onPress={handleCreate}
              disabled={!canCreate}
              style={[styles.primaryButton, !canCreate && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryText}>Guardar tienda</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setFormOpen(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>＋ Agregar tienda</Text>
          </Pressable>
        )}

        {householdId && !isAdmin ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Permisos de miembro</Text>
            <Text style={styles.warnText}>
              Puedes agregar tiendas. Solo admin puede editar o eliminar.
            </Text>
          </View>
        ) : null}

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
        {infoText ? <Text style={styles.info}>{infoText}</Text> : null}

        {loadingStores ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.helper}>Cargando tiendas...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={stores}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: 20 + insets.bottom }]}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true
              });
            }}
            ListEmptyComponent={<Text style={styles.helper}>No hay tiendas registradas.</Text>}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.storeCard,
                  highlightedStoreId === item.id && styles.storeCardHighlighted
                ]}
              >
                {isAdmin && editingStoreId === item.id ? (
                  <View style={styles.editWrap}>
                    <TextInput
                      placeholder="Nombre de tienda"
                      value={editingStoreName}
                      onChangeText={setEditingStoreName}
                      style={styles.input}
                    />
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={() => handleSaveEdit(item.id)}
                        disabled={!editingStoreName.trim() || busy || !!duplicateEdit}
                        style={[
                          styles.actionButton,
                          styles.saveButton,
                          (!editingStoreName.trim() || busy || !!duplicateEdit) &&
                            styles.primaryButtonDisabled
                        ]}
                      >
                        <Text style={styles.saveText}>Guardar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setEditingStoreId(null);
                          setEditingStoreName("");
                        }}
                        style={[styles.actionButton, styles.cancelButton]}
                      >
                        <Text style={styles.cancelText}>Cancelar</Text>
                      </Pressable>
                    </View>
                    {duplicateEdit ? (
                      <Text style={styles.inlineWarn}>
                        Posible duplicado con: {duplicateEdit.name}.
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.storeName}>{item.name}</Text>
                )}
                {isAdmin ? (
                  <View style={styles.actionsRow}>
                    {editingStoreId === item.id ? null : (
                      <Pressable
                        onPress={() => {
                          setEditingStoreId(item.id);
                          setEditingStoreName(item.name);
                        }}
                        style={[styles.actionButton, styles.editButton]}
                      >
                        <Text style={styles.editText}>Editar</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => handleDelete(item.id)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={styles.deleteText}>Eliminar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
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
    padding: 14,
    gap: 8
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
    fontSize: 13,
    color: "#475569"
  },
  helper: {
    color: "#64748b"
  },
  warnCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fffbeb",
    borderRadius: 12,
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
  addButton: {
    borderWidth: 1.5,
    borderColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  addButtonText: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 15
  },
  formCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    gap: 8
  },
  formHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  formTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  closeButton: {
    padding: 4
  },
  closeText: {
    color: "#64748b",
    fontSize: 16,
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
  info: {
    color: "#0f766e",
    fontWeight: "600"
  },
  duplicateBox: {
    gap: 6
  },
  inlineWarn: {
    color: "#92400e",
    fontWeight: "600"
  },
  useExistingButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  useExistingText: {
    color: "#0f766e",
    fontWeight: "700"
  },
  list: {
    gap: 8,
    paddingBottom: 20
  },
  storeCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  storeCardHighlighted: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5"
  },
  editWrap: {
    flex: 1,
    gap: 8
  },
  storeName: {
    flex: 1,
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  editButton: {
    borderColor: "#bfdbfe"
  },
  saveButton: {
    borderColor: "#99f6e4",
    backgroundColor: "#0f766e"
  },
  cancelButton: {
    borderColor: "#cbd5e1"
  },
  deleteButton: {
    borderColor: "#fecaca"
  },
  editText: {
    color: "#1d4ed8",
    fontWeight: "700"
  },
  saveText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  cancelText: {
    color: "#334155",
    fontWeight: "700"
  },
  deleteText: {
    color: "#b91c1c",
    fontWeight: "700"
  }
});
