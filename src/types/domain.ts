export type UserRole = "admin" | "member";

export interface AppUser {
  uid: string;
  householdId: string;
  displayName: string;
  email: string;
  role: UserRole;
  approved: boolean;
  createdAt: string;
}

export interface ListItem {
  id: string;
  householdId: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit?: string;
  addedByUid: string;
  estimatedPrice?: number;
  estimatedUnitPrice?: number;
  status: "pending";
  createdAt: string;
  updatedAt: string;
}

export interface Purchase {
  id: string;
  householdId: string;
  listItemId?: string;
  name: string;
  normalizedName: string;
  quantity: number;
  unit?: string;
  pricePaid: number;
  unitPricePaid: number;
  storeId: string;
  storeName: string;
  purchasedByUid: string;
  purchasedAt: string;
  seasonId?: string;
}

export interface Season {
  id: string;
  householdId: string;
  name: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  active: boolean;
}
