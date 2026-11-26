"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, Check, ChevronDown } from "lucide-react";
import { getClient } from "@/lib/supabase";
import styles from "./ats-notification-center.module.css";

type Notification = { id: string; kind: string; title_vi: string; body_vi: string; title_en: string; body_en: string; created_at: string; read_at: string | null };

export default function AtsNotificationCenter({ locale }: { locale: "vi" | "en" }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { data, error: rpcError } = await getClient().rpc("ats_list_notifications");
      if (rpcError) throw rpcError;
      setItems(Array.isArray(data) ? data as Notification[] : []); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load notifications."); }
  }, []);
  useEffect(() => { void load(); const onFocus = () => void load(); window.addEventListener("focus",onFocus); return () => window.removeEventListener("focus",onFocus); },[load]);
  const unread = items.filter((item) => !item.read_at).length;
  async function markRead(item: Notification) {
    if (item.read_at) return;
    const { error: rpcError } = await getClient().rpc("ats_mark_notification_read", { p_notification_id: item.id });
    if (rpcError) { setError(locale === "en" ? "Could not mark this notification as read." : "Không đánh dấu đã đọc được."); return; }
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row));
  }
  return <div className={styles.root}>
    <button type="button" className={styles.trigger} aria-label={locale === "en" ? `Notifications, ${unread} unread` : `Thông báo, ${unread} chưa đọc`} aria-expanded={open} onClick={() => { setOpen((value) => !value); if (!open) void load(); }}>
      <Bell size={18}/>{unread > 0 && <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>}<ChevronDown size={13}/>
    </button>
    {open && <section className={styles.panel} aria-label={locale === "en" ? "Notifications" : "Thông báo"}>
      <header><strong>{locale === "en" ? "Notifications" : "Thông báo"}</strong><span>{unread} {locale === "en" ? "unread" : "chưa đọc"}</span></header>
      {error && <p className={styles.error}>{locale === "en" ? "Could not load notifications." : "Không tải được thông báo."}</p>}
      {!error && !items.length && <p className={styles.empty}>{locale === "en" ? "No notifications yet." : "Chưa có thông báo."}</p>}
      {items.map((item) => <button className={`${styles.item} ${!item.read_at ? styles.unread : ""}`} type="button" key={item.id} onClick={() => void markRead(item)}>
        <span className={styles.dot}>{item.read_at ? <Check size={13}/> : <i/>}</span>
        <span><strong>{locale === "en" ? item.title_en : item.title_vi}</strong><small>{locale === "en" ? item.body_en : item.body_vi}</small><time>{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "vi-VN", { dateStyle:"medium",timeStyle:"short" }).format(new Date(item.created_at))}</time></span>
      </button>)}
    </section>}
  </div>;
}
