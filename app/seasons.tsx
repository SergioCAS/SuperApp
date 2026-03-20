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
  updateDoc
} from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type UserProfile = {
  displayName?: string;
  householdId?: string;
  role?: "admin" | "member";
};

type SeasonView = {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  active: boolean;
};

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function isValidMonthDay(month: number, day: number) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function asTextError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

function asMonthDayLabel(month: number, day: number) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function monthDayValue(month: number, day: number) {
  return month * 100 + day;
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function isLikelyDuplicateSeasonName(a: string, b: string) {
  const na = normalizeForMatch(a).replace(/\s+/g, "");
  const nb = normalizeForMatch(b).replace(/\s+/g, "");
  if (!na || !nb) {
    return false;
  }
  if (na === nb) {
    return true;
  }
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const threshold = maxLen <= 6 ? 1 : 2;
  return distance <= threshold;
}

export default function SeasonsScreen() {
  const listRef = useRef<FlatList<SeasonView>>(null);
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [seasons, setSeasons] = useState<SeasonView[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [highlightedSeasonId, setHighlightedSeasonId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [nameHasFocus, setNameHasFocus] = useState(false);
  const [startMonth, setStartMonth] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [endDay, setEndDay] = useState("");
  const [active, setActive] = useState(true);

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
      setSeasons([]);
      setLoadingSeasons(false);
      return;
    }
    setLoadingSeasons(true);
    const seasonsRef = collection(db, "households", householdId, "seasons");
    const q = query(seasonsRef, orderBy("startMonth", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name ?? ""),
              startMonth: Number(data.startMonth ?? 0),
              startDay: Number(data.startDay ?? 0),
              endMonth: Number(data.endMonth ?? 0),
              endDay: Number(data.endDay ?? 0),
              active: Boolean(data.active)
            };
          })
          .sort(
            (a, b) =>
              monthDayValue(a.startMonth, a.startDay) - monthDayValue(b.startMonth, b.startDay)
          );
        setSeasons(next);
        setLoadingSeasons(false);
      },
      (error) => {
        setSeasons([]);
        setErrorText(asTextError(error));
        setLoadingSeasons(false);
      }
    );
    return unsubscribe;
  }, [householdId]);

  const duplicateSeason = useMemo(() => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return null;
    }
    return (
      seasons.find((season) => {
        return isLikelyDuplicateSeasonName(season.name, normalizedName);
      }) ?? null
    );
  }, [name, seasons]);

  const canCreate = useMemo(() => {
    if (!isAdmin || !householdId || busy || !name.trim()) {
      return false;
    }
    const sm = toNumber(startMonth.trim());
    const sd = toNumber(startDay.trim());
    const em = toNumber(endMonth.trim());
    const ed = toNumber(endDay.trim());
    return isValidMonthDay(sm, sd) && isValidMonthDay(em, ed) && !duplicateSeason;
  }, [busy, duplicateSeason, endDay, endMonth, householdId, isAdmin, name, startDay, startMonth]);

  async function handleCreateSeason() {
    if (!householdId || !isAdmin) {
      return;
    }
    setBusy(true);
    setErrorText("");
    setInfoText("");
    try {
      const sm = toNumber(startMonth.trim());
      const sd = toNumber(startDay.trim());
      const em = toNumber(endMonth.trim());
      const ed = toNumber(endDay.trim());
      if (!isValidMonthDay(sm, sd) || !isValidMonthDay(em, ed)) {
        throw new Error("Mes/día inválido. Usa mes 1..12 y día 1..31.");
      }
      if (duplicateSeason) {
        throw new Error(`Esta época ya existe: ${duplicateSeason.name}.`);
      }

      const seasonsRef = collection(db, "households", householdId, "seasons");
      await addDoc(seasonsRef, {
        name: name.trim(),
        startMonth: sm,
        startDay: sd,
        endMonth: em,
        endDay: ed,
        active
      });

      setName("");
      setNameHasFocus(false);
      setStartMonth("");
      setStartDay("");
      setEndMonth("");
      setEndDay("");
      setActive(true);
      setInfoText("Época creada.");
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  function handleUseExistingSeason() {
    if (!duplicateSeason) {
      return;
    }
    const index = seasons.findIndex((season) => season.id === duplicateSeason.id);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    }
    setHighlightedSeasonId(duplicateSeason.id);
    setName("");
    setStartMonth("");
    setStartDay("");
    setEndMonth("");
    setEndDay("");
    setActive(true);
    setErrorText("");
    setInfoText(`Se usará la época existente: ${duplicateSeason.name}.`);
  }

  useEffect(() => {
    if (!highlightedSeasonId) {
      return;
    }
    const timer = setTimeout(() => setHighlightedSeasonId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedSeasonId]);

  async function handleToggleActive(season: SeasonView) {
    if (!householdId || !isAdmin || busy) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const seasonRef = doc(db, "households", householdId, "seasons", season.id);
      await updateDoc(seasonRef, { active: !season.active });
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(seasonId: string) {
    if (!householdId || !isAdmin || busy) {
      return;
    }
    setBusy(true);
    setErrorText("");
    try {
      const seasonRef = doc(db, "households", householdId, "seasons", seasonId);
      await deleteDoc(seasonRef);
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
      <Stack.Screen options={{ title: "Épocas" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Épocas recurrentes</Text>
        <Text style={styles.subtitle}>
          Hogar: {householdId || "Sin configurar"} | Rol: {profile?.role || "member"}
        </Text>

        {!householdId ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Falta householdId en tu perfil</Text>
            <Text style={styles.warnText}>No se puede administrar épocas sin hogar asignado.</Text>
          </View>
        ) : null}

        {!isAdmin ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Solo admin puede editar</Text>
            <Text style={styles.warnText}>
              Puedes ver épocas, pero para crear/editar/eliminar necesitas `role=admin`.
            </Text>
          </View>
        ) : (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nueva época</Text>
            <TextInput
              placeholder="Nombre (ej. Navidad)"
              value={name}
              onFocus={() => setNameHasFocus(true)}
              onBlur={() => setNameHasFocus(false)}
              onChangeText={setName}
              style={styles.input}
            />
            <View style={styles.row}>
              <TextInput
                placeholder="Mes inicio"
                value={startMonth}
                onChangeText={setStartMonth}
                keyboardType="numeric"
                style={[styles.input, styles.field]}
              />
              <TextInput
                placeholder="Día inicio"
                value={startDay}
                onChangeText={setStartDay}
                keyboardType="numeric"
                style={[styles.input, styles.field]}
              />
            </View>
            <View style={styles.row}>
              <TextInput
                placeholder="Mes fin"
                value={endMonth}
                onChangeText={setEndMonth}
                keyboardType="numeric"
                style={[styles.input, styles.field]}
              />
              <TextInput
                placeholder="Día fin"
                value={endDay}
                onChangeText={setEndDay}
                keyboardType="numeric"
                style={[styles.input, styles.field]}
              />
            </View>
            <Text style={styles.helper}>
              Puedes cruzar de año. Ejemplo: Navidad 15/12 a 02/02.
            </Text>
            {!nameHasFocus && duplicateSeason ? (
              <View style={styles.duplicateBox}>
                <Text style={styles.error}>Ya existe una época con nombre similar.</Text>
                <Pressable onPress={handleUseExistingSeason} style={styles.useExistingButton}>
                  <Text style={styles.useExistingText}>Usar existente</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable
              onPress={() => setActive((v) => !v)}
              style={[styles.toggleButton, active && styles.toggleButtonActive]}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                {active ? "Activa: Sí" : "Activa: No"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleCreateSeason}
              disabled={!canCreate}
              style={[styles.primaryButton, !canCreate && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryText}>Guardar época</Text>
            </Pressable>
          </View>
        )}

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
        {infoText ? <Text style={styles.info}>{infoText}</Text> : null}

        {loadingSeasons ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.helper}>Cargando épocas...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={seasons}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: 20 + insets.bottom }]}
            onScrollToIndexFailed={(info) => {
              listRef.current?.scrollToOffset({
                offset: info.averageItemLength * info.index,
                animated: true
              });
            }}
            ListEmptyComponent={<Text style={styles.helper}>No hay épocas registradas.</Text>}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.seasonCard,
                  highlightedSeasonId === item.id && styles.seasonCardHighlighted
                ]}
              >
                <View style={styles.seasonInfo}>
                  <Text style={styles.seasonName}>{item.name}</Text>
                  <Text style={styles.seasonMeta}>
                    {asMonthDayLabel(item.startMonth, item.startDay)} -{" "}
                    {asMonthDayLabel(item.endMonth, item.endDay)}
                  </Text>
                  <Text style={[styles.badge, item.active ? styles.badgeOn : styles.badgeOff]}>
                    {item.active ? "Activa" : "Inactiva"}
                  </Text>
                </View>
                {isAdmin ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => handleToggleActive(item)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionText}>{item.active ? "Desactivar" : "Activar"}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(item.id)}
                      style={[styles.actionButton, styles.deleteButton]}
                    >
                      <Text style={[styles.actionText, styles.deleteText]}>Eliminar</Text>
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
    padding: 16,
    gap: 12
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a"
  },
  subtitle: {
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
  formCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 12,
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
  row: {
    flexDirection: "row",
    gap: 8
  },
  field: {
    flex: 1
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center"
  },
  toggleButtonActive: {
    borderColor: "#0f766e",
    backgroundColor: "#e6fffb"
  },
  toggleText: {
    color: "#334155",
    fontWeight: "600"
  },
  toggleTextActive: {
    color: "#0f766e"
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
  seasonCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  seasonCardHighlighted: {
    borderColor: "#0f766e",
    backgroundColor: "#ecfdf5"
  },
  seasonInfo: {
    flex: 1,
    gap: 4
  },
  seasonName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16
  },
  seasonMeta: {
    color: "#475569"
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    overflow: "hidden"
  },
  badgeOn: {
    backgroundColor: "#dcfce7",
    color: "#166534"
  },
  badgeOff: {
    backgroundColor: "#fee2e2",
    color: "#991b1b"
  },
  actions: {
    gap: 6
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  deleteButton: {
    borderColor: "#fecaca"
  },
  actionText: {
    color: "#334155",
    fontWeight: "600",
    fontSize: 12
  },
  deleteText: {
    color: "#b91c1c"
  }
});
