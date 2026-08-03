"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { IconTooltip } from "@/components/icon-tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { useRefreshInboxUnread } from "@/hooks/use-inbox-unread";
import { useVisiblePoll } from "@/hooks/use-visible-poll";
import { parseApiJson } from "@/lib/api";
import type { AppRole } from "@/lib/nav";
import { cn } from "@/lib/utils";

type TabId = "announcements" | "messages";

type Announcement = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  is_read: boolean;
  author?: { full_name: string; avatar_url: string | null };
};

type DirectoryMember = {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  updated_at: string;
  other: DirectoryMember;
  last_message: {
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count: number;
};

type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

const TITLE_MAX = 120;
const BODY_MAX = 4000;
const MSG_MAX = 2000;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatMessageTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function InboxPageContent() {
  const api = useApi();
  const { user } = useAuth();
  const refreshUnread = useRefreshInboxUnread();
  const userId = user?.id ?? "";
  const role = user?.profile.role;
  const canManage = role === "manager" || role === "owner";

  const [tab, setTab] = useState<TabId>("announcements");
  const [loading, setLoading] = useState(true);

  // Announcements
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Messages
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [startingDm, setStartingDm] = useState(false);

  const loadAnnouncements = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const res = await api("/announcements");
      const data = await parseApiJson<{
        announcements?: Announcement[];
        error?: string;
      }>(res);
      if (!res.ok) {
        if (!opts?.quiet && res.status !== 401) {
          toast.error(data.error || "Failed to load announcements");
        }
        return;
      }
      setAnnouncements(data.announcements ?? []);
    },
    [api],
  );

  const loadConversations = useCallback(
    async (opts?: { quiet?: boolean }) => {
      const res = await api("/messages/conversations");
      const data = await parseApiJson<{
        conversations?: Conversation[];
        error?: string;
      }>(res);
      if (!res.ok) {
        if (!opts?.quiet && res.status !== 401) {
          toast.error(data.error || "Failed to load conversations");
        }
        return;
      }
      setConversations(data.conversations ?? []);
    },
    [api],
  );

  const loadDirectory = useCallback(async () => {
    const res = await api("/messages/directory");
    const data = await parseApiJson<{ members?: DirectoryMember[] }>(res);
    if (res.ok) setDirectory(data.members ?? []);
  }, [api]);

  const loadThread = useCallback(
    async (conversationId: string, opts?: { quiet?: boolean }) => {
      const res = await api(`/messages/conversations/${conversationId}`);
      const data = await parseApiJson<{
        messages?: DirectMessage[];
        error?: string;
      }>(res);
      if (!res.ok) {
        if (!opts?.quiet && res.status !== 401) {
          toast.error(data.error || "Failed to load messages");
        }
        return;
      }
      setMessages(data.messages ?? []);
    },
    [api],
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      await api(`/messages/conversations/${conversationId}/read`, {
        method: "POST",
      });
      await refreshUnread();
      await loadConversations({ quiet: true });
    },
    [api, refreshUnread, loadConversations],
  );

  const initialLoadRef = useRef(true);
  const poll = useCallback(async () => {
    const quiet = !initialLoadRef.current;
    try {
      await Promise.all([
        loadAnnouncements({ quiet }),
        loadConversations({ quiet }),
        refreshUnread(),
      ]);
      if (activeId) {
        await loadThread(activeId, { quiet: true });
      }
    } catch {
      if (!quiet) toast.error("Failed to load inbox");
    } finally {
      initialLoadRef.current = false;
      setLoading(false);
    }
  }, [
    loadAnnouncements,
    loadConversations,
    loadThread,
    refreshUnread,
    activeId,
  ]);

  useVisiblePoll(true, poll);

  const openCompose = (ann?: Announcement) => {
    if (ann) {
      setEditing(ann);
      setTitle(ann.title);
      setBody(ann.body);
    } else {
      setEditing(null);
      setTitle("");
      setBody("");
    }
    setComposeOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      toast.error("Title and body are required");
      return;
    }
    setSavingAnnouncement(true);
    try {
      const res = await api(
        editing ? `/announcements/${editing.id}` : "/announcements",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify({ title: t, body: b }),
        },
      );
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast.success(editing ? "Announcement updated" : "Announcement posted");
      setComposeOpen(false);
      await loadAnnouncements();
      await refreshUnread();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save announcement",
      );
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await api(`/announcements/${id}`, { method: "DELETE" });
      const data = await parseApiJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success("Announcement deleted");
      if (expandedId === id) setExpandedId(null);
      await loadAnnouncements();
      await refreshUnread();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleExpandAnnouncement = async (ann: Announcement) => {
    const next = expandedId === ann.id ? null : ann.id;
    setExpandedId(next);
    if (next && !ann.is_read && ann.author_id !== userId) {
      await api(`/announcements/${ann.id}/read`, { method: "POST" });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === ann.id ? { ...a, is_read: true } : a)),
      );
      await refreshUnread();
    }
  };

  const handleMarkAllRead = async () => {
    const res = await api("/announcements/read-all", { method: "POST" });
    if (!res.ok) {
      toast.error("Failed to mark all read");
      return;
    }
    await loadAnnouncements();
    await refreshUnread();
    toast.success("Marked all as read");
  };

  const openConversation = async (id: string) => {
    setActiveId(id);
    await loadThread(id);
    await markConversationRead(id);
  };

  const handleStartDm = async (recipientId: string) => {
    setStartingDm(true);
    try {
      const res = await api("/messages/conversations", {
        method: "POST",
        body: JSON.stringify({ recipient_id: recipientId }),
      });
      const data = await parseApiJson<{
        conversation?: Conversation;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to start conversation");
      setNewDmOpen(false);
      await loadConversations();
      if (data.conversation) {
        await openConversation(data.conversation.id);
      }
      setTab("messages");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start conversation",
      );
    } finally {
      setStartingDm(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return;
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await api(`/messages/conversations/${activeId}`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      const data = await parseApiJson<{
        message?: DirectMessage;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setDraft("");
      if (data.message) {
        setMessages((prev) => [...prev, data.message!]);
      } else {
        await loadThread(activeId);
      }
      await loadConversations({ quiet: true });
      await refreshUnread();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  };

  const openNewDm = async () => {
    await loadDirectory();
    setNewDmOpen(true);
  };

  const activeConversation = conversations.find((c) => c.id === activeId);
  const unreadAnnouncements = announcements.filter(
    (a) => !a.is_read && a.author_id !== userId,
  ).length;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[calc(100dvh-4rem)]">
        <div className="h-8 w-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 w-full">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-brand mb-1">Team</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                Inbox
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Announcements and direct messages with your team.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tab === "announcements" && canManage && (
                <Button
                  className="btn-brand rounded-xl"
                  onClick={() => openCompose()}
                  tooltip="New announcement"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New announcement
                </Button>
              )}
              {tab === "announcements" && unreadAnnouncements > 0 && (
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={handleMarkAllRead}
                  tooltip="Mark all read"
                >
                  Mark all read
                </Button>
              )}
              {tab === "messages" && (
                <Button
                  className="btn-brand rounded-xl"
                  onClick={openNewDm}
                  tooltip="New message"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New message
                </Button>
              )}
            </div>
          </div>

          <div className="flex gap-1 p-1 rounded-xl border border-border/50 bg-card/40 w-fit mb-6">
            <IconTooltip label="Announcements" side="bottom">
              <button
                type="button"
                onClick={() => setTab("announcements")}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  tab === "announcements"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Megaphone className="h-4 w-4" />
                Announcements
                {unreadAnnouncements > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand text-brand-foreground text-[10px] font-semibold flex items-center justify-center">
                    {unreadAnnouncements > 99 ? "99+" : unreadAnnouncements}
                  </span>
                )}
              </button>
            </IconTooltip>
            <IconTooltip label="Messages" side="bottom">
              <button
                type="button"
                onClick={() => setTab("messages")}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  tab === "messages"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Messages
                {conversations.some((c) => c.unread_count > 0) && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-brand text-brand-foreground text-[10px] font-semibold flex items-center justify-center">
                    {conversations.reduce((n, c) => n + c.unread_count, 0) > 99
                      ? "99+"
                      : conversations.reduce((n, c) => n + c.unread_count, 0)}
                  </span>
                )}
              </button>
            </IconTooltip>
          </div>

          {tab === "announcements" && (
            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="rounded-2xl border border-border/50 bg-card/40 px-6 py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <p className="font-medium">No announcements yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {canManage
                      ? "Post an update for your whole team."
                      : "When managers post updates, they’ll show up here."}
                  </p>
                </div>
              ) : (
                announcements.map((ann) => {
                  const open = expandedId === ann.id;
                  const unread = !ann.is_read && ann.author_id !== userId;
                  const isAuthor = ann.author_id === userId;
                  return (
                    <div
                      key={ann.id}
                      className={cn(
                        "rounded-2xl border border-border/50 bg-card/40 overflow-hidden transition-colors",
                        unread && "border-brand/40",
                      )}
                    >
                      <IconTooltip
                        label={open ? "Collapse announcement" : "Expand announcement"}
                        side="bottom"
                        className="w-full"
                      >
                        <button
                          type="button"
                          onClick={() => handleExpandAnnouncement(ann)}
                          className="w-full text-left px-4 sm:px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        >
                        <div className="flex items-start gap-3">
                          {unread && (
                            <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
                          )}
                          <div className={cn("min-w-0 flex-1", !unread && "ml-0")}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h2 className="font-semibold tracking-tight truncate">
                                {ann.title}
                              </h2>
                              <span className="text-xs text-muted-foreground">
                                {formatRelative(ann.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {ann.author?.full_name ?? "Team"}
                              {!open && (
                                <span className="text-muted-foreground/80">
                                  {" · "}
                                  {ann.body.slice(0, 80)}
                                  {ann.body.length > 80 ? "…" : ""}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        </button>
                      </IconTooltip>
                      {open && (
                        <div className="px-4 sm:px-5 pb-4 border-t border-border/40 pt-3">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {ann.body}
                          </p>
                          {(isAuthor || canManage) && (
                            <div className="flex gap-2 mt-4">
                              {isAuthor && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => openCompose(ann)}
                                  tooltip="Edit announcement"
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl text-red-500 hover:text-red-500"
                                disabled={deletingId === ann.id}
                                onClick={() =>
                                  handleDeleteAnnouncement(ann.id)
                                }
                                tooltip="Delete announcement"
                              >
                                {deletingId === ann.id ? (
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                )}
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "messages" && (
            <div className="rounded-2xl border border-border/50 bg-card/40 overflow-hidden min-h-[28rem] sm:min-h-[32rem] flex flex-col md:flex-row">
              {/* Conversation list */}
              <div
                className={cn(
                  "md:w-80 md:border-r border-border/50 flex flex-col shrink-0",
                  activeId ? "hidden md:flex" : "flex",
                )}
              >
                <div className="px-4 py-3 border-b border-border/40">
                  <p className="text-sm font-medium">Conversations</p>
                </div>
                <div className="flex-1 overflow-y-auto max-h-[40vh] md:max-h-none">
                  {conversations.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No conversations yet. Start one with a teammate.
                    </div>
                  ) : (
                    conversations.map((c) => (
                      <IconTooltip
                        key={c.id}
                        label={`Message ${c.other.full_name}`}
                        side="right"
                        className="w-full"
                      >
                        <button
                          type="button"
                          onClick={() => openConversation(c.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors border-b border-border/30 last:border-0",
                            activeId === c.id
                              ? "bg-brand-soft/60"
                              : "hover:bg-muted/30",
                          )}
                        >
                        <Avatar className="h-9 w-9 shrink-0">
                          {c.other.avatar_url && (
                            <AvatarImage src={c.other.avatar_url} />
                          )}
                          <AvatarFallback className="text-xs">
                            {initials(c.other.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">
                              {c.other.full_name}
                            </p>
                            {c.last_message && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatRelative(c.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground truncate">
                              {c.last_message?.body ?? "No messages yet"}
                            </p>
                            {c.unread_count > 0 && (
                              <span className="min-w-5 h-5 px-1 rounded-full bg-brand text-brand-foreground text-[10px] font-semibold flex items-center justify-center shrink-0">
                                {c.unread_count > 99 ? "99+" : c.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                        </button>
                      </IconTooltip>
                    ))
                  )}
                </div>
              </div>

              {/* Thread */}
              <div
                className={cn(
                  "flex-1 flex flex-col min-w-0",
                  !activeId ? "hidden md:flex" : "flex",
                )}
              >
                {!activeId ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <p className="font-medium">Select a conversation</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Or start a new message with a teammate.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-border/40">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden rounded-xl shrink-0"
                        onClick={() => setActiveId(null)}
                        aria-label="Back to conversations"
                        tooltip="Back to conversations"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Avatar className="h-8 w-8 shrink-0">
                        {activeConversation?.other.avatar_url && (
                          <AvatarImage
                            src={activeConversation.other.avatar_url}
                          />
                        )}
                        <AvatarFallback className="text-xs">
                          {initials(
                            activeConversation?.other.full_name ?? "?",
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {activeConversation?.other.full_name ?? "Chat"}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {activeConversation?.other.role}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 max-h-[50vh] md:max-h-none">
                      {messages.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-8">
                          Say hello — send the first message.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const mine = m.sender_id === userId;
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "flex",
                                mine ? "justify-end" : "justify-start",
                              )}
                            >
                              <div
                                className={cn(
                                  "max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
                                  mine
                                    ? "bg-brand text-brand-foreground rounded-br-md"
                                    : "bg-muted/60 text-foreground rounded-bl-md",
                                )}
                              >
                                <p className="whitespace-pre-wrap break-words">
                                  {m.body}
                                </p>
                                <p
                                  className={cn(
                                    "text-[10px] mt-1",
                                    mine
                                      ? "text-brand-foreground/70"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {formatMessageTime(m.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form
                      onSubmit={handleSend}
                      className="flex gap-2 p-3 sm:p-4 border-t border-border/40"
                    >
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={MSG_MAX}
                        placeholder="Write a message…"
                        className="h-11 rounded-xl bg-card/50 border-border/60"
                      />
                      <Button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="btn-brand rounded-xl shrink-0 h-11 px-5"
                        tooltip="Send message"
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit announcement" : "New announcement"}
            </DialogTitle>
            <DialogDescription>
              Visible to everyone in your company.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAnnouncement} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="ann-title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder="Schedule update for next week"
                className="h-11 rounded-xl bg-card/50 border-border/60"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ann-body" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={BODY_MAX}
                placeholder="Share details with your team…"
                className="w-full rounded-xl border border-border/60 bg-card/50 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setComposeOpen(false)}
                tooltip="Cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingAnnouncement}
                className="btn-brand rounded-xl"
                tooltip={editing ? "Save changes" : "Post announcement"}
              >
                {savingAnnouncement ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editing ? (
                  "Save changes"
                ) : (
                  "Post"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={newDmOpen} onOpenChange={setNewDmOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>
              Choose a teammate to message.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1 -mx-1 px-1">
            {directory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No other teammates in your company yet.
              </p>
            ) : (
              directory.map((m) => (
                <IconTooltip
                  key={m.id}
                  label={`Message ${m.full_name}`}
                  side="right"
                  className="w-full"
                >
                  <button
                    type="button"
                    disabled={startingDm}
                    onClick={() => handleStartDm(m.id)}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                  <Avatar className="h-9 w-9">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-xs">
                      {initials(m.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {m.role}
                    </p>
                  </div>
                  </button>
                </IconTooltip>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function InboxPage() {
  const { user } = useAuth();
  const role: AppRole =
    user?.profile.role === "owner"
      ? "owner"
      : user?.profile.role === "manager"
        ? "manager"
        : "employee";

  return (
    <AppShell role={role}>
      <AuthGuard allowedRoles={["employee", "manager", "owner"]}>
        <InboxPageContent />
      </AuthGuard>
    </AppShell>
  );
}
