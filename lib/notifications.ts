import { adminDb } from "@/utils/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"

export async function createNotification(
  userId: string,
  type: "xp_earned" | "badge_earned" | "level_up" | "streak_reminder" | "manager_nudge" | "team_alert" | "system" | "billing",
  title: string,
  body: string,
  actionUrl: string = "",
  metadata: any = {}
) {
  if (!userId) return

  // Determine standard emojis depending on notification type
  const emojis: Record<string, string> = {
    xp_earned: "⚡",
    badge_earned: "🏆",
    level_up: "🎉",
    streak_reminder: "🔥",
    manager_nudge: "📢",
    team_alert: "👥",
    billing: "💳",
    system: "⚙️"
  }

  const icon = emojis[type] || "🔔"

  try {
    await adminDb
      .collection("notifications")
      .doc(userId)
      .collection("items")
      .add({
        type,
        title,
        body,
        icon,
        isRead: false,
        actionUrl,
        metadata,
        createdAt: FieldValue.serverTimestamp()
      })
  } catch (err) {
    console.error("Error creating server notification:", err)
  }
}
