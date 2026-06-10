import "./style.css";
import { Avatar, AvatarFallback, AvatarImage } from "@evoapi/design-system/avatar";
import { Button } from "@evoapi/design-system/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, MessageCircle, PlusCircle, Search, User, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import { useInstance } from "@/contexts/InstanceContext";

import { useFindChats } from "@/lib/queries/chat/findChats";
import { getToken, TOKEN_ID } from "@/lib/queries/token";
import { cn } from "@/lib/utils";

import { connectSocket, disconnectSocket } from "@/services/websocket/socket";

import { Chat as ChatType } from "@/types/evolution.types";

import { useMediaQuery } from "@/utils/useMediaQuery";

import { Messages } from "./messages";

const formatJid = (remoteJid: string): string => remoteJid.split("@")[0];

type ChatKind = "contacts" | "groups";

function Chat() {
  const { t } = useTranslation();
  const isMD = useMediaQuery("(min-width: 768px)");
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const [textareaHeight] = useState("auto");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { instance } = useInstance();

  const [realtimeChats, setRealtimeChats] = useState<ChatType[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ChatKind>("contacts");
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [caseSubmitting, setCaseSubmitting] = useState(false);

  const { data: chats } = useFindChats({ instanceName: instance?.name });

  const allChats = useMemo(() => {
    if (!chats) return realtimeChats;
    const map = new Map<string, ChatType>();
    chats.forEach((c) => map.set(c.remoteJid, c));
    realtimeChats.forEach((c) => {
      const existing = map.get(c.remoteJid);
      map.set(c.remoteJid, existing ? { ...existing, ...c } : c);
    });
    return Array.from(map.values());
  }, [chats, realtimeChats]);

  const { instanceId, remoteJid } = useParams<{ instanceId: string; remoteJid: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!instance?.name) return;
    const serverUrl = getToken(TOKEN_ID.API_URL);
    if (!serverUrl) return;

    const socket = connectSocket(serverUrl);

    const handle = (data: { instance?: string; data?: { key?: { remoteJid?: string; profilePictureUrl?: string }; pushName?: string } }) => {
      if (!instance || data.instance !== instance.name) return;
      const jid = data?.data?.key?.remoteJid;
      if (!jid) return;

      setRealtimeChats((prev) => {
        const idx = prev.findIndex((c) => c.remoteJid === jid);
        const obj = {
          id: jid,
          remoteJid: jid,
          pushName: data?.data?.pushName || formatJid(jid),
          profilePicUrl: data?.data?.key?.profilePictureUrl || "",
          ...(data?.data as Partial<ChatType>),
          labels: ((data?.data as Partial<ChatType> | undefined)?.labels) ?? null,
        } as ChatType;
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...obj };
          return next;
        }
        return [...prev, obj];
      });
    };

    socket.on("messages.upsert", handle);
    socket.on("send.message", handle);
    socket.connect();

    return () => {
      socket.off("messages.upsert");
      socket.off("send.message");
      disconnectSocket(socket);
    };
  }, [instance, instance?.name]);

  const scrollToBottom = useCallback(() => {
    lastMessageRef.current?.scrollIntoView({});
  }, []);

  const handleTextareaChange = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    const scrollHeight = textareaRef.current.scrollHeight;
    const lineHeight = parseInt(getComputedStyle(textareaRef.current).lineHeight);
    const maxHeight = lineHeight * 10;
    textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  };

  const handleChat = (jid: string) => navigate(`/manager/instance/${instanceId}/chat/${jid}`);

  const handleBack = () => navigate(`/manager/instance/${instanceId}/chat`);

  const visibleChats = useMemo(() => {
    const isContacts = kind === "contacts";
    const filtered = allChats.filter((c) =>
      isContacts ? c.remoteJid.includes("@s.whatsapp.net") : c.remoteJid.includes("@g.us"),
    );
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (c) =>
        (c.pushName && c.pushName.toLowerCase().includes(q)) ||
        c.remoteJid.toLowerCase().includes(q),
    );
  }, [allChats, kind, search]);

  const showSidebar = !remoteJid || isMD;

  const currentChat = useMemo(
    () => (remoteJid ? allChats.find((c) => c.remoteJid === remoteJid) ?? null : null),
    [allChats, remoteJid],
  );
  const currentChatName = currentChat?.pushName || (remoteJid ? formatJid(remoteJid) : "");
  const showChat = !!remoteJid;

  return (
    <div className="flex h-full w-full overflow-hidden rounded-lg border">
      <aside
        className={cn(
          "flex w-full flex-col border-r bg-card/50 md:w-80 md:flex-shrink-0",
          showSidebar ? "flex" : "hidden md:flex",
        )}
      >
        <div className="space-y-3 border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("chat.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={kind === "contacts" ? "secondary" : "ghost"}
              className="h-8"
              onClick={() => setKind("contacts")}
            >
              <User className="mr-1 h-4 w-4" />
              {t("chat.tabs.contacts")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={kind === "groups" ? "secondary" : "ghost"}
              className="h-8"
              onClick={() => setKind("groups")}
            >
              <Users className="mr-1 h-4 w-4" />
              {t("chat.tabs.groups")}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {t("chat.count", { count: visibleChats.length })}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visibleChats.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? t("chat.empty.search") : t("chat.empty.default")}
              </p>
              {search && <p className="mt-1 text-xs text-muted-foreground">{t("chat.empty.tryAnother")}</p>}
            </div>
          ) : (
            visibleChats.map((chat) => {
              const selected = remoteJid === chat.remoteJid;
              const name = chat.pushName || formatJid(chat.remoteJid);

              return (
                <button
                  key={chat.remoteJid}
                  type="button"
                  onClick={() => handleChat(chat.remoteJid)}
                  className={cn(
                    "block w-full cursor-pointer p-4 text-left transition-colors",
                    selected
                      ? "border-l-2 border-l-primary bg-primary/10"
                      : "border-b border-border/50 hover:bg-accent",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={chat.profilePicUrl} alt={name} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {kind === "groups" ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{name}</p>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {formatJid(chat.remoteJid)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
          showChat ? "flex" : "hidden md:flex",
        )}
      >
        {remoteJid ? (
          <>
            {!isMD && (
              <div className="flex items-center border-b bg-background/95 p-2 backdrop-blur-sm">
                <Button variant="ghost" size="sm" onClick={handleBack}>
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  {t("chat.back")}
                </Button>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                  {currentChat?.profilePicUrl ? (
                    <AvatarImage src={currentChat.profilePicUrl} alt={currentChatName} />
                  ) : null}
                  <AvatarFallback>{currentChatName.slice(0, 2).toUpperCase() || "??"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{currentChatName}</p>
                  <p className="truncate text-xs text-muted-foreground">{remoteJid}</p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="h-8 px-3 text-xs"
                onClick={() => setCaseDialogOpen(true)}
              >
                <PlusCircle className="mr-1 h-3.5 w-3.5" />
                Crear caso
              </Button>
            </div>
            <Messages
              textareaRef={textareaRef}
              handleTextareaChange={handleTextareaChange}
              textareaHeight={textareaHeight}
              lastMessageRef={lastMessageRef}
              scrollToBottom={scrollToBottom}
            />
          </>
        ) : (
          <div className="flex h-full flex-1 items-center justify-center p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <MessageCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-lg font-semibold">{t("chat.empty.selectTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("chat.empty.selectDescription")}
              </p>
            </div>
          </div>
        )}
      </main>

      <Dialog
        open={caseDialogOpen}
        onOpenChange={(open) => {
          setCaseDialogOpen(open);
          if (!open) {
            setCaseTitle("");
            setCaseDescription("");
            setCaseSubmitting(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear caso</DialogTitle>
            <DialogDescription>
              Registra un caso de soporte a partir de este chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="case-title" className="text-sm font-medium">
                Título
              </label>
              <Input
                id="case-title"
                value={caseTitle}
                onChange={(e) => setCaseTitle(e.target.value)}
                placeholder="Ej. Soporte urgente"
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="case-description" className="text-sm font-medium">
                Descripción
              </label>
              <Textarea
                id="case-description"
                value={caseDescription}
                onChange={(e) => setCaseDescription(e.target.value)}
                placeholder="Detalle del caso"
                rows={4}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCaseDialogOpen(false)}
              disabled={caseSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={async () => {
                if (!caseTitle.trim() || caseSubmitting) return;
                setCaseSubmitting(true);
                try {
                  const token = getToken(TOKEN_ID.TOKEN) || "";
                  const baseUrl =
                    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
                  await fetch(`${baseUrl}/chat/create-case`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      apikey: token,
                    },
                    body: JSON.stringify({
                      instanceName: instance?.name,
                      remoteJid,
                      pushName: currentChat?.pushName ?? null,
                      title: caseTitle.trim(),
                      description: caseDescription.trim(),
                    }),
                  }).catch(() => null);
                } finally {
                  setCaseSubmitting(false);
                  setCaseDialogOpen(false);
                  setCaseTitle("");
                  setCaseDescription("");
                }
              }}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Chat };
