import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

export async function sendStageNotification({ userId, zoneId, title, body, safeMode = true }) {
  if (!userId) return { sent: false, error: "no-user" };

  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) return { sent: false, error: "no-profile" };

  const prefs = snapshot.data();
  const notification = prefs.notification || {};
  if (!notification.enabled) return { sent: false, error: "disabled" };

  const emailEnabled = notification.channels?.email === true;
  const smsEnabled = !safeMode && notification.channels?.sms === true;
  const emailTarget = emailEnabled && prefs.email ? prefs.email : null;
  const smsTarget = smsEnabled && prefs.phoneNumber ? prefs.phoneNumber : null;

  const channels = [];
  if (emailTarget) channels.push("email");
  if (smsTarget) channels.push("sms");
  if (channels.length === 0) channels.push("in-app");

  const notificationRef = await addDoc(collection(userRef, "notifications"), {
    title: title || "단계 변경 알림",
    body: body || "관심 구역 단계가 변경되었습니다.",
    zoneId: zoneId || null,
    channels,
    createdAt: serverTimestamp(),
    read: false,
    type: "stage-update",
  });

  const queueRef = await addDoc(collection(db, "notificationQueue"), {
    userId, zoneId: zoneId || null,
    title: title || "단계 변경 알림",
    body: body || "관심 구역 단계가 변경되었습니다.",
    channels,
    targets: { email: emailTarget, sms: smsTarget },
    createdAt: serverTimestamp(),
    status: "pending",
  });

  return { sent: true, channels, notificationId: notificationRef.id, queueId: queueRef.id };
}
