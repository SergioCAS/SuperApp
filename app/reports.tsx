import { useEffect, useMemo, useRef, useState } from "react";
import { Stack } from "expo-router";
import {
  ActivityIndicator,
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
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

type UserProfile = {
  householdId?: string;
};

type UserInfo = {
  uid: string;
  displayName: string;
};

type PendingItem = {
  id: string;
  name: string;
  quantity: number;
  estimatedPrice?: number;
  estimatedUnitPrice?: number;
  addedByUid: string;
  createdAt?: Timestamp;
};

type PurchaseItem = {
  id: string;
  name: string;
  normalizedName: string;
  quantity: number;
  pricePaid: number;
  unitPricePaid: number;
  storeId: string;
  storeName: string;
  seasonId?: string;
  purchasedByUid: string;
  purchasedAt?: Timestamp;
};

type StoreOption = {
  id: string;
  name: string;
};

type SeasonOption = {
  id: string;
  name: string;
};

type TrendPoint = {
  dateKey: string;
  avgUnitPrice: number;
  purchasesCount: number;
};

type RecentStorePrice = {
  storeId: string;
  storeName: string;
  unitPricePaid: number;
  pricePaid: number;
  quantity: number;
  purchasedAt: Timestamp;
};

type ProductOption = {
  label: string;
  normalized: string;
};

type StoreSpend = {
  storeId: string;
  storeName: string;
  totalSpent: number;
  purchasesCount: number;
  totalQuantity: number;
};

type DateFieldKey =
  | "pendingFrom"
  | "pendingTo"
  | "suppliedFrom"
  | "suppliedTo"
  | "spendFrom"
  | "spendTo"
  | "budgetFrom"
  | "budgetTo"
  | "byuserFrom"
  | "byuserTo"
  | "additionsFrom"
  | "additionsTo";

type ReportKey = "pending" | "supplied" | "trend" | "best" | "spend" | "budget" | "byuser" | "additions";

type BudgetPeriod = "week" | "fortnight" | "month" | "custom";

function asTextError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseDateInput(value: string, endOfDay: boolean) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const [y, m, d] = trimmed.split("-").map((v) => Number(v));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return undefined;
  }
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isInRange(value: Timestamp | undefined, from?: Date, to?: Date) {
  if (!value) {
    return false;
  }
  const time = value.toDate().getTime();
  if (from && time < from.getTime()) {
    return false;
  }
  if (to && time > to.getTime()) {
    return false;
  }
  return true;
}

function formatMoney(value: number) {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2
  });
}

function formatDate(value?: Timestamp) {
  if (!value) {
    return "Sin fecha";
  }
  return value.toDate().toLocaleString("es-MX");
}

function computePeriodRange(
  period: BudgetPeriod,
  fromStr: string,
  toStr: string
): { from: Date; to: Date; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (period === "week") {
    const weekday = (now.getDay() + 6) % 7;
    const monday = new Date(year, month, day - weekday, 0, 0, 0, 0);
    const sunday = new Date(year, month, day - weekday + 6, 23, 59, 59, 999);
    const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    return { from: monday, to: sunday, label: `${fmt(monday)} – ${fmt(sunday)}` };
  }
  if (period === "fortnight") {
    const isFirst = day <= 15;
    const from = isFirst ? new Date(year, month, 1, 0, 0, 0, 0) : new Date(year, month, 16, 0, 0, 0, 0);
    const to = isFirst ? new Date(year, month, 15, 23, 59, 59, 999) : new Date(year, month + 1, 0, 23, 59, 59, 999);
    const mName = now.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    return { from, to, label: isFirst ? `1ª quincena de ${mName}` : `2ª quincena de ${mName}` };
  }
  if (period === "month") {
    const from = new Date(year, month, 1, 0, 0, 0, 0);
    const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { from, to, label: now.toLocaleDateString("es-MX", { month: "long", year: "numeric" }) };
  }
  // custom
  const from = parseDateInput(fromStr, false) ?? new Date(year, month, 1, 0, 0, 0, 0);
  const to = parseDateInput(toStr, true) ?? new Date(year, month + 1, 0, 23, 59, 59, 999);
  const fmt = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(auth?.currentUser ?? null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);

  const [pendingFrom, setPendingFrom] = useState("");
  const [pendingTo, setPendingTo] = useState("");
  const [pendingArticleQuery, setPendingArticleQuery] = useState("");

  const [suppliedFrom, setSuppliedFrom] = useState("");
  const [suppliedTo, setSuppliedTo] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [trendArticleQuery, setTrendArticleQuery] = useState("");
  const [trendSelectedStoreIds, setTrendSelectedStoreIds] = useState<string[]>([]);
  const [bestPriceArticleQuery, setBestPriceArticleQuery] = useState("");
  const [spendFrom, setSpendFrom] = useState("");
  const [spendTo, setSpendTo] = useState("");
  const [spendSeasonId, setSpendSeasonId] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>("month");
  const [budgetFrom, setBudgetFrom] = useState("");
  const [budgetTo, setBudgetTo] = useState("");
  const [byuserPeriod, setByuserPeriod] = useState<BudgetPeriod>("month");
  const [byuserFrom, setByuserFrom] = useState("");
  const [byuserTo, setByuserTo] = useState("");
  const [byuserFilter, setByuserFilter] = useState(""); // "" = todos
  const [additionsPeriod, setAdditionsPeriod] = useState<BudgetPeriod>("month");
  const [additionsFrom, setAdditionsFrom] = useState("");
  const [additionsTo, setAdditionsTo] = useState("");
  const [additionsFilter, setAdditionsFilter] = useState(""); // "" = todos
  const [householdUsers, setHouseholdUsers] = useState<UserInfo[]>([]);
  const [activeReport, setActiveReport] = useState<ReportKey>("pending");
  const [openDateField, setOpenDateField] = useState<DateFieldKey | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [activeAutocomplete, setActiveAutocomplete] = useState<
    "pending" | "supplied" | "trend" | "best" | null
  >(null);

  const reportMenuOptions: Array<{ key: ReportKey; label: string }> = [
    { key: "pending", label: "Pendientes" },
    { key: "supplied", label: "Surtidos" },
    { key: "trend", label: "Tendencia" },
    { key: "best", label: "Mejor precio" },
    { key: "spend", label: "Gasto" },
    { key: "budget", label: "Mi gasto" },
    { key: "byuser", label: "Por usuario" },
    { key: "additions", label: "Adiciones" }
  ];

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

  function getDateFieldValue(field: DateFieldKey) {
    switch (field) {
      case "pendingFrom":
        return pendingFrom;
      case "pendingTo":
        return pendingTo;
      case "suppliedFrom":
        return suppliedFrom;
      case "suppliedTo":
        return suppliedTo;
      case "spendFrom":
        return spendFrom;
      case "spendTo":
        return spendTo;
      case "budgetFrom":
        return budgetFrom;
      case "budgetTo":
        return budgetTo;
      case "byuserFrom":
        return byuserFrom;
      case "byuserTo":
        return byuserTo;
      case "additionsFrom":
        return additionsFrom;
      case "additionsTo":
        return additionsTo;
      default:
        return "";
    }
  }

  function setDateFieldValue(field: DateFieldKey, value: string) {
    switch (field) {
      case "pendingFrom":
        setPendingFrom(value);
        return;
      case "pendingTo":
        setPendingTo(value);
        return;
      case "suppliedFrom":
        setSuppliedFrom(value);
        return;
      case "suppliedTo":
        setSuppliedTo(value);
        return;
      case "spendFrom":
        setSpendFrom(value);
        return;
      case "spendTo":
        setSpendTo(value);
        return;
      case "budgetFrom":
        setBudgetFrom(value);
        return;
      case "budgetTo":
        setBudgetTo(value);
        return;
      case "byuserFrom":
        setByuserFrom(value);
        return;
      case "byuserTo":
        setByuserTo(value);
        return;
      case "additionsFrom":
        setAdditionsFrom(value);
        return;
      case "additionsTo":
        setAdditionsTo(value);
        return;
      default:
        return;
    }
  }

  function openCalendarForField(field: DateFieldKey) {
    const selectedDate = parseDateInput(getDateFieldValue(field), false) ?? new Date();
    setCalendarMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setOpenDateField(field);
  }

  const selectedCalendarDate = useMemo(() => {
    if (!openDateField) {
      return undefined;
    }
    return parseDateInput(getDateFieldValue(openDateField), false);
  }, [openDateField, pendingFrom, pendingTo, suppliedFrom, suppliedTo, spendFrom, spendTo, budgetFrom, budgetTo, byuserFrom, byuserTo, additionsFrom, additionsTo]);

  const calendarTitle = useMemo(() => {
    return calendarMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  }, [calendarMonth]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekdayMondayFirst = (firstDay.getDay() + 6) % 7;

    const cells: Array<{ key: string; date: Date | null }> = [];
    for (let i = 0; i < firstWeekdayMondayFirst; i += 1) {
      cells.push({ key: `empty-${i}`, date: null });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ key: `day-${day}`, date: new Date(year, month, day) });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `tail-${cells.length}`, date: null });
    }
    return cells;
  }, [calendarMonth]);

  function handlePickCalendarDate(value: Date) {
    if (!openDateField) {
      return;
    }
    setDateFieldValue(openDateField, formatDateInput(value));
    setOpenDateField(null);
  }

  useEffect(() => {
    if (!householdId) {
      setPendingItems([]);
      setPurchases([]);
      setStores([]);
      setSeasons([]);
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    setErrorText("");

    const pendingRef = collection(db, "households", householdId, "list_items");
    const purchasesRef = collection(db, "households", householdId, "purchases");
    const storesRef = collection(db, "households", householdId, "stores_catalog");
    const seasonsRef = collection(db, "households", householdId, "seasons");

    const unsubPending = onSnapshot(
      query(pendingRef, orderBy("createdAt", "desc")),
      (snap) => {
        setPendingItems(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: String(data.name ?? ""),
              quantity: Number(data.quantity ?? 0),
              estimatedPrice:
                typeof data.estimatedPrice === "number" ? data.estimatedPrice : undefined,
              estimatedUnitPrice:
                typeof data.estimatedUnitPrice === "number" ? data.estimatedUnitPrice : undefined,
              addedByUid: String(data.addedByUid ?? ""),
              createdAt: data.createdAt as Timestamp | undefined
            };
          })
        );
        setLoadingData(false);
      },
      (error) => {
        setErrorText(asTextError(error));
        setLoadingData(false);
      }
    );

    const unsubPurchases = onSnapshot(
      query(purchasesRef, orderBy("purchasedAt", "desc")),
      (snap) => {
        setPurchases(
          snap.docs.map((d) => {
            const data = d.data();
            const name = String(data.name ?? "");
            return {
              id: d.id,
              name,
              normalizedName: String(data.normalizedName ?? normalizeName(name)),
              quantity: Number(data.quantity ?? 0),
              pricePaid: Number(data.pricePaid ?? 0),
              unitPricePaid: Number(data.unitPricePaid ?? 0),
              storeId: String(data.storeId ?? ""),
              storeName: String(data.storeName ?? ""),
              seasonId: typeof data.seasonId === "string" ? data.seasonId : undefined,
              purchasedByUid: String(data.purchasedByUid ?? ""),
              purchasedAt: data.purchasedAt as Timestamp | undefined
            };
          })
        );
      },
      (error) => {
        setErrorText(asTextError(error));
      }
    );

    const unsubStores = onSnapshot(query(storesRef, orderBy("normalizedName", "asc")), (snap) => {
      setStores(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? "")
        }))
      );
    });

    const unsubSeasons = onSnapshot(query(seasonsRef, orderBy("name", "asc")), (snap) => {
      setSeasons(
        snap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? "")
        }))
      );
    });

    const usersRef = collection(db, "users");
    const unsubUsers = onSnapshot(
      query(usersRef, where("householdId", "==", householdId)),
      (snap) => {
        setHouseholdUsers(
          snap.docs.map((d) => ({
            uid: d.id,
            displayName: String(d.data().displayName ?? d.data().email ?? d.id)
          }))
        );
      }
    );

    return () => {
      unsubPending();
      unsubPurchases();
      unsubStores();
      unsubSeasons();
      unsubUsers();
    };
  }, [householdId]);

  const pendingFromDate = useMemo(() => parseDateInput(pendingFrom, false), [pendingFrom]);
  const pendingToDate = useMemo(() => parseDateInput(pendingTo, true), [pendingTo]);
  const suppliedFromDate = useMemo(() => parseDateInput(suppliedFrom, false), [suppliedFrom]);
  const suppliedToDate = useMemo(() => parseDateInput(suppliedTo, true), [suppliedTo]);
  const spendFromDate = useMemo(() => parseDateInput(spendFrom, false), [spendFrom]);
  const spendToDate = useMemo(() => parseDateInput(spendTo, true), [spendTo]);

  const productOptions = useMemo(() => {
    const byNormalized = new Map<string, ProductOption>();
    for (const item of pendingItems) {
      const normalized = normalizeName(item.name);
      if (!normalized || byNormalized.has(normalized)) {
        continue;
      }
      byNormalized.set(normalized, { label: item.name, normalized });
    }
    for (const item of purchases) {
      if (!item.normalizedName || byNormalized.has(item.normalizedName)) {
        continue;
      }
      byNormalized.set(item.normalizedName, {
        label: item.name,
        normalized: item.normalizedName
      });
    }
    return Array.from(byNormalized.values()).sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [pendingItems, purchases]);

  const pendingSuggestions = useMemo(() => {
    const q = normalizeName(pendingArticleQuery);
    if (!q || activeAutocomplete !== "pending") {
      return [] as ProductOption[];
    }
    return productOptions.filter((opt) => opt.normalized.includes(q)).slice(0, 6);
  }, [activeAutocomplete, pendingArticleQuery, productOptions]);

  const suppliedSuggestions = useMemo(() => {
    const q = normalizeName(articleQuery);
    if (!q || activeAutocomplete !== "supplied") {
      return [] as ProductOption[];
    }
    return productOptions.filter((opt) => opt.normalized.includes(q)).slice(0, 6);
  }, [activeAutocomplete, articleQuery, productOptions]);

  const trendSuggestions = useMemo(() => {
    const q = normalizeName(trendArticleQuery);
    if (!q || activeAutocomplete !== "trend") {
      return [] as ProductOption[];
    }
    return productOptions.filter((opt) => opt.normalized.includes(q)).slice(0, 6);
  }, [activeAutocomplete, productOptions, trendArticleQuery]);

  const bestSuggestions = useMemo(() => {
    const q = normalizeName(bestPriceArticleQuery);
    if (!q || activeAutocomplete !== "best") {
      return [] as ProductOption[];
    }
    return productOptions.filter((opt) => opt.normalized.includes(q)).slice(0, 6);
  }, [activeAutocomplete, bestPriceArticleQuery, productOptions]);

  const filteredPending = useMemo(() => {
    const normalizedQuery = normalizeName(pendingArticleQuery);
    return pendingItems.filter((item) => {
      if (!isInRange(item.createdAt, pendingFromDate, pendingToDate)) {
        return false;
      }
      if (normalizedQuery && !normalizeName(item.name).includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [pendingArticleQuery, pendingFromDate, pendingItems, pendingToDate]);

  const pendingSummary = useMemo(() => {
    let totalEstimated = 0;
    let totalQuantity = 0;
    for (const item of filteredPending) {
      totalQuantity += item.quantity;
      if (typeof item.estimatedPrice === "number") {
        totalEstimated += item.estimatedPrice;
      } else if (typeof item.estimatedUnitPrice === "number") {
        totalEstimated += item.estimatedUnitPrice * item.quantity;
      }
    }
    return { totalEstimated, totalQuantity };
  }, [filteredPending]);

  const filteredSupplied = useMemo(() => {
    const normalizedQuery = normalizeName(articleQuery);
    return purchases.filter((item) => {
      if (!isInRange(item.purchasedAt, suppliedFromDate, suppliedToDate)) {
        return false;
      }
      if (selectedStoreId && item.storeId !== selectedStoreId) {
        return false;
      }
      if (selectedSeasonId === "__none__") {
        if (item.seasonId) {
          return false;
        }
      } else if (selectedSeasonId && item.seasonId !== selectedSeasonId) {
        return false;
      }
      if (normalizedQuery && !item.normalizedName.includes(normalizedQuery)) {
        return false;
      }
      return true;
    });
  }, [articleQuery, purchases, selectedSeasonId, selectedStoreId, suppliedFromDate, suppliedToDate]);

  const suppliedSummary = useMemo(() => {
    const totalSpent = filteredSupplied.reduce((acc, item) => acc + item.pricePaid, 0);
    const totalQuantity = filteredSupplied.reduce((acc, item) => acc + item.quantity, 0);
    return {
      totalSpent,
      totalQuantity,
      avgTicket: filteredSupplied.length > 0 ? totalSpent / filteredSupplied.length : 0
    };
  }, [filteredSupplied]);

  const trendPoints = useMemo(() => {
    const article = normalizeName(trendArticleQuery);
    if (!article) {
      return [] as TrendPoint[];
    }

    const matches = purchases.filter((item) => {
      if (!item.normalizedName.includes(article)) {
        return false;
      }
      if (trendSelectedStoreIds.length > 0 && !trendSelectedStoreIds.includes(item.storeId)) {
        return false;
      }
      return !!item.purchasedAt;
    });

    const grouped = new Map<string, { totalUnitPrice: number; count: number }>();
    for (const item of matches) {
      const date = item.purchasedAt!.toDate();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`;
      const bucket = grouped.get(key) ?? { totalUnitPrice: 0, count: 0 };
      bucket.totalUnitPrice += item.unitPricePaid;
      bucket.count += 1;
      grouped.set(key, bucket);
    }

    return Array.from(grouped.entries())
      .map(([dateKey, value]) => ({
        dateKey,
        avgUnitPrice: value.totalUnitPrice / value.count,
        purchasesCount: value.count
      }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [purchases, trendArticleQuery, trendSelectedStoreIds]);

  const trendSummary = useMemo(() => {
    if (trendPoints.length === 0) {
      return null;
    }
    const prices = trendPoints.map((point) => point.avgUnitPrice);
    const total = prices.reduce((acc, value) => acc + value, 0);
    return {
      avg: total / prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  }, [trendPoints]);

  const trendMaxPrice = useMemo(() => {
    if (trendPoints.length === 0) {
      return 0;
    }
    return Math.max(...trendPoints.map((point) => point.avgUnitPrice));
  }, [trendPoints]);

  function toggleTrendStore(storeId: string) {
    setTrendSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  }

  const recentPriceByStore = useMemo(() => {
    const article = normalizeName(bestPriceArticleQuery);
    if (!article) {
      return [] as RecentStorePrice[];
    }
    const filtered = purchases.filter(
      (item) => !!item.purchasedAt && item.normalizedName.includes(article)
    );
    const latestByStore = new Map<string, RecentStorePrice>();
    for (const item of filtered) {
      const existing = latestByStore.get(item.storeId);
      if (!existing || item.purchasedAt!.toDate().getTime() > existing.purchasedAt.toDate().getTime()) {
        latestByStore.set(item.storeId, {
          storeId: item.storeId,
          storeName: item.storeName,
          unitPricePaid: item.unitPricePaid,
          pricePaid: item.pricePaid,
          quantity: item.quantity,
          purchasedAt: item.purchasedAt!
        });
      }
    }
    return Array.from(latestByStore.values()).sort((a, b) => a.unitPricePaid - b.unitPricePaid);
  }, [bestPriceArticleQuery, purchases]);

  const bestRecentStore = useMemo(() => {
    if (recentPriceByStore.length === 0) {
      return null;
    }
    return recentPriceByStore[0];
  }, [recentPriceByStore]);

  const spendByStoreRows = useMemo(() => {
    const grouped = new Map<string, StoreSpend>();
    for (const item of purchases) {
      if (!isInRange(item.purchasedAt, spendFromDate, spendToDate)) {
        continue;
      }
      if (spendSeasonId === "__none__") {
        if (item.seasonId) {
          continue;
        }
      } else if (spendSeasonId && item.seasonId !== spendSeasonId) {
        continue;
      }

      const current = grouped.get(item.storeId) ?? {
        storeId: item.storeId,
        storeName: item.storeName || "Sin tienda",
        totalSpent: 0,
        purchasesCount: 0,
        totalQuantity: 0
      };
      current.totalSpent += item.pricePaid;
      current.purchasesCount += 1;
      current.totalQuantity += item.quantity;
      grouped.set(item.storeId, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [purchases, spendFromDate, spendSeasonId, spendToDate]);

  const spendSummary = useMemo(() => {
    const totalSpent = spendByStoreRows.reduce((acc, row) => acc + row.totalSpent, 0);
    const purchasesCount = spendByStoreRows.reduce((acc, row) => acc + row.purchasesCount, 0);
    return { totalSpent, purchasesCount };
  }, [spendByStoreRows]);

  const budgetRange = useMemo(
    () => computePeriodRange(budgetPeriod, budgetFrom, budgetTo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budgetPeriod, budgetFrom, budgetTo]
  );

  const budgetPurchases = useMemo(() => {
    return purchases.filter((item) =>
      isInRange(item.purchasedAt, budgetRange.from, budgetRange.to)
    );
  }, [purchases, budgetRange]);

  const budgetSummary = useMemo(() => {
    const totalSpent = budgetPurchases.reduce((acc, item) => acc + item.pricePaid, 0);
    const totalQuantity = budgetPurchases.reduce((acc, item) => acc + item.quantity, 0);
    return { totalSpent, totalQuantity, count: budgetPurchases.length };
  }, [budgetPurchases]);

  const budgetByStore = useMemo(() => {
    const grouped = new Map<string, StoreSpend>();
    for (const item of budgetPurchases) {
      const current = grouped.get(item.storeId) ?? {
        storeId: item.storeId,
        storeName: item.storeName || "Sin tienda",
        totalSpent: 0,
        purchasesCount: 0,
        totalQuantity: 0
      };
      current.totalSpent += item.pricePaid;
      current.purchasesCount += 1;
      current.totalQuantity += item.quantity;
      grouped.set(item.storeId, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [budgetPurchases]);

  const budgetByDay = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of budgetPurchases) {
      if (!item.purchasedAt) continue;
      const d = item.purchasedAt.toDate();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      grouped.set(key, (grouped.get(key) ?? 0) + item.pricePaid);
    }
    return Array.from(grouped.entries())
      .map(([day, total]) => ({ day, total }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [budgetPurchases]);

  const budgetMaxStore = useMemo(
    () => (budgetByStore.length > 0 ? budgetByStore[0].totalSpent : 0),
    [budgetByStore]
  );

  const budgetMaxDay = useMemo(
    () => (budgetByDay.length > 0 ? Math.max(...budgetByDay.map((d) => d.total)) : 0),
    [budgetByDay]
  );

  // ── Por usuario (compras) ──────────────────────────────────────────
  const byuserRange = useMemo(
    () => computePeriodRange(byuserPeriod, byuserFrom, byuserTo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byuserPeriod, byuserFrom, byuserTo]
  );

  const byuserPurchases = useMemo(
    () => purchases.filter((p) => isInRange(p.purchasedAt, byuserRange.from, byuserRange.to)),
    [purchases, byuserRange]
  );

  type UserPurchaseSummary = {
    uid: string;
    displayName: string;
    totalSpent: number;
    count: number;
    totalQuantity: number;
    items: PurchaseItem[];
  };

  const byuserRows = useMemo((): UserPurchaseSummary[] => {
    const grouped = new Map<string, UserPurchaseSummary>();
    for (const p of byuserPurchases) {
      const uid = p.purchasedByUid || "desconocido";
      const userInfo = householdUsers.find((u) => u.uid === uid);
      const displayName = userInfo?.displayName ?? uid;
      const current = grouped.get(uid) ?? { uid, displayName, totalSpent: 0, count: 0, totalQuantity: 0, items: [] };
      current.totalSpent += p.pricePaid;
      current.count += 1;
      current.totalQuantity += p.quantity;
      current.items.push(p);
      grouped.set(uid, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [byuserPurchases, householdUsers]);

  const byuserFiltered = useMemo(
    () => (byuserFilter ? byuserRows.filter((r) => r.uid === byuserFilter) : byuserRows),
    [byuserRows, byuserFilter]
  );

  const byuserTotal = useMemo(
    () => byuserFiltered.reduce((acc, r) => acc + r.totalSpent, 0),
    [byuserFiltered]
  );

  const byuserMaxSpent = useMemo(
    () => (byuserRows.length > 0 ? byuserRows[0].totalSpent : 0),
    [byuserRows]
  );

  // ── Adiciones por usuario ──────────────────────────────────────────
  const additionsRange = useMemo(
    () => computePeriodRange(additionsPeriod, additionsFrom, additionsTo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [additionsPeriod, additionsFrom, additionsTo]
  );

  const additionsFiltered = useMemo(
    () => pendingItems.filter((item) => isInRange(item.createdAt, additionsRange.from, additionsRange.to)),
    [pendingItems, additionsRange]
  );

  type UserAdditionSummary = {
    uid: string;
    displayName: string;
    count: number;
    totalQuantity: number;
    items: PendingItem[];
  };

  const additionsByUser = useMemo((): UserAdditionSummary[] => {
    const grouped = new Map<string, UserAdditionSummary>();
    for (const item of additionsFiltered) {
      const uid = item.addedByUid || "desconocido";
      const userInfo = householdUsers.find((u) => u.uid === uid);
      const displayName = userInfo?.displayName ?? uid;
      const current = grouped.get(uid) ?? { uid, displayName, count: 0, totalQuantity: 0, items: [] };
      current.count += 1;
      current.totalQuantity += item.quantity;
      current.items.push(item);
      grouped.set(uid, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [additionsFiltered, householdUsers]);

  const additionsUserFiltered = useMemo(
    () => (additionsFilter ? additionsByUser.filter((r) => r.uid === additionsFilter) : additionsByUser),
    [additionsByUser, additionsFilter]
  );

  const additionsMaxCount = useMemo(
    () => (additionsByUser.length > 0 ? additionsByUser[0].count : 0),
    [additionsByUser]
  );

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
      <Stack.Screen options={{ title: "Reportes" }} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: 28 + insets.bottom }]}
      >
        <Text style={styles.title}>Reportes</Text>
        <Text style={styles.subtitle}>Hogar: {householdId || "Sin configurar"}</Text>

        {!householdId ? (
          <View style={styles.warnCard}>
            <Text style={styles.warnTitle}>Falta householdId en tu perfil</Text>
            <Text style={styles.warnText}>No se pueden generar reportes sin hogar asignado.</Text>
          </View>
        ) : null}

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <View style={styles.menuCard}>
          <Text style={styles.filterLabel}>Menú de reportes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {reportMenuOptions.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  setActiveReport(option.key);
                  setActiveAutocomplete(null);
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  });
                }}
                style={[styles.chip, activeReport === option.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, activeReport === option.key && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {activeReport === "pending" ? (
          <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1) Artículos pendientes de surtir</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => openCalendarForField("pendingFrom")}
              style={[styles.input, styles.field, styles.dateButton]}
            >
              <Text style={pendingFrom ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {pendingFrom || "Desde"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openCalendarForField("pendingTo")}
              style={[styles.input, styles.field, styles.dateButton]}
            >
              <Text style={pendingTo ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {pendingTo || "Hasta"}
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={pendingArticleQuery}
            onChangeText={setPendingArticleQuery}
            onFocus={() => setActiveAutocomplete("pending")}
            placeholder="Filtrar por artículo"
            style={styles.input}
          />
          {pendingSuggestions.length > 0 ? (
            <View style={styles.suggestionsBox}>
              {pendingSuggestions.map((suggestion) => (
                <Pressable
                  key={`pending-${suggestion.normalized}`}
                  onPress={() => {
                    setPendingArticleQuery(suggestion.label);
                    setActiveAutocomplete(null);
                  }}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.helper}>Total de artículos: {filteredPending.length}</Text>
          <Text style={styles.helper}>Cantidad total: {pendingSummary.totalQuantity}</Text>
          <Text style={styles.helper}>Monto estimado: {formatMoney(pendingSummary.totalEstimated)}</Text>

          {filteredPending.length === 0 ? (
            <Text style={styles.helper}>Sin pendientes para ese rango.</Text>
          ) : (
            filteredPending.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  Cantidad: {item.quantity}
                  {item.estimatedPrice !== undefined ? ` | Estimado: ${formatMoney(item.estimatedPrice)}` : ""}
                  {item.estimatedUnitPrice !== undefined
                    ? ` | Unitario: ${formatMoney(item.estimatedUnitPrice)}`
                    : ""}
                </Text>
                <Text style={styles.itemMeta}>Capturado: {formatDate(item.createdAt)}</Text>
              </View>
            ))
          )}
          </View>
        ) : null}

        {activeReport === "supplied" ? (
          <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2) Artículos surtidos</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => openCalendarForField("suppliedFrom")}
              style={[styles.input, styles.field, styles.dateButton]}
            >
              <Text style={suppliedFrom ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {suppliedFrom || "Desde"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openCalendarForField("suppliedTo")}
              style={[styles.input, styles.field, styles.dateButton]}
            >
              <Text style={suppliedTo ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {suppliedTo || "Hasta"}
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={articleQuery}
            onChangeText={setArticleQuery}
            onFocus={() => setActiveAutocomplete("supplied")}
            placeholder="Filtrar por artículo"
            style={styles.input}
          />
          {suppliedSuggestions.length > 0 ? (
            <View style={styles.suggestionsBox}>
              {suppliedSuggestions.map((suggestion) => (
                <Pressable
                  key={`supplied-${suggestion.normalized}`}
                  onPress={() => {
                    setArticleQuery(suggestion.label);
                    setActiveAutocomplete(null);
                  }}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.filterLabel}>Filtrar por tienda</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setSelectedStoreId("")}
              style={[styles.chip, !selectedStoreId && styles.chipActive]}
            >
              <Text style={[styles.chipText, !selectedStoreId && styles.chipTextActive]}>Todas</Text>
            </Pressable>
            {stores.map((store) => (
              <Pressable
                key={store.id}
                onPress={() => setSelectedStoreId(store.id)}
                style={[styles.chip, selectedStoreId === store.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedStoreId === store.id && styles.chipTextActive]}>
                  {store.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Filtrar por época</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setSelectedSeasonId("")}
              style={[styles.chip, !selectedSeasonId && styles.chipActive]}
            >
              <Text style={[styles.chipText, !selectedSeasonId && styles.chipTextActive]}>Todas</Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedSeasonId("__none__")}
              style={[styles.chip, selectedSeasonId === "__none__" && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedSeasonId === "__none__" && styles.chipTextActive
                ]}
              >
                Sin época
              </Text>
            </Pressable>
            {seasons.map((season) => (
              <Pressable
                key={season.id}
                onPress={() => setSelectedSeasonId(season.id)}
                style={[styles.chip, selectedSeasonId === season.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedSeasonId === season.id && styles.chipTextActive]}>
                  {season.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.helper}>Total de compras: {filteredSupplied.length}</Text>
          <Text style={styles.helper}>Cantidad total: {suppliedSummary.totalQuantity}</Text>
          <Text style={styles.helper}>Suma del periodo: {formatMoney(suppliedSummary.totalSpent)}</Text>
          <Text style={styles.helper}>Ticket promedio: {formatMoney(suppliedSummary.avgTicket)}</Text>
          {loadingData && filteredSupplied.length === 0 ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color="#0f766e" />
            </View>
          ) : null}

          {filteredSupplied.length === 0 ? (
            <Text style={styles.helper}>Sin surtidos para esos filtros.</Text>
          ) : (
            filteredSupplied.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{item.name}</Text>
                <Text style={styles.itemMeta}>Fecha: {formatDate(item.purchasedAt)}</Text>
                <Text style={styles.itemMeta}>Tienda: {item.storeName}</Text>
                <Text style={styles.itemMeta}>Cantidad: {item.quantity}</Text>
                <Text style={styles.itemMeta}>Unitario: {formatMoney(item.unitPricePaid)}</Text>
                <Text style={styles.itemMeta}>Total: {formatMoney(item.pricePaid)}</Text>
              </View>
            ))
          )}
          </View>
        ) : null}

        {activeReport === "trend" ? (
          <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3) Tendencia de precios por artículo</Text>
          <TextInput
            value={trendArticleQuery}
            onChangeText={setTrendArticleQuery}
            onFocus={() => setActiveAutocomplete("trend")}
            placeholder="Artículo (ej. Uvas)"
            style={styles.input}
          />
          {trendSuggestions.length > 0 ? (
            <View style={styles.suggestionsBox}>
              {trendSuggestions.map((suggestion) => (
                <Pressable
                  key={`trend-${suggestion.normalized}`}
                  onPress={() => {
                    setTrendArticleQuery(suggestion.label);
                    setActiveAutocomplete(null);
                  }}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.filterLabel}>Tiendas (puedes elegir varias)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setTrendSelectedStoreIds([])}
              style={[styles.chip, trendSelectedStoreIds.length === 0 && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  trendSelectedStoreIds.length === 0 && styles.chipTextActive
                ]}
              >
                Todas
              </Text>
            </Pressable>
            {stores.map((store) => {
              const selected = trendSelectedStoreIds.includes(store.id);
              return (
                <Pressable
                  key={store.id}
                  onPress={() => toggleTrendStore(store.id)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{store.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {trendSelectedStoreIds.length > 1 ? (
            <Text style={styles.helper}>
              Modo promedio multitienda activo ({trendSelectedStoreIds.length} tiendas).
            </Text>
          ) : null}

          {!trendArticleQuery.trim() ? (
            <Text style={styles.helper}>Escribe un artículo para ver su tendencia.</Text>
          ) : trendPoints.length === 0 ? (
            <Text style={styles.helper}>No hay compras para esos filtros.</Text>
          ) : (
            <>
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Gráfica de tendencia (precio unitario)</Text>
                {trendPoints.map((point) => {
                  const widthPct = trendMaxPrice > 0 ? (point.avgUnitPrice / trendMaxPrice) * 100 : 0;
                  return (
                    <View key={`chart-${point.dateKey}`} style={styles.chartRow}>
                      <Text style={styles.chartLabel}>{point.dateKey}</Text>
                      <View style={styles.chartTrack}>
                        <View style={[styles.chartBar, { width: `${Math.max(3, widthPct)}%` }]} />
                      </View>
                      <Text style={styles.chartValue}>{formatMoney(point.avgUnitPrice)}</Text>
                    </View>
                  );
                })}
              </View>

              {trendSummary ? (
                <Text style={styles.helper}>
                  Promedio general: {formatMoney(trendSummary.avg)} | Mín: {formatMoney(trendSummary.min)} | Máx:{" "}
                  {formatMoney(trendSummary.max)}
                </Text>
              ) : null}
              {trendPoints.map((point) => (
                <View key={point.dateKey} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>{point.dateKey}</Text>
                  <Text style={styles.itemMeta}>Precio unitario promedio: {formatMoney(point.avgUnitPrice)}</Text>
                  <Text style={styles.itemMeta}>Compras consideradas: {point.purchasesCount}</Text>
                </View>
              ))}
            </>
          )}
          </View>
        ) : null}

        {activeReport === "best" ? (
          <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4) Tienda más barata (compra más reciente)</Text>
          <TextInput
            value={bestPriceArticleQuery}
            onChangeText={setBestPriceArticleQuery}
            onFocus={() => setActiveAutocomplete("best")}
            placeholder="Artículo (ej. Aceite)"
            style={styles.input}
          />
          {bestSuggestions.length > 0 ? (
            <View style={styles.suggestionsBox}>
              {bestSuggestions.map((suggestion) => (
                <Pressable
                  key={`best-${suggestion.normalized}`}
                  onPress={() => {
                    setBestPriceArticleQuery(suggestion.label);
                    setActiveAutocomplete(null);
                  }}
                  style={styles.suggestionRow}
                >
                  <Text style={styles.suggestionText}>{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!bestPriceArticleQuery.trim() ? (
            <Text style={styles.helper}>Escribe un artículo para comparar tiendas.</Text>
          ) : recentPriceByStore.length === 0 ? (
            <Text style={styles.helper}>No hay compras registradas para ese artículo.</Text>
          ) : (
            <>
              {bestRecentStore ? (
                <View style={styles.bestCard}>
                  <Text style={styles.bestTitle}>Mejor opción actual</Text>
                  <Text style={styles.bestStore}>{bestRecentStore.storeName}</Text>
                  <Text style={styles.bestMeta}>
                    Unitario: {formatMoney(bestRecentStore.unitPricePaid)} | Total:{" "}
                    {formatMoney(bestRecentStore.pricePaid)}
                  </Text>
                  <Text style={styles.bestMeta}>
                    Cantidad: {bestRecentStore.quantity} | Fecha: {formatDate(bestRecentStore.purchasedAt)}
                  </Text>
                </View>
              ) : null}

              {recentPriceByStore.map((row, index) => (
                <View key={`best-${row.storeId}`} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>
                    {index + 1}. {row.storeName}
                  </Text>
                  <Text style={styles.itemMeta}>Unitario: {formatMoney(row.unitPricePaid)}</Text>
                  <Text style={styles.itemMeta}>Total: {formatMoney(row.pricePaid)}</Text>
                  <Text style={styles.itemMeta}>Cantidad: {row.quantity}</Text>
                  <Text style={styles.itemMeta}>Última compra: {formatDate(row.purchasedAt)}</Text>
                </View>
              ))}
            </>
          )}
          </View>
        ) : null}

        {activeReport === "budget" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>6) Mi gasto por periodo</Text>

            {/* Selector rápido de periodo */}
            <Text style={styles.filterLabel}>Periodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {(
                [
                  { key: "week", label: "Semana actual" },
                  { key: "fortnight", label: "Quincena actual" },
                  { key: "month", label: "Mes actual" },
                  { key: "custom", label: "Personalizado" }
                ] as Array<{ key: BudgetPeriod; label: string }>
              ).map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setBudgetPeriod(option.key)}
                  style={[styles.chip, budgetPeriod === option.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, budgetPeriod === option.key && styles.chipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Pickers de fecha solo si es personalizado */}
            {budgetPeriod === "custom" ? (
              <View style={styles.row}>
                <Pressable
                  onPress={() => openCalendarForField("budgetFrom")}
                  style={[styles.input, styles.field, styles.dateButton]}
                >
                  <Text style={budgetFrom ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {budgetFrom || "Desde"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => openCalendarForField("budgetTo")}
                  style={[styles.input, styles.field, styles.dateButton]}
                >
                  <Text style={budgetTo ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {budgetTo || "Hasta"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Etiqueta del periodo activo */}
            <Text style={styles.budgetPeriodLabel}>{budgetRange.label}</Text>

            {/* Tarjeta de total */}
            <View style={styles.budgetTotalCard}>
              <Text style={styles.budgetTotalLabel}>Total gastado</Text>
              <Text style={styles.budgetTotalAmount}>{formatMoney(budgetSummary.totalSpent)}</Text>
              <View style={styles.budgetTotalRow}>
                <Text style={styles.budgetTotalMeta}>{budgetSummary.count} compras</Text>
                <Text style={styles.budgetTotalMeta}>·</Text>
                <Text style={styles.budgetTotalMeta}>{budgetSummary.totalQuantity} artículos</Text>
              </View>
            </View>

            {budgetPurchases.length === 0 ? (
              <Text style={styles.helper}>Sin compras para este periodo.</Text>
            ) : (
              <>
                {/* Gráfica por tienda */}
                {budgetByStore.length > 0 ? (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Gasto por tienda</Text>
                    {budgetByStore.map((row) => {
                      const pct = budgetMaxStore > 0 ? (row.totalSpent / budgetMaxStore) * 100 : 0;
                      return (
                        <View key={`bs-${row.storeId}`} style={styles.chartRow}>
                          <Text style={styles.chartLabel} numberOfLines={1}>{row.storeName}</Text>
                          <View style={styles.chartTrack}>
                            <View style={[styles.chartBar, { width: `${Math.max(3, pct)}%` }]} />
                          </View>
                          <Text style={styles.chartValue}>{formatMoney(row.totalSpent)}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Gráfica por día */}
                {budgetByDay.length > 1 ? (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Gasto por día</Text>
                    {budgetByDay.map((row) => {
                      const pct = budgetMaxDay > 0 ? (row.total / budgetMaxDay) * 100 : 0;
                      const dayLabel = new Date(row.day + "T12:00:00").toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short"
                      });
                      return (
                        <View key={`bd-${row.day}`} style={styles.chartRow}>
                          <Text style={styles.chartLabel}>{dayLabel}</Text>
                          <View style={styles.chartTrack}>
                            <View style={[styles.chartBarDay, { width: `${Math.max(3, pct)}%` }]} />
                          </View>
                          <Text style={styles.chartValue}>{formatMoney(row.total)}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Detalle por tienda */}
                {budgetByStore.map((row, index) => {
                  const share = budgetSummary.totalSpent > 0 ? (row.totalSpent / budgetSummary.totalSpent) * 100 : 0;
                  return (
                    <View key={`bsd-${row.storeId}`} style={styles.itemCard}>
                      <Text style={styles.itemTitle}>{index + 1}. {row.storeName}</Text>
                      <Text style={styles.itemMeta}>Gasto: {formatMoney(row.totalSpent)} ({share.toFixed(1)}%)</Text>
                      <Text style={styles.itemMeta}>Compras: {row.purchasesCount} · Artículos: {row.totalQuantity}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ) : null}

        {activeReport === "spend" ? (
          <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>5) Gasto por tienda y periodo</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => openCalendarForField("spendFrom")}
              style={[styles.input, styles.field, styles.dateButton]}
            >
              <Text style={spendFrom ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {spendFrom || "Desde"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openCalendarForField("spendTo")}
              style={[styles.input, styles.field, styles.dateButton]}
            >
              <Text style={spendTo ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                {spendTo || "Hasta"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.filterLabel}>Filtrar por época</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            <Pressable
              onPress={() => setSpendSeasonId("")}
              style={[styles.chip, !spendSeasonId && styles.chipActive]}
            >
              <Text style={[styles.chipText, !spendSeasonId && styles.chipTextActive]}>Todas</Text>
            </Pressable>
            <Pressable
              onPress={() => setSpendSeasonId("__none__")}
              style={[styles.chip, spendSeasonId === "__none__" && styles.chipActive]}
            >
              <Text style={[styles.chipText, spendSeasonId === "__none__" && styles.chipTextActive]}>
                Sin época
              </Text>
            </Pressable>
            {seasons.map((season) => (
              <Pressable
                key={`spend-season-${season.id}`}
                onPress={() => setSpendSeasonId(season.id)}
                style={[styles.chip, spendSeasonId === season.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, spendSeasonId === season.id && styles.chipTextActive]}>
                  {season.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.helper}>Total del periodo: {formatMoney(spendSummary.totalSpent)}</Text>
          <Text style={styles.helper}>Compras registradas: {spendSummary.purchasesCount}</Text>

          {spendByStoreRows.length === 0 ? (
            <Text style={styles.helper}>No hay compras para el periodo seleccionado.</Text>
          ) : (
            spendByStoreRows.map((row, index) => {
              const share = spendSummary.totalSpent > 0 ? (row.totalSpent / spendSummary.totalSpent) * 100 : 0;
              const avgPerPurchase = row.purchasesCount > 0 ? row.totalSpent / row.purchasesCount : 0;
              return (
                <View key={`spend-${row.storeId}`} style={styles.itemCard}>
                  <Text style={styles.itemTitle}>
                    {index + 1}. {row.storeName}
                  </Text>
                  <Text style={styles.itemMeta}>Gasto total: {formatMoney(row.totalSpent)}</Text>
                  <Text style={styles.itemMeta}>Participación: {share.toFixed(1)}%</Text>
                  <Text style={styles.itemMeta}>Compras: {row.purchasesCount}</Text>
                  <Text style={styles.itemMeta}>Cantidad total: {row.totalQuantity}</Text>
                  <Text style={styles.itemMeta}>Ticket promedio: {formatMoney(avgPerPurchase)}</Text>
                </View>
              );
            })
          )}
          </View>
        ) : null}

        {/* ── Por usuario (compras) ───────────────────────────────── */}
        {activeReport === "byuser" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>7) Compras por usuario</Text>

            <Text style={styles.filterLabel}>Periodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {([ { key: "week", label: "Semana actual" }, { key: "fortnight", label: "Quincena actual" },
                  { key: "month", label: "Mes actual" }, { key: "custom", label: "Personalizado" }
              ] as Array<{ key: BudgetPeriod; label: string }>).map((opt) => (
                <Pressable key={opt.key} onPress={() => setByuserPeriod(opt.key)}
                  style={[styles.chip, byuserPeriod === opt.key && styles.chipActive]}>
                  <Text style={[styles.chipText, byuserPeriod === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {byuserPeriod === "custom" ? (
              <View style={styles.row}>
                <Pressable onPress={() => openCalendarForField("byuserFrom")}
                  style={[styles.input, styles.field, styles.dateButton]}>
                  <Text style={byuserFrom ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {byuserFrom || "Desde"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => openCalendarForField("byuserTo")}
                  style={[styles.input, styles.field, styles.dateButton]}>
                  <Text style={byuserTo ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {byuserTo || "Hasta"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.budgetPeriodLabel}>{byuserRange.label}</Text>

            <Text style={styles.filterLabel}>Usuario</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <Pressable onPress={() => setByuserFilter("")}
                style={[styles.chip, byuserFilter === "" && styles.chipActive]}>
                <Text style={[styles.chipText, byuserFilter === "" && styles.chipTextActive]}>Todos</Text>
              </Pressable>
              {householdUsers.map((u) => (
                <Pressable key={u.uid} onPress={() => setByuserFilter(u.uid)}
                  style={[styles.chip, byuserFilter === u.uid && styles.chipActive]}>
                  <Text style={[styles.chipText, byuserFilter === u.uid && styles.chipTextActive]}>{u.displayName}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {byuserPurchases.length === 0 ? (
              <Text style={styles.helper}>Sin compras en este periodo.</Text>
            ) : (
              <>
                {/* Resumen total del periodo */}
                <View style={styles.budgetTotalCard}>
                  <Text style={styles.budgetTotalLabel}>Total del periodo</Text>
                  <Text style={styles.budgetTotalAmount}>{formatMoney(byuserTotal)}</Text>
                  <View style={styles.budgetTotalRow}>
                    <Text style={styles.budgetTotalMeta}>{byuserPurchases.length} compras</Text>
                    <Text style={styles.budgetTotalMeta}>·</Text>
                    <Text style={styles.budgetTotalMeta}>{byuserFiltered.length === byuserRows.length ? byuserRows.length : 1} usuario(s)</Text>
                  </View>
                </View>

                {/* Barra comparativa por usuario */}
                {byuserRows.length > 1 && byuserFilter === "" ? (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Gasto por usuario</Text>
                    {byuserRows.map((row) => {
                      const pct = byuserMaxSpent > 0 ? (row.totalSpent / byuserMaxSpent) * 100 : 0;
                      return (
                        <View key={`bur-${row.uid}`} style={styles.chartRow}>
                          <Text style={styles.chartLabel} numberOfLines={1}>{row.displayName}</Text>
                          <View style={styles.chartTrack}>
                            <View style={[styles.chartBarUser, { width: `${Math.max(3, pct)}%` }]} />
                          </View>
                          <Text style={styles.chartValue}>{formatMoney(row.totalSpent)}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Detalle por usuario filtrado */}
                {byuserFiltered.map((row) => (
                  <View key={`bud-${row.uid}`} style={styles.userSection}>
                    <View style={styles.userSectionHeader}>
                      <Text style={styles.userSectionName}>{row.displayName}</Text>
                      <Text style={styles.userSectionTotal}>{formatMoney(row.totalSpent)}</Text>
                    </View>
                    <Text style={styles.userSectionMeta}>{row.count} compras · {row.totalQuantity} artículos</Text>
                    {row.items.map((p) => (
                      <View key={`bui-${p.id}`} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{p.name}</Text>
                        <Text style={styles.itemMeta}>Tienda: {p.storeName}</Text>
                        <Text style={styles.itemMeta}>Cantidad: {p.quantity} · Total: {formatMoney(p.pricePaid)}</Text>
                        <Text style={styles.itemMeta}>{formatDate(p.purchasedAt)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        ) : null}

        {/* ── Adiciones por usuario ──────────────────────────────── */}
        {activeReport === "additions" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>8) Adiciones a la lista por usuario</Text>

            <Text style={styles.filterLabel}>Periodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {([ { key: "week", label: "Semana actual" }, { key: "fortnight", label: "Quincena actual" },
                  { key: "month", label: "Mes actual" }, { key: "custom", label: "Personalizado" }
              ] as Array<{ key: BudgetPeriod; label: string }>).map((opt) => (
                <Pressable key={opt.key} onPress={() => setAdditionsPeriod(opt.key)}
                  style={[styles.chip, additionsPeriod === opt.key && styles.chipActive]}>
                  <Text style={[styles.chipText, additionsPeriod === opt.key && styles.chipTextActive]}>{opt.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {additionsPeriod === "custom" ? (
              <View style={styles.row}>
                <Pressable onPress={() => openCalendarForField("additionsFrom")}
                  style={[styles.input, styles.field, styles.dateButton]}>
                  <Text style={additionsFrom ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {additionsFrom || "Desde"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => openCalendarForField("additionsTo")}
                  style={[styles.input, styles.field, styles.dateButton]}>
                  <Text style={additionsTo ? styles.dateButtonText : styles.dateButtonPlaceholder}>
                    {additionsTo || "Hasta"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.budgetPeriodLabel}>{additionsRange.label}</Text>

            <Text style={styles.filterLabel}>Usuario</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <Pressable onPress={() => setAdditionsFilter("")}
                style={[styles.chip, additionsFilter === "" && styles.chipActive]}>
                <Text style={[styles.chipText, additionsFilter === "" && styles.chipTextActive]}>Todos</Text>
              </Pressable>
              {householdUsers.map((u) => (
                <Pressable key={u.uid} onPress={() => setAdditionsFilter(u.uid)}
                  style={[styles.chip, additionsFilter === u.uid && styles.chipActive]}>
                  <Text style={[styles.chipText, additionsFilter === u.uid && styles.chipTextActive]}>{u.displayName}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {additionsFiltered.length === 0 ? (
              <Text style={styles.helper}>Sin adiciones en este periodo.</Text>
            ) : (
              <>
                {/* Barra comparativa */}
                {additionsByUser.length > 1 && additionsFilter === "" ? (
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>Artículos agregados por usuario</Text>
                    {additionsByUser.map((row) => {
                      const pct = additionsMaxCount > 0 ? (row.count / additionsMaxCount) * 100 : 0;
                      return (
                        <View key={`adr-${row.uid}`} style={styles.chartRow}>
                          <Text style={styles.chartLabel} numberOfLines={1}>{row.displayName}</Text>
                          <View style={styles.chartTrack}>
                            <View style={[styles.chartBarAdditions, { width: `${Math.max(3, pct)}%` }]} />
                          </View>
                          <Text style={styles.chartValue}>{row.count} arts.</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {/* Detalle por usuario */}
                {additionsUserFiltered.map((row) => (
                  <View key={`add-${row.uid}`} style={styles.userSection}>
                    <View style={styles.userSectionHeader}>
                      <Text style={styles.userSectionName}>{row.displayName}</Text>
                      <Text style={styles.userSectionTotal}>{row.count} artículo{row.count !== 1 ? "s" : ""}</Text>
                    </View>
                    <Text style={styles.userSectionMeta}>Cantidad total: {row.totalQuantity}</Text>
                    {row.items.map((item) => (
                      <View key={`addi-${item.id}`} style={styles.itemCard}>
                        <Text style={styles.itemTitle}>{item.name}</Text>
                        <Text style={styles.itemMeta}>
                          Cantidad: {item.quantity}
                          {item.estimatedPrice !== undefined ? ` · Estimado: ${formatMoney(item.estimatedPrice)}` : ""}
                        </Text>
                        <Text style={styles.itemMeta}>Agregado: {formatDate(item.createdAt)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        ) : null}

      </ScrollView>
      <Modal visible={!!openDateField} transparent animationType="fade" onRequestClose={() => setOpenDateField(null)}>
        <Pressable style={styles.calendarOverlay} onPress={() => setOpenDateField(null)}>
          <Pressable style={styles.calendarCard} onPress={() => {}}>
            <View style={styles.calendarHeader}>
              <Pressable
                onPress={() =>
                  setCalendarMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
                style={styles.calendarNavButton}
              >
                <Text style={styles.calendarNavText}>{"<"}</Text>
              </Pressable>
              <Text style={styles.calendarMonthTitle}>{calendarTitle}</Text>
              <Pressable
                onPress={() =>
                  setCalendarMonth(
                    (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
                style={styles.calendarNavButton}
              >
                <Text style={styles.calendarNavText}>{">"}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarWeekRow}>
              {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((label) => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map((cell) => {
                const isSelected =
                  !!cell.date &&
                  !!selectedCalendarDate &&
                  formatDateInput(cell.date) === formatDateInput(selectedCalendarDate);
                return (
                  <Pressable
                    key={cell.key}
                    onPress={() => {
                      if (cell.date) {
                        handlePickCalendarDate(cell.date);
                      }
                    }}
                    disabled={!cell.date}
                    style={[
                      styles.calendarDayButton,
                      !cell.date && styles.calendarDayButtonDisabled,
                      isSelected && styles.calendarDayButtonSelected
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        !cell.date && styles.calendarDayTextDisabled,
                        isSelected && styles.calendarDayTextSelected
                      ]}
                    >
                      {cell.date ? cell.date.getDate() : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarActions}>
              <Pressable
                onPress={() => {
                  if (openDateField) {
                    setDateFieldValue(openDateField, "");
                  }
                  setOpenDateField(null);
                }}
                style={styles.calendarActionButton}
              >
                <Text style={styles.calendarActionText}>Limpiar</Text>
              </Pressable>
              <Pressable onPress={() => setOpenDateField(null)} style={styles.calendarActionButton}>
                <Text style={styles.calendarActionText}>Cerrar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
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
    padding: 16,
    gap: 12,
    paddingBottom: 28
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8
  },
  centerBlock: {
    paddingVertical: 8
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
  sectionCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  menuCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
    gap: 8
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800"
  },
  row: {
    flexDirection: "row",
    gap: 8
  },
  field: {
    flex: 1
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  dateButton: {
    justifyContent: "center",
    minHeight: 44
  },
  dateButtonText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  dateButtonPlaceholder: {
    color: "#94a3b8",
    fontWeight: "500"
  },
  suggestionsBox: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    overflow: "hidden"
  },
  suggestionRow: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0"
  },
  suggestionText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  filterLabel: {
    color: "#334155",
    fontWeight: "700"
  },
  chipsRow: {
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  chipActive: {
    borderColor: "#0f766e",
    backgroundColor: "#ccfbf1"
  },
  chipText: {
    color: "#334155",
    fontWeight: "600"
  },
  chipTextActive: {
    color: "#0f766e"
  },
  itemCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 2
  },
  itemTitle: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16
  },
  itemMeta: {
    color: "#334155"
  },
  bestCard: {
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 10,
    backgroundColor: "#ecfeff",
    padding: 10,
    gap: 2
  },
  bestTitle: {
    color: "#0f766e",
    fontWeight: "800"
  },
  bestStore: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800"
  },
  bestMeta: {
    color: "#155e75"
  },
  chartCard: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: "#f8fafc"
  },
  chartTitle: {
    color: "#0f172a",
    fontWeight: "700"
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  chartLabel: {
    width: 88,
    color: "#334155",
    fontSize: 12
  },
  chartTrack: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    overflow: "hidden"
  },
  chartBar: {
    height: "100%",
    backgroundColor: "#0f766e"
  },
  chartValue: {
    width: 90,
    textAlign: "right",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "600"
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    padding: 16
  },
  calendarCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    gap: 10
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  calendarNavButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    minWidth: 40,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc"
  },
  calendarNavText: {
    color: "#0f172a",
    fontWeight: "800"
  },
  calendarMonthTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "capitalize"
  },
  calendarWeekRow: {
    flexDirection: "row"
  },
  calendarWeekLabel: {
    width: "14.2857%",
    textAlign: "center",
    color: "#64748b",
    fontWeight: "700"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarDayButton: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10
  },
  calendarDayButtonDisabled: {
    opacity: 0
  },
  calendarDayButtonSelected: {
    backgroundColor: "#0f766e"
  },
  calendarDayText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  calendarDayTextDisabled: {
    color: "transparent"
  },
  calendarDayTextSelected: {
    color: "#ffffff",
    fontWeight: "800"
  },
  calendarActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10
  },
  calendarActionButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc"
  },
  calendarActionText: {
    color: "#0f172a",
    fontWeight: "700"
  },
  error: {
    color: "#b91c1c",
    fontWeight: "600"
  },
  budgetPeriodLabel: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "#f0fdfa",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10
  },
  budgetTotalCard: {
    borderWidth: 1,
    borderColor: "#99f6e4",
    borderRadius: 14,
    backgroundColor: "#f0fdfa",
    padding: 16,
    alignItems: "center",
    gap: 4
  },
  budgetTotalLabel: {
    color: "#0f766e",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  budgetTotalAmount: {
    color: "#0f172a",
    fontWeight: "900",
    fontSize: 36
  },
  budgetTotalRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center"
  },
  budgetTotalMeta: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600"
  },
  chartBarDay: {
    height: "100%",
    backgroundColor: "#6366f1"
  },
  chartBarUser: {
    height: "100%",
    backgroundColor: "#f59e0b"
  },
  chartBarAdditions: {
    height: "100%",
    backgroundColor: "#f43f5e"
  },
  userSection: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    gap: 6
  },
  userSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  userSectionName: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 15,
    flex: 1
  },
  userSectionTotal: {
    color: "#0f766e",
    fontWeight: "800",
    fontSize: 15
  },
  userSectionMeta: {
    color: "#64748b",
    fontSize: 13
  }
});
