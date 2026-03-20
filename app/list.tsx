import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Timestamp,
  addDoc,
  collection,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData
} from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type ListItemView = {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  estimatedPrice?: number;
  estimatedUnitPrice?: number;
  preferredStoreId?: string;
  preferredStoreName?: string;
  addedByUid: string;
  createdAt?: Timestamp;
};

type UserProfile = {
  displayName?: string;
  householdId?: string;
};

type StoreOption = {
  id: string;
  name: string;
};

type SeasonOption = {
  id: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  active: boolean;
};

type ActivityEventType = "added" | "supplied";

type ActivityEventView = {
  id: string;
  type: ActivityEventType;
  itemName: string;
  actorUid: string;
  actorName: string;
  createdAt?: Timestamp;
};

type NameSuggestion = {
  key: string;
  label: string;
  normalized: string;
  source: "pending" | "supplied";
  pendingItemId?: string;
  lastQuantity?: number;
  lastPricePaid?: number;
  lastStoreId?: string;
  lastStoreName?: string;
};

type PurchaseHistoryHint = {
  name: string;
  normalizedName: string;
  quantity?: number;
  pricePaid?: number;
  storeId?: string;
  storeName?: string;
};

type PurchaseHistoryEntry = {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  pricePaid?: number;
  storeId?: string;
  storeName?: string;
  purchasedAt?: Timestamp;
};

type RestockCandidate = {
  key: string;
  name: string;
  normalizedName: string;
  quantity: number;
  lastPricePaid?: number;
  lastStoreId?: string;
  lastStoreName?: string;
  purchasedAt?: Timestamp;
};

type ReadScope =
  | "profile"
  | "list_items"
  | "stores_catalog"
  | "seasons"
  | "purchases"
  | "activity";

function asTextError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

function asReadError(scopeLabel: string, error: unknown) {
  return `No se pudo cargar ${scopeLabel}: ${asTextError(error)}`;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function toNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function formatEventTime(value?: Timestamp) {
  if (!value) {
    return "ahora";
  }
  return value.toDate().toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isValidMonthDay(month: number, day: number) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function monthDayValue(month: number, day: number) {
  return month * 100 + day;
}

function isDateInRecurringSeason(
  date: Date,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay: number
) {
  const current = monthDayValue(date.getMonth() + 1, date.getDate());
  const start = monthDayValue(startMonth, startDay);
  const end = monthDayValue(endMonth, endDay);

  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

function resolveSeasonId(seasons: SeasonOption[], purchaseDate: Date) {
  for (const season of seasons) {
    if (
      !season.active ||
      !isValidMonthDay(season.startMonth, season.startDay) ||
      !isValidMonthDay(season.endMonth, season.endDay)
    ) {
      continue;
    }
    if (
      isDateInRecurringSeason(
        purchaseDate,
        season.startMonth,
        season.startDay,
        season.endMonth,
        season.endDay
      )
    ) {
      return season.id;
    }
  }
  return undefined;
}

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [items, setItems] = useState<ListItemView[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [purchaseNames, setPurchaseNames] = useState<PurchaseHistoryHint[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryEntry[]>([]);

  const [events, setEvents] = useState<ActivityEventView[]>([]);
  const [eventNotice, setEventNotice] = useState("");
  const [activityExpanded, setActivityExpanded] = useState(false);
  const listRef = useRef<FlatList<ListItemView> | null>(null);
  const didLoadEventsRef = useRef(false);
  const latestEventRef = useRef("");

  const [name, setName] = useState("");
  const [nameHasFocus, setNameHasFocus] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedPendingSuggestionId, setSelectedPendingSuggestionId] = useState<string | null>(null);
  const [prefillHintText, setPrefillHintText] = useState("");
  const [preferredStoreIdDraft, setPreferredStoreIdDraft] = useState("");
  const [preferredStoreNameDraft, setPreferredStoreNameDraft] = useState("");

  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");
  const [readErrors, setReadErrors] = useState<Record<ReadScope, string>>({
    profile: "",
    list_items: "",
    stores_catalog: "",
    seasons: "",
    purchases: "",
    activity: ""
  });

  const [supplyItem, setSupplyItem] = useState<ListItemView | null>(null);
  const [supplyStoreId, setSupplyStoreId] = useState("");
  const [supplyStoreQuery, setSupplyStoreQuery] = useState("");
  const [supplyPricePaid, setSupplyPricePaid] = useState("");
  const [restockVisible, setRestockVisible] = useState(false);
  const [restockSearch, setRestockSearch] = useState("");
  const [restockSelectedKeys, setRestockSelectedKeys] = useState<string[]>([]);
  const [restockModeVisible, setRestockModeVisible] = useState(false);
  const [recentlyRestockedIds, setRecentlyRestockedIds] = useState<string[]>([]);
  const readErrorText = useMemo(() => {
    return Object.values(readErrors)
      .filter(Boolean)
      .join("\n");
  }, [readErrors]);

  function clearReadError(scope: ReadScope) {
    setReadErrors((prev) => ({ ...prev, [scope]: "" }));
  }

  function setReadError(scope: ReadScope, message: string) {
    setReadErrors((prev) => ({ ...prev, [scope]: message }));
  }

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
      clearReadError("profile");
      return;
    }
    setLoadingProfile(true);
    const userRef = doc(db, "users", currentUser.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        setProfile((snap.data() as UserProfile | undefined) ?? null);
        setLoadingProfile(false);
        clearReadError("profile");
      },
      (error) => {
        setProfile(null);
        setLoadingProfile(false);
        setReadError("profile", asReadError("tu perfil de usuario", error));
      }
    );
    return unsubscribe;
  }, [currentUser]);

  const householdId = profile?.householdId?.trim() ?? "";

  useEffect(() => {
    if (!householdId) {
      setItems([]);
      setLoadingItems(false);
      clearReadError("list_items");
      return;
    }
    setLoadingItems(true);
    const itemsRef = collection(db, "households", householdId, "list_items");
    const q = query(itemsRef, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const nextItems = snap.docs.map((itemDoc) => {
          const data = itemDoc.data();
          return {
            id: itemDoc.id,
            name: String(data.name ?? ""),
            normalizedName: String(data.normalizedName ?? normalizeName(String(data.name ?? ""))),
            quantity: Number(data.quantity ?? 0),
            estimatedPrice:
              typeof data.estimatedPrice === "number" ? data.estimatedPrice : undefined,
            estimatedUnitPrice:
              typeof data.estimatedUnitPrice === "number" ? data.estimatedUnitPrice : undefined,
            preferredStoreId:
              typeof data.preferredStoreId === "string" ? data.preferredStoreId : undefined,
            preferredStoreName:
              typeof data.preferredStoreName === "string" ? data.preferredStoreName : undefined,
            addedByUid: String(data.addedByUid ?? ""),
            createdAt: data.createdAt as Timestamp | undefined
          };
        });
        setItems(nextItems);
        setLoadingItems(false);
        clearReadError("list_items");
      },
      (error) => {
        setItems([]);
        setLoadingItems(false);
        setReadError("list_items", asReadError("la lista de artículos pendientes", error));
      }
    );
    return unsubscribe;
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      setStores([]);
      setSeasons([]);
      setPurchaseNames([]);
      setPurchaseHistory([]);
      clearReadError("stores_catalog");
      clearReadError("seasons");
      clearReadError("purchases");
      return;
    }

    const storesRef = collection(db, "households", householdId, "stores_catalog");
    const storesQuery = query(storesRef, orderBy("normalizedName", "asc"));
    const unsubscribeStores = onSnapshot(
      storesQuery,
      (snap) => {
        setStores(
          snap.docs.map((storeDoc) => ({
            id: storeDoc.id,
            name: String(storeDoc.data().name ?? "")
          }))
        );
        clearReadError("stores_catalog");
      },
      (error) => {
        setStores([]);
        setReadError("stores_catalog", asReadError("el catálogo de tiendas", error));
      }
    );

    const seasonsRef = collection(db, "households", householdId, "seasons");
    const seasonsQuery = query(seasonsRef, orderBy("startMonth", "asc"));
    const unsubscribeSeasons = onSnapshot(
      seasonsQuery,
      (snap) => {
        const nextSeasons = snap.docs
          .map((seasonDoc) => {
            const data = seasonDoc.data();
            return {
              id: seasonDoc.id,
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
        setSeasons(nextSeasons);
        clearReadError("seasons");
      },
      (error) => {
        setSeasons([]);
        setReadError("seasons", asReadError("las épocas configuradas", error));
      }
    );

    const purchasesRef = collection(db, "households", householdId, "purchases");
    const purchasesQuery = query(purchasesRef, orderBy("purchasedAt", "desc"), limit(250));
    const unsubscribePurchases = onSnapshot(
      purchasesQuery,
      (snap) => {
        const nextHistory = snap.docs.map((purchaseDoc) => {
          const data = purchaseDoc.data();
          const itemName = String(data.name ?? "");
          return {
            id: purchaseDoc.id,
            name: itemName,
            normalizedName: String(data.normalizedName ?? normalizeName(itemName)),
            quantity: typeof data.quantity === "number" && data.quantity > 0 ? data.quantity : 1,
            pricePaid: typeof data.pricePaid === "number" ? data.pricePaid : undefined,
            storeId: typeof data.storeId === "string" ? data.storeId : undefined,
            storeName: typeof data.storeName === "string" ? data.storeName : undefined,
            purchasedAt: data.purchasedAt as Timestamp | undefined
          } satisfies PurchaseHistoryEntry;
        });
        setPurchaseHistory(nextHistory);
        setPurchaseNames(
          nextHistory.map((purchase) => ({
            name: purchase.name,
            normalizedName: purchase.normalizedName,
            quantity: purchase.quantity,
            pricePaid: purchase.pricePaid,
            storeId: purchase.storeId,
            storeName: purchase.storeName
          }))
        );
        clearReadError("purchases");
      },
      (error) => {
        setPurchaseHistory([]);
        setPurchaseNames([]);
        setReadError("purchases", asReadError("el historial de compras", error));
      }
    );

    return () => {
      unsubscribeStores();
      unsubscribeSeasons();
      unsubscribePurchases();
    };
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      setEvents([]);
      setEventNotice("");
      didLoadEventsRef.current = false;
      latestEventRef.current = "";
      clearReadError("activity");
      return;
    }

    const activityRef = collection(db, "households", householdId, "activity");
    const q = query(activityRef, orderBy("createdAt", "desc"), limit(12));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const nextEvents = snap.docs.map((eventDoc) => {
          const data = eventDoc.data();
          return {
            id: eventDoc.id,
            type: data.type === "supplied" ? "supplied" : "added",
            itemName: String(data.itemName ?? ""),
            actorUid: String(data.actorUid ?? ""),
            actorName: String(data.actorName ?? "Alguien"),
            createdAt: data.createdAt as Timestamp | undefined
          } satisfies ActivityEventView;
        });

        setEvents(nextEvents);
        clearReadError("activity");
        const newest = nextEvents[0];
        if (!newest) {
          return;
        }

        if (!didLoadEventsRef.current) {
          didLoadEventsRef.current = true;
          latestEventRef.current = newest.id;
          return;
        }

        if (newest.id !== latestEventRef.current) {
          latestEventRef.current = newest.id;
          if (newest.actorUid !== currentUser?.uid) {
            const action = newest.type === "added" ? "agregó" : "surtió";
            setEventNotice(`${newest.actorName} ${action}: ${newest.itemName}`);
          }
        }
      },
      (error) => {
        setEvents([]);
        setReadError("activity", asReadError("la actividad reciente", error));
      }
    );

    return unsubscribe;
  }, [currentUser?.uid, householdId]);

  useEffect(() => {
    if (!eventNotice) {
      return;
    }
    const timer = setTimeout(() => {
      setEventNotice("");
    }, 4500);
    return () => clearTimeout(timer);
  }, [eventNotice]);

  useEffect(() => {
    if (!infoText) {
      return;
    }
    const timer = setTimeout(() => setInfoText(""), 5000);
    return () => clearTimeout(timer);
  }, [infoText]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setRecentlyRestockedIds([]);
      };
    }, [])
  );

  const normalizedInput = useMemo(() => normalizeName(name), [name]);

  const pendingExactMatch = useMemo(() => {
    if (!normalizedInput) {
      return null;
    }
    return (
      items.find((item) => item.normalizedName === normalizedInput && item.id !== editingItemId) ?? null
    );
  }, [editingItemId, items, normalizedInput]);

  const pendingSelectedMatch = useMemo(() => {
    if (!selectedPendingSuggestionId) {
      return null;
    }
    return items.find((item) => item.id === selectedPendingSuggestionId) ?? null;
  }, [items, selectedPendingSuggestionId]);

  const duplicatePendingTarget = pendingExactMatch ?? pendingSelectedMatch;

  const suggestions = useMemo(() => {
    if (!normalizedInput) {
      return [] as NameSuggestion[];
    }

    const map = new Map<string, NameSuggestion>();
    for (const item of items) {
      if (item.normalizedName.includes(normalizedInput)) {
        map.set(`pending:${item.id}`, {
          key: `pending:${item.id}`,
          label: item.name,
          normalized: item.normalizedName,
          source: "pending",
          pendingItemId: item.id
        });
      }
    }
    for (const purchase of purchaseNames) {
      if (!purchase.normalizedName.includes(normalizedInput)) {
        continue;
      }
      const key = `supplied:${purchase.normalizedName}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: purchase.name,
          normalized: purchase.normalizedName,
          source: "supplied",
          lastQuantity: purchase.quantity,
          lastPricePaid: purchase.pricePaid,
          lastStoreId: purchase.storeId,
          lastStoreName: purchase.storeName
        });
      }
    }

    return Array.from(map.values()).slice(0, 6);
  }, [items, normalizedInput, purchaseNames]);

  const canSubmitItem = useMemo(() => {
    if (!currentUser || !householdId || busy) {
      return false;
    }
    if (!editingItemId && duplicatePendingTarget) {
      return false;
    }
    const quantityValue = toNumber(quantity.trim());
    if (!name.trim() || !Number.isFinite(quantityValue) || quantityValue <= 0) {
      return false;
    }
    if (estimatedPrice.trim()) {
      const priceValue = toNumber(estimatedPrice.trim());
      if (!Number.isFinite(priceValue) || priceValue < 0) {
        return false;
      }
    }
    return true;
  }, [
    busy,
    currentUser,
    duplicatePendingTarget,
    editingItemId,
    estimatedPrice,
    householdId,
    name,
    quantity
  ]);

  const canConfirmSupply = useMemo(() => {
    if (!supplyItem || !supplyStoreId || busy) {
      return false;
    }
    const paid = toNumber(supplyPricePaid.trim());
    return Number.isFinite(paid) && paid >= 0;
  }, [busy, supplyItem, supplyPricePaid, supplyStoreId]);

  const filteredSupplyStores = useMemo(() => {
    const queryValue = normalizeName(supplyStoreQuery);
    const filtered = stores.filter((store) => {
      if (!queryValue) {
        return true;
      }
      return normalizeName(store.name).includes(queryValue);
    });
    return filtered.sort((a, b) => {
      if (a.id === supplyStoreId) {
        return -1;
      }
      if (b.id === supplyStoreId) {
        return 1;
      }
      return a.name.localeCompare(b.name, "es-MX", { sensitivity: "base" });
    });
  }, [stores, supplyStoreId, supplyStoreQuery]);

  const restockCandidates = useMemo(() => {
    const map = new Map<string, RestockCandidate>();
    for (const purchase of purchaseHistory) {
      if (!purchase.normalizedName) {
        continue;
      }
      if (!map.has(purchase.normalizedName)) {
        map.set(purchase.normalizedName, {
          key: purchase.normalizedName,
          name: purchase.name,
          normalizedName: purchase.normalizedName,
          quantity: purchase.quantity > 0 ? purchase.quantity : 1,
          lastPricePaid: purchase.pricePaid,
          lastStoreId: purchase.storeId,
          lastStoreName: purchase.storeName,
          purchasedAt: purchase.purchasedAt
        });
      }
    }
    const text = normalizeName(restockSearch);
    return Array.from(map.values())
      .filter((candidate) =>
        text ? candidate.normalizedName.includes(text) || normalizeName(candidate.name).includes(text) : true
      )
      .sort((a, b) => {
        const ta = a.purchasedAt?.toMillis() ?? 0;
        const tb = b.purchasedAt?.toMillis() ?? 0;
        return tb - ta;
      });
  }, [purchaseHistory, restockSearch]);

  const restockSelectedCount = restockSelectedKeys.length;

  async function addActivityEvent(
    homeId: string,
    eventType: ActivityEventType,
    itemName: string,
    actorUid: string,
    actorName: string
  ) {
    const activityRef = collection(db, "households", homeId, "activity");
    await addDoc(activityRef, {
      type: eventType,
      itemName,
      actorUid,
      actorName,
      createdAt: serverTimestamp()
    });
  }

  async function handleAddOrUpdateItem() {
    if (!currentUser || !householdId) {
      return;
    }

    setBusy(true);
    setErrorText("");
    try {
      const itemName = name.trim();
      const quantityValue = toNumber(quantity.trim());
      const priceValue = estimatedPrice.trim() ? toNumber(estimatedPrice.trim()) : undefined;
      let shouldLogAddedActivity = false;

      if (editingItemId) {
        const editingItem = items.find((item) => item.id === editingItemId);
        if (!editingItem) {
          throw new Error("El artículo pendiente ya no existe.");
        }
        const basePayload: Record<string, unknown> = {
          name: itemName,
          normalizedName: normalizeName(itemName),
          quantity: quantityValue,
          // Conserva el autor original para cumplir reglas de Firestore.
          addedByUid: editingItem.addedByUid,
          updatedAt: serverTimestamp()
        };
        const itemRef = doc(db, "households", householdId, "list_items", editingItemId);
        await setDoc(
          itemRef,
          {
            ...basePayload,
            estimatedPrice: priceValue !== undefined ? priceValue : deleteField(),
            estimatedUnitPrice:
              priceValue !== undefined ? priceValue / quantityValue : deleteField(),
            preferredStoreId: preferredStoreIdDraft || deleteField(),
            preferredStoreName: preferredStoreNameDraft || deleteField()
          },
          { merge: true }
        );
      } else {
        const basePayload: Record<string, unknown> = {
          name: itemName,
          normalizedName: normalizeName(itemName),
          quantity: quantityValue,
          addedByUid: currentUser.uid,
          updatedAt: serverTimestamp()
        };
        const payload = {
          ...basePayload,
          createdAt: serverTimestamp(),
          ...(priceValue !== undefined
            ? {
                estimatedPrice: priceValue,
                estimatedUnitPrice: priceValue / quantityValue
              }
            : {}),
          ...(preferredStoreIdDraft ? { preferredStoreId: preferredStoreIdDraft } : {}),
          ...(preferredStoreNameDraft ? { preferredStoreName: preferredStoreNameDraft } : {})
        };
        const itemsRef = collection(db, "households", householdId, "list_items");
        await addDoc(itemsRef, payload);
        shouldLogAddedActivity = true;
      }

      setName("");
      setNameHasFocus(false);
      setQuantity("");
      setEstimatedPrice("");
      setEditingItemId(null);
      setSelectedPendingSuggestionId(null);
      setPrefillHintText("");
      setPreferredStoreIdDraft("");
      setPreferredStoreNameDraft("");

      if (shouldLogAddedActivity) {
        // Si falla este registro no debe bloquear el alta del artículo.
        try {
          await addActivityEvent(
            householdId,
            "added",
            itemName,
            currentUser.uid,
            profile?.displayName?.trim() || currentUser.email || "Usuario"
          );
        } catch (activityError) {
          console.warn("No se pudo registrar actividad de alta de artículo.", activityError);
        }
      }
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  function fillFromPendingItem(item: ListItemView) {
    setName(item.name);
    setQuantity(String(item.quantity));
    setEstimatedPrice(item.estimatedPrice !== undefined ? String(item.estimatedPrice) : "");
    setEditingItemId(item.id);
    setSelectedPendingSuggestionId(null);
    setPrefillHintText("");
    setPreferredStoreIdDraft(item.preferredStoreId ?? "");
    setPreferredStoreNameDraft(item.preferredStoreName ?? "");
  }

  function startEditingPendingItem(item: ListItemView) {
    fillFromPendingItem(item);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }

  function openSupplyModal(item: ListItemView) {
    setSupplyItem(item);
    setSupplyPricePaid(
      item.estimatedPrice !== undefined && Number.isFinite(item.estimatedPrice)
        ? String(item.estimatedPrice)
        : ""
    );
    setSupplyStoreQuery("");
    if (item.preferredStoreId && stores.some((store) => store.id === item.preferredStoreId)) {
      setSupplyStoreId(item.preferredStoreId);
    } else {
      setSupplyStoreId(stores[0]?.id ?? "");
    }
  }

  function closeSupplyModal() {
    setSupplyItem(null);
    setSupplyStoreId("");
    setSupplyStoreQuery("");
    setSupplyPricePaid("");
  }

  function toggleRestockSelection(key: string) {
    setRestockSelectedKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((value) => value !== key);
      }
      return [...prev, key];
    });
  }

  function openRestockSelector() {
    setRestockVisible(true);
    setRestockModeVisible(false);
    setRestockSearch("");
    setRestockSelectedKeys([]);
  }

  function closeRestockSelector() {
    setRestockVisible(false);
    setRestockModeVisible(false);
    setRestockSearch("");
    setRestockSelectedKeys([]);
  }

  async function addSelectedRestockItems(useLastPrice: boolean) {
    if (!currentUser || !householdId || restockSelectedCount === 0) {
      return;
    }

    const selectedSet = new Set(restockSelectedKeys);
    const selected = restockCandidates.filter((candidate) => selectedSet.has(candidate.key));
    if (selected.length === 0) {
      setErrorText("Selecciona al menos un artículo para reponer.");
      return;
    }

    setBusy(true);
    setErrorText("");
    setInfoText("");
    try {
      const existingPending = new Set(items.map((item) => item.normalizedName));
      const itemsRef = collection(db, "households", householdId, "list_items");
      const createdIds: string[] = [];
      let skippedDuplicates = 0;

      for (const candidate of selected) {
        if (existingPending.has(candidate.normalizedName)) {
          skippedDuplicates += 1;
          continue;
        }
        const quantityValue = candidate.quantity > 0 ? candidate.quantity : 1;
        const payload: Record<string, unknown> = {
          name: candidate.name,
          normalizedName: candidate.normalizedName,
          quantity: quantityValue,
          addedByUid: currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (useLastPrice && typeof candidate.lastPricePaid === "number" && candidate.lastPricePaid >= 0) {
          payload.estimatedPrice = candidate.lastPricePaid;
          payload.estimatedUnitPrice = candidate.lastPricePaid / quantityValue;
        }
        if (candidate.lastStoreId) {
          payload.preferredStoreId = candidate.lastStoreId;
        }
        if (candidate.lastStoreName) {
          payload.preferredStoreName = candidate.lastStoreName;
        }
        const created = await addDoc(itemsRef, payload);
        createdIds.push(created.id);
        existingPending.add(candidate.normalizedName);
      }

      if (createdIds.length > 0) {
        setRecentlyRestockedIds((prev) => [...prev, ...createdIds]);
      }
      setInfoText(
        `Reposición lista: ${createdIds.length} agregado(s)${
          skippedDuplicates > 0 ? `, ${skippedDuplicates} omitido(s) por duplicado` : ""
        }.`
      );
      closeRestockSelector();
    } catch (error) {
      setErrorText(asTextError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmSupply() {
    if (!currentUser || !householdId || !supplyItem || !supplyStoreId) {
      return;
    }

    const selectedStore = stores.find((store) => store.id === supplyStoreId);
    if (!selectedStore) {
      setErrorText("Selecciona una tienda válida.");
      return;
    }

    const pricePaid = toNumber(supplyPricePaid.trim());
    if (!Number.isFinite(pricePaid) || pricePaid < 0) {
      setErrorText("Captura un precio pagado válido.");
      return;
    }

    setBusy(true);
    setErrorText("");
    try {
      const purchaseDate = new Date();
      const purchaseTs = Timestamp.fromDate(purchaseDate);
      const seasonId = resolveSeasonId(seasons, purchaseDate);

      const itemRef = doc(db, "households", householdId, "list_items", supplyItem.id);
      const storeRef = doc(db, "households", householdId, "stores_catalog", selectedStore.id);
      const purchasesRef = collection(db, "households", householdId, "purchases");
      const purchaseRef = doc(purchasesRef);

      await runTransaction(db, async (tx) => {
        const itemSnap = await tx.get(itemRef);
        if (!itemSnap.exists()) {
          throw new Error("El artículo ya no existe.");
        }

        const liveItem = itemSnap.data() as DocumentData;
        const quantityValue = Number(liveItem.quantity ?? supplyItem.quantity);
        tx.set(purchaseRef, {
          listItemId: supplyItem.id,
          name: String(liveItem.name ?? supplyItem.name),
          normalizedName: String(
            liveItem.normalizedName ?? normalizeName(String(liveItem.name ?? supplyItem.name))
          ),
          quantity: quantityValue,
          pricePaid,
          unitPricePaid: pricePaid / quantityValue,
          storeId: selectedStore.id,
          storeName: selectedStore.name,
          purchasedByUid: currentUser.uid,
          purchasedAt: purchaseTs,
          ...(seasonId ? { seasonId } : {})
        });
        tx.delete(itemRef);
        tx.update(storeRef, { lastUsedAt: purchaseTs });
      });

      await addActivityEvent(
        householdId,
        "supplied",
        supplyItem.name,
        currentUser.uid,
        profile?.displayName?.trim() || currentUser.email || "Usuario"
      );

      closeSupplyModal();
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
      <Stack.Screen options={{ title: "Lista de compras" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Lista compartida</Text>
        <Text style={styles.subtitle}>
          Hogar: {householdId || "Sin configurar"} | Usuario: {profile?.displayName || "Sin nombre"}
        </Text>

        {!householdId ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Falta householdId en tu perfil</Text>
            <Text style={styles.warnText}>
              Pide al admin que te asigne `users/{'{uid}'}.householdId` y recarga sesión.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            style={styles.listContainer}
            contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                {eventNotice ? (
                  <View style={styles.noticeCard}>
                    <Text style={styles.noticeText}>{eventNotice}</Text>
                  </View>
                ) : null}

                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>
                    {editingItemId ? "Editar artículo pendiente" : "Agregar artículo"}
                  </Text>
                  <TextInput
                    placeholder="Ej. Leche"
                    placeholderTextColor="#94a3b8"
                    value={name}
                      onFocus={() => setNameHasFocus(true)}
                      onBlur={() => setNameHasFocus(false)}
                    onChangeText={(value) => {
                      setName(value);
                      setSelectedPendingSuggestionId(null);
                      setPrefillHintText("");
                      setPreferredStoreIdDraft("");
                      setPreferredStoreNameDraft("");
                    }}
                    style={styles.input}
                  />

                  {suggestions.length > 0 ? (
                    <View style={styles.suggestionsBox}>
                      {suggestions.map((s) => (
                        <Pressable
                          key={s.key}
                          onPress={() => {
                            setName(s.label);
                            if (s.source === "pending" && s.pendingItemId) {
                              setSelectedPendingSuggestionId(s.pendingItemId);
                              setEditingItemId(null);
                              setPrefillHintText("");
                              setPreferredStoreIdDraft("");
                              setPreferredStoreNameDraft("");
                            } else {
                              setSelectedPendingSuggestionId(null);
                              setEditingItemId(null);
                              if (typeof s.lastQuantity === "number" && s.lastQuantity > 0) {
                                setQuantity(String(s.lastQuantity));
                              } else {
                                setQuantity("");
                              }
                              if (typeof s.lastPricePaid === "number" && s.lastPricePaid >= 0) {
                                setEstimatedPrice(String(s.lastPricePaid));
                              } else {
                                setEstimatedPrice("");
                              }
                              setPreferredStoreIdDraft(s.lastStoreId ?? "");
                              setPreferredStoreNameDraft(s.lastStoreName ?? "");
                              setPrefillHintText("Datos precargados desde última compra.");
                            }
                          }}
                          style={styles.suggestionRow}
                        >
                          <Text style={styles.suggestionText}>{s.label}</Text>
                          <Text style={styles.suggestionTag}>
                            {s.source === "pending" ? "Pendiente" : "Surtido"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}

                  {!nameHasFocus && duplicatePendingTarget ? (
                    <View style={styles.duplicateCard}>
                      <Text style={styles.duplicateTitle}>Este producto ya está pendiente</Text>
                      <Text style={styles.duplicateText}>
                        Evita recapturarlo. Puedes editar el pendiente o surtirlo.
                      </Text>
                      <View style={styles.row}>
                        <Pressable
                          onPress={() => startEditingPendingItem(duplicatePendingTarget)}
                          style={styles.inlineButton}
                        >
                          <Text style={styles.inlineButtonText}>Editar pendiente</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openSupplyModal(duplicatePendingTarget)}
                          style={styles.inlineButtonSecondary}
                        >
                          <Text style={styles.inlineButtonSecondaryText}>Surtir ahora</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {prefillHintText ? (
                    <View style={styles.prefillHintCard}>
                      <Text style={styles.prefillHintText}>{prefillHintText}</Text>
                      {preferredStoreNameDraft ? (
                        <Text style={styles.prefillHintStoreText}>
                          Tienda sugerida: {preferredStoreNameDraft}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={styles.row}>
                    <TextInput
                      placeholder="Cantidad (ej. 1)"
                      placeholderTextColor="#94a3b8"
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      style={[styles.input, styles.rowField]}
                    />
                    <TextInput
                      placeholder="Precio estimado"
                      placeholderTextColor="#94a3b8"
                      value={estimatedPrice}
                      onChangeText={setEstimatedPrice}
                      keyboardType="decimal-pad"
                      style={[styles.input, styles.rowField]}
                    />
                  </View>
                  <View style={styles.row}>
                    <Pressable
                      onPress={handleAddOrUpdateItem}
                      disabled={!canSubmitItem}
                      style={[
                        styles.addButton,
                        !canSubmitItem && styles.addButtonDisabled,
                        styles.rowField
                      ]}
                    >
                      <Text style={styles.addButtonText}>
                        {editingItemId ? "Guardar cambios" : "Agregar"}
                      </Text>
                    </Pressable>
                    {editingItemId ? (
                      <Pressable
                        onPress={() => {
                          setEditingItemId(null);
                          setSelectedPendingSuggestionId(null);
                          setPrefillHintText("");
                          setPreferredStoreIdDraft("");
                          setPreferredStoreNameDraft("");
                          setName("");
                          setQuantity("");
                          setEstimatedPrice("");
                        }}
                        style={[styles.inlineButtonSecondary, styles.rowField]}
                      >
                        <Text style={styles.inlineButtonSecondaryText}>Cancelar edición</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.restockCard}>
                  <Text style={styles.restockTitle}>Reposición rápida</Text>
                  <Text style={styles.restockText}>
                    Reagrega artículos surtidos para comprarlos otra vez sin recapturar.
                  </Text>
                  <Pressable
                    onPress={openRestockSelector}
                    disabled={purchaseHistory.length === 0 || busy}
                    style={[
                      styles.restockButton,
                      (purchaseHistory.length === 0 || busy) && styles.addButtonDisabled
                    ]}
                  >
                    <Text style={styles.restockButtonText}>Reponer desde surtidos</Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setActivityExpanded((v) => !v)}
                  style={[styles.activityCard, !activityExpanded && styles.activityCardCompact]}
                >
                  <View style={styles.activityHeaderRow}>
                    <Text style={styles.activityTitle}>Actividad reciente</Text>
                    <Text style={styles.activityToggleText}>
                      {activityExpanded ? "Ocultar" : "Ver más"}
                    </Text>
                  </View>
                  {events.length === 0 ? (
                    <Text style={styles.helper}>Aún no hay actividad.</Text>
                  ) : (
                    events
                      .slice(0, activityExpanded ? 8 : 1)
                      .map((event) => (
                        <Text key={event.id} style={styles.activityLine}>
                          {event.actorName} {event.type === "added" ? "agregó" : "surtió"}{" "}
                          {event.itemName} ({formatEventTime(event.createdAt)})
                        </Text>
                      ))
                  )}
                </Pressable>

                {readErrorText ? <Text style={styles.error}>{readErrorText}</Text> : null}
                {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
                {infoText ? <Text style={styles.info}>{infoText}</Text> : null}
              </>
            }
            ListEmptyComponent={
              loadingItems ? (
                <View style={styles.loadingBlock}>
                  <ActivityIndicator color="#0f766e" />
                  <Text style={styles.helper}>Sincronizando lista...</Text>
                </View>
              ) : (
                <Text style={styles.helper}>No hay artículos pendientes.</Text>
              )
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.itemCard,
                  recentlyRestockedIds.includes(item.id) && styles.itemCardHighlighted
                ]}
              >
                <View style={styles.itemContent}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    Cantidad: {item.quantity}
                    {item.estimatedPrice !== undefined ? ` | Estimado: $${item.estimatedPrice}` : ""}
                    {item.estimatedUnitPrice !== undefined
                      ? ` | Unitario: $${item.estimatedUnitPrice.toFixed(2)}`
                      : ""}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <Pressable onPress={() => startEditingPendingItem(item)} style={styles.editButton}>
                    <Text style={styles.editText}>Editar</Text>
                  </Pressable>
                  <Pressable onPress={() => openSupplyModal(item)} style={styles.doneButton}>
                    <Text style={styles.doneText}>Surtir</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={!!supplyItem} transparent animationType="slide" onRequestClose={closeSupplyModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalBodyContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalTitle}>Registrar surtido</Text>
              <Text style={styles.modalInfo}>Artículo: {supplyItem?.name}</Text>
              <Text style={styles.modalInfo}>Cantidad: {supplyItem?.quantity}</Text>
              {supplyItem?.preferredStoreName ? (
                <Text style={styles.modalInfo}>Tienda sugerida: {supplyItem.preferredStoreName}</Text>
              ) : null}

              <Text style={styles.modalLabel}>Tienda</Text>
              {stores.length === 0 ? (
                <Text style={styles.error}>Primero agrega una tienda al catálogo.</Text>
              ) : (
                <>
                  <TextInput
                    placeholder="Buscar tienda"
                    placeholderTextColor="#94a3b8"
                    value={supplyStoreQuery}
                    onChangeText={setSupplyStoreQuery}
                    style={styles.input}
                  />
                  {filteredSupplyStores.length === 0 ? (
                    <Text style={styles.helper}>No hay tiendas que coincidan con tu búsqueda.</Text>
                  ) : (
                    <ScrollView
                      style={styles.storeListScroll}
                      contentContainerStyle={styles.storeList}
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredSupplyStores.map((store) => (
                        <Pressable
                          key={store.id}
                          onPress={() => setSupplyStoreId(store.id)}
                          style={[styles.storeChip, supplyStoreId === store.id && styles.storeChipActive]}
                        >
                          <Text
                            style={[
                              styles.storeChipText,
                              supplyStoreId === store.id && styles.storeChipTextActive
                            ]}
                          >
                            {store.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}

              <Text style={styles.modalLabel}>Precio pagado</Text>
              <TextInput
                placeholder="Ej. 24.50"
                placeholderTextColor="#94a3b8"
                value={supplyPricePaid}
                onChangeText={setSupplyPricePaid}
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <Text style={styles.helper}>
                La época se asigna automáticamente según la fecha de compra y la tabla `seasons`.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable onPress={closeSupplyModal} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmSupply}
                disabled={!canConfirmSupply}
                style={[styles.modalConfirm, !canConfirmSupply && styles.addButtonDisabled]}
              >
                <Text style={styles.modalConfirmText}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={restockVisible}
        transparent
        animationType="slide"
        onRequestClose={closeRestockSelector}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reponer desde surtidos</Text>
            <Text style={styles.modalInfo}>
              Selecciona uno o varios artículos para regresarlos a pendientes.
            </Text>
            <TextInput
              placeholder="Buscar artículo surtido"
              placeholderTextColor="#94a3b8"
              value={restockSearch}
              onChangeText={setRestockSearch}
              style={styles.input}
            />
            <ScrollView
              style={styles.restockListScroll}
              contentContainerStyle={styles.restockList}
              keyboardShouldPersistTaps="handled"
            >
              {restockCandidates.length === 0 ? (
                <Text style={styles.helper}>No hay artículos surtidos para mostrar.</Text>
              ) : (
                restockCandidates.map((candidate) => {
                  const selected = restockSelectedKeys.includes(candidate.key);
                  return (
                    <Pressable
                      key={candidate.key}
                      onPress={() => toggleRestockSelection(candidate.key)}
                      style={[styles.restockRow, selected && styles.restockRowSelected]}
                    >
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                      <View style={styles.restockRowContent}>
                        <Text style={styles.restockRowTitle}>{candidate.name}</Text>
                        <Text style={styles.restockRowMeta}>
                          Última cantidad: {candidate.quantity}
                          {typeof candidate.lastPricePaid === "number"
                            ? ` | Último precio: $${candidate.lastPricePaid}`
                            : ""}
                          {candidate.lastStoreName ? ` | Tienda: ${candidate.lastStoreName}` : ""}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={closeRestockSelector} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => setRestockModeVisible(true)}
                disabled={restockSelectedCount === 0 || busy}
                style={[
                  styles.modalConfirm,
                  (restockSelectedCount === 0 || busy) && styles.addButtonDisabled
                ]}
              >
                <Text style={styles.modalConfirmText}>Continuar ({restockSelectedCount})</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={restockModeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestockModeVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modeCard}>
            <Text style={styles.modalTitle}>Precio en pendientes</Text>
            <Text style={styles.modalInfo}>
              ¿Quieres reponer estos artículos con su último precio o dejarlo en blanco?
            </Text>
            <Pressable
              onPress={() => addSelectedRestockItems(true)}
              disabled={busy}
              style={[styles.modePrimary, busy && styles.addButtonDisabled]}
            >
              <Text style={styles.modePrimaryText}>Con último precio</Text>
            </Pressable>
            <Pressable
              onPress={() => addSelectedRestockItems(false)}
              disabled={busy}
              style={[styles.modeSecondary, busy && styles.addButtonDisabled]}
            >
              <Text style={styles.modeSecondaryText}>Sin precio</Text>
            </Pressable>
            <Pressable
              onPress={() => setRestockModeVisible(false)}
              style={styles.modeBack}
              disabled={busy}
            >
              <Text style={styles.modeBackText}>Volver</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    fontSize: 14
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
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  rowField: {
    flex: 1
  },
  addButton: {
    marginTop: 4,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center"
  },
  addButtonDisabled: {
    opacity: 0.55
  },
  addButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    borderRadius: 10,
    overflow: "hidden"
  },
  suggestionRow: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  suggestionText: {
    color: "#1f2937",
    flex: 1
  },
  suggestionTag: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700"
  },
  duplicateCard: {
    borderWidth: 1,
    borderColor: "#f59e0b",
    backgroundColor: "#fff7ed",
    borderRadius: 10,
    padding: 10,
    gap: 6
  },
  duplicateTitle: {
    color: "#9a3412",
    fontWeight: "700"
  },
  duplicateText: {
    color: "#7c2d12"
  },
  prefillHintCard: {
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 10
  },
  prefillHintText: {
    color: "#166534",
    fontWeight: "600"
  },
  prefillHintStoreText: {
    marginTop: 4,
    color: "#166534",
    fontWeight: "700"
  },
  inlineButton: {
    borderRadius: 8,
    backgroundColor: "#1d4ed8",
    paddingVertical: 9,
    paddingHorizontal: 10
  },
  inlineButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  inlineButtonSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#94a3b8",
    paddingVertical: 9,
    paddingHorizontal: 10
  },
  inlineButtonSecondaryText: {
    color: "#334155",
    fontWeight: "700"
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 10
  },
  noticeText: {
    color: "#1e3a8a",
    fontWeight: "600"
  },
  activityCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    borderRadius: 12,
    padding: 10,
    gap: 4
  },
  activityCardCompact: {
    paddingBottom: 8
  },
  activityHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  activityTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  activityToggleText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 12
  },
  activityLine: {
    color: "#334155"
  },
  restockCard: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 10,
    gap: 7
  },
  restockTitle: {
    color: "#1e3a8a",
    fontWeight: "700"
  },
  restockText: {
    color: "#1e40af"
  },
  restockButton: {
    borderRadius: 8,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    alignItems: "center"
  },
  restockButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  error: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  info: {
    color: "#0f766e",
    fontWeight: "700"
  },
  list: {
    gap: 8,
    paddingBottom: 24
  },
  listContainer: {
    flex: 1
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  itemCardHighlighted: {
    borderColor: "#f59e0b",
    backgroundColor: "#fff7ed"
  },
  itemActions: {
    alignItems: "flex-end",
    gap: 8
  },
  itemContent: {
    flex: 1,
    gap: 2
  },
  itemName: {
    color: "#0f172a",
    fontWeight: "700",
    fontSize: 16
  },
  itemMeta: {
    color: "#475569"
  },
  doneButton: {
    borderRadius: 8,
    backgroundColor: "#1d4ed8",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  editButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#94a3b8",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#ffffff"
  },
  editText: {
    color: "#334155",
    fontWeight: "700"
  },
  doneText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  loadingBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12
  },
  helper: {
    color: "#64748b"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-end"
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 16,
    gap: 10,
    maxHeight: "90%"
  },
  modalBody: {
    maxHeight: 460
  },
  modalBodyContent: {
    gap: 10,
    paddingBottom: 6
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a"
  },
  modalInfo: {
    color: "#334155"
  },
  modalLabel: {
    color: "#0f172a",
    fontWeight: "700"
  },
  storeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  storeListScroll: {
    maxHeight: 180
  },
  storeChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  storeChipActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe"
  },
  storeChipText: {
    color: "#334155",
    fontWeight: "600"
  },
  storeChipTextActive: {
    color: "#1e40af"
  },
  restockListScroll: {
    maxHeight: 330
  },
  restockList: {
    gap: 8,
    paddingVertical: 2
  },
  restockRow: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#f8fbff",
    flexDirection: "row",
    gap: 8
  },
  restockRowSelected: {
    borderColor: "#1d4ed8",
    backgroundColor: "#dbeafe"
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#94a3b8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff"
  },
  checkboxSelected: {
    borderColor: "#1d4ed8",
    backgroundColor: "#1d4ed8"
  },
  checkboxMark: {
    color: "#ffffff",
    fontWeight: "700"
  },
  restockRowContent: {
    flex: 1,
    gap: 2
  },
  restockRowTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  restockRowMeta: {
    color: "#334155",
    fontSize: 12
  },
  modeCard: {
    marginHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 10
  },
  modePrimary: {
    borderRadius: 8,
    backgroundColor: "#0f766e",
    paddingVertical: 10,
    alignItems: "center"
  },
  modePrimaryText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  modeSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0f766e",
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#ffffff"
  },
  modeSecondaryText: {
    color: "#0f766e",
    fontWeight: "700"
  },
  modeBack: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 9,
    alignItems: "center"
  },
  modeBackText: {
    color: "#334155",
    fontWeight: "600"
  },
  modalActions: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8
  },
  modalCancel: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  modalCancelText: {
    color: "#334155",
    fontWeight: "600"
  },
  modalConfirm: {
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  modalConfirmText: {
    color: "#ffffff",
    fontWeight: "700"
  }
});
