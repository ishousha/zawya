// Shared helper for displaying dependent age groups consistently
// across RSVP modal, guest list, CSV export, and reminder emails.

export type AgeGroupKey = "infant_0_3" | "child_4_12" | "youth_13_17" | "adult_18_plus" | "elder";

export const AGE_GROUP_LABELS: Record<AgeGroupKey, string> = {
  infant_0_3: "Infant (0-3)",
  child_4_12: "Child (4-12)",
  youth_13_17: "Youth (13-17)",
  adult_18_plus: "Adult (18+)",
  elder: "Elder",
};

export const AGE_GROUP_SHORT: Record<AgeGroupKey, string> = {
  infant_0_3: "Infant",
  child_4_12: "Child",
  youth_13_17: "Youth",
  adult_18_plus: "Adult",
  elder: "Elder",
};

/**
 * Derive an age group key for an attending_dependents entry.
 * Uses stored age_group first, then derives from age, then dependent_type === 'elder'.
 * Returns null if nothing can be determined.
 */
export function deriveAgeGroup(entry: {
  age_group?: string | null;
  age?: number | null;
  dependent_type?: string | null;
  type?: string | null;
}): AgeGroupKey | null {
  const ag = entry.age_group;
  if (ag === "infant_0_3" || ag === "child_4_12" || ag === "youth_13_17" || ag === "adult_18_plus" || ag === "elder") {
    return ag;
  }
  if (entry.dependent_type === "elder") return "elder";
  const age = entry.age;
  if (age != null) {
    if (age <= 3) return "infant_0_3";
    if (age <= 12) return "child_4_12";
    if (age <= 17) return "youth_13_17";
    return "adult_18_plus";
  }
  return null;
}

export function ageGroupLabel(entry: Parameters<typeof deriveAgeGroup>[0]): string {
  const key = deriveAgeGroup(entry);
  if (key) return AGE_GROUP_LABELS[key];
  if (entry.age != null) return `Age ${entry.age}`;
  return "Unknown";
}

export function ageGroupShort(entry: Parameters<typeof deriveAgeGroup>[0]): string {
  const key = deriveAgeGroup(entry);
  if (key) return AGE_GROUP_SHORT[key];
  if (entry.age != null) return `Age ${entry.age}`;
  return "Unknown";
}
