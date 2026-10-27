"use client";

import { useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/lib/types";

export function NotificationDrawer({ notifications: initialNotifications }: { notifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  async function showNotifications() {
    setOpen((current) => !current);
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length === 0) return;
    const readAt = new Date().toISOString();
    const { error } = await createClient().from("notifications").update({ read_at: readAt }).in("id", unreadIds);
    if (error) {
      console.error("Unable to mark notifications as read", error);
      return;
    }
    setNotifications((current) => current.map((notification) =>
      unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification,
    ));
  }

  return (
    <div className="relative">
      <button onClick={showNotifications} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} className="relative rounded-lg p-2 hover:bg-white/10">
        <Bell size={20} />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ndkc-gold px-1 text-[9px] font-extrabold text-ndkc-green">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {open && (
        <>
          <button aria-label="Close notifications" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <section aria-label="Recent notifications" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-stone-200 bg-white text-stone-900 shadow-xl">
            <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <h2 className="font-bold">Notifications</h2>
              <button onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-md p-1 text-stone-500 hover:bg-stone-100"><X size={17} /></button>
            </header>
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-500">You’re all caught up.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
                {notifications.map((notification) => (
                  <li key={notification.id} className={`flex gap-3 px-4 py-3 ${notification.read_at ? "" : "bg-emerald-50/70"}`}>
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-ndkc-emerald"><Check size={15} /></span>
                    <div className="min-w-0"><p className="text-sm leading-5">{notification.message}</p><time className="mt-1 block text-xs text-stone-500" dateTime={notification.created_at}>{new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.created_at))}</time></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}