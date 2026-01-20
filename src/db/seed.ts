import { db } from "./index";
import {
  // Enums
  authProviderType,
  membershipRole,
  membershipStatus,
  groupIcon,
  colorName,
  discountMode,
  shareMode,
  settlementStatus,
  evidenceTarget,
  leaveRequestStatus,
  notificationType,
  activityAction,
  // Constants
  AUTH_PROVIDERS,
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  GROUP_ICONS,
  COLOR_NAMES,
  DISCOUNT_MODES,
  SHARE_MODES,
  SETTLEMENT_STATUSES,
  EVIDENCE_TARGETS,
  LEAVE_REQUEST_STATUSES,
  NOTIFICATION_TYPES,
  ACTIVITY_ACTIONS,
  // Tables
  currencies,
  plans,
  planFeatures,
} from "./schema";

async function seedEnums() {
  console.log("Seeding enum tables...");

  await db.insert(authProviderType).values(AUTH_PROVIDERS.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(membershipRole).values(MEMBERSHIP_ROLES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(membershipStatus).values(MEMBERSHIP_STATUSES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(groupIcon).values(GROUP_ICONS.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(colorName).values(COLOR_NAMES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(discountMode).values(DISCOUNT_MODES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(shareMode).values(SHARE_MODES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(settlementStatus).values(SETTLEMENT_STATUSES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(evidenceTarget).values(EVIDENCE_TARGETS.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(leaveRequestStatus).values(LEAVE_REQUEST_STATUSES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(notificationType).values(NOTIFICATION_TYPES.map((v) => ({ value: v }))).onConflictDoNothing();
  await db.insert(activityAction).values(ACTIVITY_ACTIONS.map((v) => ({ value: v }))).onConflictDoNothing();

  console.log("Enum tables seeded.");
}

async function seedCurrencies() {
  console.log("Seeding currencies...");

  await db
    .insert(currencies)
    .values([
      { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
      { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
      { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
      { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
      { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2 },
      { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2 },
      { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimals: 2 },
      { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimals: 0 },
      { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2 },
      { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0 },
      { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0 },
      { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimals: 2 },
      { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2 },
      { code: "TWD", name: "Taiwan Dollar", symbol: "NT$", decimals: 0 },
      { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
      { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2 },
      { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
    ])
    .onConflictDoNothing();

  console.log("Currencies seeded.");
}

async function seedPlans() {
  console.log("Seeding plans...");

  const freePlanId = "00000000-0000-0000-0000-000000000001";
  const proPlanId = "00000000-0000-0000-0000-000000000002";
  const teamPlanId = "00000000-0000-0000-0000-000000000003";

  await db
    .insert(plans)
    .values([
      { id: freePlanId, code: "free", name: "Free", priceCentsMonth: 0, adsEnabled: true },
      { id: proPlanId, code: "pro", name: "Pro", priceCentsMonth: 499, adsEnabled: false },
      { id: teamPlanId, code: "team", name: "Team", priceCentsMonth: 999, adsEnabled: false },
    ])
    .onConflictDoNothing();

  await db
    .insert(planFeatures)
    .values([
      // Free plan features
      { planId: freePlanId, key: "max_groups", intValue: 3 },
      { planId: freePlanId, key: "max_members_per_group", intValue: 10 },
      { planId: freePlanId, key: "ocr_enabled", boolValue: false },
      // Pro plan features
      { planId: proPlanId, key: "max_groups", intValue: 20 },
      { planId: proPlanId, key: "max_members_per_group", intValue: 50 },
      { planId: proPlanId, key: "ocr_enabled", boolValue: true },
      // Team plan features
      { planId: teamPlanId, key: "max_groups", intValue: -1 }, // unlimited
      { planId: teamPlanId, key: "max_members_per_group", intValue: -1 },
      { planId: teamPlanId, key: "ocr_enabled", boolValue: true },
      { planId: teamPlanId, key: "priority_support", boolValue: true },
    ])
    .onConflictDoNothing();

  console.log("Plans seeded.");
}

export async function seed() {
  console.log("Starting database seed...");

  await seedEnums();
  await seedCurrencies();
  await seedPlans();

  console.log("Database seed completed.");
}

// Run seed if called directly
seed().catch(console.error);
