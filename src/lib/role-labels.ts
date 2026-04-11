/**
 * Maps database role values to user-facing display labels.
 * The DB stores 'approved' but we display 'Member' in the UI.
 */
const ROLE_DISPLAY_LABELS: Record<string, string> = {
  approved: "Member",
  pending: "Pending",
  admin: "Admin",
  moderator: "Moderator",
  guest: "Guest",
  suspended: "Suspended",
  rejected: "Rejected",
};

export function roleLabel(role: string): string {
  return ROLE_DISPLAY_LABELS[role] ?? role;
}
