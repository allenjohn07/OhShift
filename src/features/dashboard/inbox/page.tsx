import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { PageHeader, PageMain } from "@/components/page";
import { Panel, PanelEmpty, PanelHeader } from "@/components/panel";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { queries } from "@/lib/queries";
import { rpc, unwrap, type ApiData } from "@/lib/rpc";
import type { AppRole } from "@/lib/nav";
import { getEmployeeColor } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/dates";

type TabId = "announcements" | "messages";

type Announcement = ApiData<typeof rpc.announcements.$get>["announcements"][number];
type Conversation = ApiData<typeof rpc.messages.conversations.$get>["conversations"][number];
type DirectMessage = ApiData<
  (typeof rpc.messages.conversations)[":id"]["$get"]
>["messages"][number];

const NO_ANNOUNCEMENTS: Announcement[] = [];
const NO_CONVERSATIONS: Conversation[] = [];
const NO_MESSAGES: DirectMessage[] = [];

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
  return formatTime(iso);
}

function InboxPageContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? "";
  const role = user?.profile.role;
  const canManage = role === "manager" || role === "owner";

  const [tab, setTab] = useState<TabId>("announcements");

  // Announcements
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Messages
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [startingDm, setStartingDm] = useState(false);

  // Live data (polled while visible; the unread badge query lives in AppShell)
  const announcementsQuery = useQuery(queries.announcements());
  const conversationsQuery = useQuery(queries.conversations());
  const threadQuery = useQuery({
    ...queries.thread(activeId ?? ""),
    enabled: Boolean(activeId),
  });
  const directoryQuery = useQuery({ ...queries.directory(), enabled: newDmOpen });

  const announcements = announcementsQuery.data?.announcements ?? NO_ANNOUNCEMENTS;
  const conversations = conversationsQuery.data?.conversations ?? NO_CONVERSATIONS;
  const messages = threadQuery.data?.messages ?? NO_MESSAGES;
  const directory = directoryQuery.data?.members ?? [];
  const loading = announcementsQuery.isPending || conversationsQuery.isPending;

  /** Refetch now (same tab) instead of waiting for the next poll. */
  const refresh = (...keys: string[][]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const markConversationRead = async (conversationId: string) => {
    await rpc.messages.conversations[":id"].read.$post({
      param: { id: conversationId },
    });
    await refresh(["inbox"], queries.conversations().queryKey);
  };

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
      const json = { title: t, body: b };
      await unwrap(
        editing
          ? rpc.announcements[":id"].$patch({ param: { id: editing.id }, json })
          : rpc.announcements.$post({ json }),
        "Failed to save",
      );
      toast.success(editing ? "Announcement updated" : "Announcement posted");
      setComposeOpen(false);
      await refresh(["announcements"], ["inbox"]);
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
      await unwrap(
        rpc.announcements[":id"].$delete({ param: { id } }),
        "Failed to delete",
      );
      toast.success("Announcement deleted");
      if (expandedId === id) setExpandedId(null);
      await refresh(["announcements"], ["inbox"]);
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
      await rpc.announcements[":id"].read.$post({ param: { id: ann.id } });
      queryClient.setQueryData(queries.announcements().queryKey, (prev) =>
        prev && {
          ...prev,
          announcements: prev.announcements.map((a) =>
            a.id === ann.id ? { ...a, is_read: true } : a,
          ),
        },
      );
      await refresh(["inbox"]);
    }
  };

  const handleMarkAllRead = async () => {
    const res = await rpc.announcements["read-all"].$post();
    if (!res.ok) {
      toast.error("Failed to mark all read");
      return;
    }
    await refresh(["announcements"], ["inbox"]);
    toast.success("Marked all as read");
  };

  const openConversation = async (id: string) => {
    setActiveId(id);
    await markConversationRead(id);
  };

  const handleStartDm = async (recipientId: string) => {
    setStartingDm(true);
    try {
      const data = await unwrap(
        rpc.messages.conversations.$post({ json: { recipient_id: recipientId } }),
        "Failed to start conversation",
      );
      setNewDmOpen(false);
      await openConversation(data.conversation.id);
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
      const data = await unwrap(
        rpc.messages.conversations[":id"].$post({
          param: { id: activeId },
          json: { body: text },
        }),
        "Failed to send",
      );
      setDraft("");
      queryClient.setQueryData(queries.thread(activeId).queryKey, (prev) =>
        prev && { ...prev, messages: [...prev.messages, data.message] },
      );
      await refresh(queries.conversations().queryKey, ["inbox"]);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message",
      );
    } finally {
      setSending(false);
    }
  };

  const openNewDm = async () => {
    await queryClient.prefetchQuery(queries.directory());
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
      <PageMain>
          <PageHeader
            eyebrow={user?.profile.companies?.name}
            title="Inbox"
            description="Announcements and direct messages with your team."
            actions={
            <>
              {tab === "announcements" && canManage && (
                <Button
                  
                  onClick={() => openCompose()}
                >
                  <Plus className="h-4 w-4" />
                  New announcement
                </Button>
              )}
              {tab === "announcements" && unreadAnnouncements > 0 && (
                <Button
                  variant="outline"
                  
                  onClick={handleMarkAllRead}
                >
                  Mark all read
                </Button>
              )}
              {tab === "messages" && (
                <Button
                  
                  onClick={openNewDm}
                >
                  <Plus className="h-4 w-4" />
                  New message
                </Button>
              )}
            </>
            }
          />

          <div className="flex w-fit gap-0.5 rounded-md border border-input p-0.5">
            <button
              type="button"
              onClick={() => setTab("announcements")}
              className={cn(
                "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                tab === "announcements"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Megaphone className="h-4 w-4" />
              Announcements
              {unreadAnnouncements > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-brand-soft px-1 text-[11px] font-medium tabular-nums text-brand">
                  {unreadAnnouncements > 99 ? "99+" : unreadAnnouncements}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("messages")}
              className={cn(
                "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                tab === "messages"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageSquare className="h-4 w-4" />
              Messages
              {conversations.some((c) => c.unread_count > 0) && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-brand-soft px-1 text-[11px] font-medium tabular-nums text-brand">
                  {conversations.reduce((n, c) => n + c.unread_count, 0) > 99
                    ? "99+"
                    : conversations.reduce((n, c) => n + c.unread_count, 0)}
                </span>
              )}
            </button>
          </div>

          {tab === "announcements" && (
            <Panel className="min-h-[30rem] lg:min-h-[calc(100dvh-20rem)]">
              <PanelHeader
                title="Announcements"
                meta={announcements.length || undefined}
              />
              {announcements.length === 0 ? (
                <PanelEmpty icon={<Megaphone />} title="No announcements yet">
                  {canManage
                    ? "Post an update for your whole team."
                    : "When managers post updates, they’ll show up here."}
                </PanelEmpty>
              ) : (
                <ul className="divide-y divide-border">{
                announcements.map((ann) => {
                  const open = expandedId === ann.id;
                  const unread = !ann.is_read && ann.author_id !== userId;
                  const isAuthor = ann.author_id === userId;
                  return (
                    <li key={ann.id}>
                      <button
                        type="button"
                        onClick={() => handleExpandAnnouncement(ann)}
                        className="w-full text-left px-4 sm:px-5 py-3 cursor-pointer hover:bg-accent/60 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-2 h-2 w-2 shrink-0 rounded-full",
                              unread ? "bg-brand" : "bg-transparent",
                            )}
                          />
                          <div className={cn("min-w-0 flex-1", !unread && "ml-0")}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h3 className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                                {ann.title}
                              </h3>
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
                      {open && (
                        <div className="px-4 pb-4 pl-9 sm:px-5 sm:pl-10">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {ann.body}
                          </p>
                          {(isAuthor || canManage) && (
                            <div className="flex gap-2 mt-4">
                              {isAuthor && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  
                                  onClick={() => openCompose(ann)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={deletingId === ann.id}
                                onClick={() =>
                                  handleDeleteAnnouncement(ann.id)
                                }
                              >
                                {deletingId === ann.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}</ul>
              )}
            </Panel>
          )}

          {tab === "messages" && (
            <Panel className="h-[30rem] md:flex-row md:min-h-[16rem] md:h-[calc(100dvh-20rem)] lg:min-h-[30rem]">
              {/* Conversation list */}
              <div
                className={cn(
                  "md:w-80 md:border-r border-border flex min-h-0 flex-col shrink-0",
                  activeId ? "hidden md:flex" : "flex",
                )}
              >
                <PanelHeader title="Conversations" meta={conversations.length || undefined} />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {conversations.length === 0 ? (
                    <PanelEmpty>No conversations yet. Start one with a teammate.</PanelEmpty>
                  ) : (
                    conversations.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openConversation(c.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors border-b border-border last:border-0",
                          activeId === c.id
                            ? "bg-accent"
                            : "hover:bg-accent/60",
                        )}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          {c.other.avatar_url && (
                            <AvatarImage src={c.other.avatar_url} />
                          )}
                          <AvatarFallback
                            className={cn("text-[11px] font-semibold", getEmployeeColor(c.other.full_name))}
                          >
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
                    ))
                  )}
                </div>
              </div>

              {/* Thread */}
              <div
                className={cn(
                  "flex-1 flex min-h-0 flex-col min-w-0",
                  !activeId ? "hidden md:flex" : "flex",
                )}
              >
                {!activeId ? (
                  <div className="flex-1 flex items-center justify-center p-8 text-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium">Select a conversation</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Or start a new message with a teammate.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex min-h-12 items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden rounded-lg shrink-0"
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
                        <AvatarFallback
                          className={cn(
                            "text-[11px] font-semibold",
                            getEmployeeColor(activeConversation?.other.full_name ?? ""),
                          )}
                        >
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

                    <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
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
                                  "max-w-[85%] sm:max-w-[70%] rounded-lg px-3.5 py-2 text-sm",
                                  mine
                                    ? "bg-brand text-brand-foreground rounded-br-md"
                                    : "bg-foreground/[0.06] text-foreground rounded-bl-md dark:bg-foreground/[0.1]",
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
                      className="flex shrink-0 gap-2 border-t border-border p-3 sm:p-4"
                    >
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={MSG_MAX}
                        placeholder="Write a message…"
                        className="h-9"
                      />
                      <Button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="h-9 shrink-0 px-4"
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
            </Panel>
          )}
      </PageMain>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit announcement" : "New announcement"}
            </DialogTitle>
            <DialogDescription>
              Visible to everyone in your company.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAnnouncement} className="flex min-h-0 flex-1 flex-col">
            <DialogBody>
            <div className="space-y-2">
              <label htmlFor="ann-title" className="text-[13px] font-medium text-muted-foreground">
                Title
              </label>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                placeholder="Schedule update for next week"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ann-body" className="text-[13px] font-medium text-muted-foreground">
                Message
              </label>
              <textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={BODY_MAX}
                placeholder="Share details with your team…"
                className={cn(fieldClass, "py-2")}
              />
            </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                
                onClick={() => setComposeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingAnnouncement}
                
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>
              Choose a teammate to message.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-80 space-y-0.5 px-3 py-2">
            {directory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No other teammates in your company yet.
              </p>
            ) : (
              directory.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={startingDm}
                  onClick={() => handleStartDm(m.id)}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Avatar className="h-9 w-9">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback
                      className={cn("text-[11px] font-semibold", getEmployeeColor(m.full_name))}
                    >
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
              ))
            )}
          </DialogBody>
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
