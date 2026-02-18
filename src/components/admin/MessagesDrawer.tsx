import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Send, Paperclip, Search, MoreVertical, User, FileText, X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Conversation {
  id: string;
  admin_id: string;
  client_id: string;
  is_archived: boolean;
  created_at: string;
  client_name: string;
  company_name: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  message_content: string;
  message_type: string;
  file_url: string | null;
  is_read: boolean;
  sent_at: string;
  read_at: string | null;
}

interface MessagesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedClientId?: string | null;
}

const QUICK_TEMPLATES = [
  "Your invoice is ready for review.",
  "Your usage limit is approaching. Consider upgrading your plan.",
  "Thank you for your payment!",
  "Your service has been activated successfully.",
  "Please find the attached document.",
];

export default function MessagesDrawer({ open, onOpenChange, preselectedClientId }: MessagesDrawerProps) {
  const { user } = useAuth();
  const { admin } = useAdmin();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    if (!admin) return;
    setLoadingConvs(true);
    try {
      const { data: convs, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("admin_id", admin.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each conversation, get client info, last message, and unread count
      const enriched: Conversation[] = [];
      for (const conv of convs || []) {
        // Get client info
        const { data: client } = await supabase
          .from("clients")
          .select("company_name, user_id")
          .eq("id", conv.client_id)
          .maybeSingle();

        let clientName = "Unknown";
        if (client) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", client.user_id)
            .maybeSingle();
          clientName = profile?.full_name || "Unknown";
        }

        // Get last message
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("message_content, sent_at")
          .eq("conversation_id", conv.id)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Get unread count
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_id", user?.id || "");

        enriched.push({
          ...conv,
          client_name: clientName,
          company_name: client?.company_name || "Unknown",
          last_message: lastMsg?.message_content || null,
          last_message_at: lastMsg?.sent_at || conv.created_at,
          unread_count: count || 0,
        });
      }

      // Sort by last message time
      enriched.sort((a, b) =>
        new Date(b.last_message_at || b.created_at).getTime() -
        new Date(a.last_message_at || a.created_at).getTime()
      );

      setConversations(enriched);
    } catch (err: any) {
      console.error("Error fetching conversations:", err);
    } finally {
      setLoadingConvs(false);
    }
  }, [admin, user]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMsgs(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Mark unread messages as read
      if (user) {
        await supabase
          .from("messages")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .eq("conversation_id", conversationId)
          .eq("receiver_id", user.id)
          .eq("is_read", false);
      }
    } catch (err: any) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoadingMsgs(false);
    }
  }, [user]);

  // Load conversations when drawer opens
  useEffect(() => {
    if (open) {
      fetchConversations();
    } else {
      setSelectedConv(null);
      setMessages([]);
      setSearchQuery("");
    }
  }, [open, fetchConversations]);

  // Handle preselected client
  useEffect(() => {
    if (open && preselectedClientId && admin && conversations.length > 0) {
      const existing = conversations.find((c) => c.client_id === preselectedClientId);
      if (existing) {
        setSelectedConv(existing);
        fetchMessages(existing.id);
      }
    }
  }, [open, preselectedClientId, conversations, admin, fetchMessages]);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
    }
  }, [selectedConv, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !open) return;

    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          // If in the current conversation, add it
          if (selectedConv && newMsg.conversation_id === selectedConv.id) {
            setMessages((prev) => [...prev, newMsg]);
            // Mark as read
            if (newMsg.receiver_id === user.id) {
              supabase
                .from("messages")
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq("id", newMsg.id);
            }
          }
          // Refresh conversations for unread counts
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, open, selectedConv, fetchConversations]);

  // Send message
  const handleSend = async () => {
    if (!messageInput.trim() || !user || !admin || sending) return;

    let convId = selectedConv?.id;

    // If no conversation exists and we have a preselected client, create one
    if (!convId && preselectedClientId) {
      try {
        const { data: newConv, error } = await supabase
          .from("conversations")
          .insert({ admin_id: admin.id, client_id: preselectedClientId })
          .select()
          .single();
        if (error) throw error;
        convId = newConv.id;
      } catch (err: any) {
        toast({ title: "Error creating conversation", description: err.message, variant: "destructive" });
        return;
      }
    }

    if (!convId) return;

    setSending(true);
    try {
      // Get receiver_id (the client's user_id)
      const clientId = selectedConv?.client_id || preselectedClientId;
      const { data: client } = await supabase
        .from("clients")
        .select("user_id")
        .eq("id", clientId!)
        .single();

      if (!client) throw new Error("Client not found");

      const { error } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        receiver_id: client.user_id,
        message_content: messageInput.trim(),
        message_type: "text",
      });

      if (error) throw error;
      setMessageInput("");

      // Refresh if we just created a new conversation
      if (!selectedConv) {
        await fetchConversations();
      }
    } catch (err: any) {
      toast({ title: "Error sending message", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !admin) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB allowed.", variant: "destructive" });
      return;
    }

    let convId = selectedConv?.id;
    if (!convId) return;

    setSending(true);
    try {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("message-attachments")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("message-attachments")
        .getPublicUrl(filePath);

      const clientId = selectedConv?.client_id;
      const { data: client } = await supabase
        .from("clients")
        .select("user_id")
        .eq("id", clientId!)
        .single();

      if (!client) throw new Error("Client not found");

      const { error } = await supabase.from("messages").insert({
        conversation_id: convId,
        sender_id: user.id,
        receiver_id: client.user_id,
        message_content: file.name,
        message_type: "file",
        file_url: urlData.publicUrl,
      });

      if (error) throw error;
    } catch (err: any) {
      toast({ title: "Error uploading file", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredConvs = conversations.filter((c) =>
    !searchQuery ||
    c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col safe-area-top safe-area-bottom">
        {!selectedConv ? (
          <>
            {/* Conversation List View */}
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>Messages</SheetTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              {loadingConvs ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : filteredConvs.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <p>No conversations yet</p>
                  <p className="text-xs mt-1">Send a message to a client to start</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredConvs.map((conv) => (
                    <button
                      key={conv.id}
                      className="w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                      onClick={() => setSelectedConv(conv)}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">{getInitials(conv.company_name)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{conv.company_name}</p>
                          {conv.last_message_at && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {conv.last_message || "No messages yet"}
                          </p>
                          {conv.unread_count > 0 && (
                            <Badge className="ml-2 h-5 min-w-[20px] flex items-center justify-center text-[10px] shrink-0">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            {/* Chat View */}
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <Button variant="ghost" size="icon" onClick={() => { setSelectedConv(null); setMessages([]); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">{getInitials(selectedConv.company_name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedConv.company_name}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedConv.client_name}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    supabase.from("conversations").update({ is_archived: true }).eq("id", selectedConv.id);
                    setSelectedConv(null);
                    fetchConversations();
                    toast({ title: "Conversation archived" });
                  }}>
                    Archive Conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {loadingMsgs ? (
                <div className="text-center text-sm text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">
                  <p>No messages yet</p>
                  <p className="text-xs mt-1">Send the first message</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    const isSystem = msg.message_type === "system";

                    if (isSystem) {
                      return (
                        <div key={msg.id} className="text-center">
                          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                            {msg.message_content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          }`}
                        >
                          {msg.message_type === "file" && msg.file_url ? (
                            <a
                              href={msg.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 underline"
                            >
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="text-sm truncate">{msg.message_content}</span>
                            </a>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.message_content}</p>
                          )}
                          <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {format(new Date(msg.sent_at), "HH:mm")}
                            {isMe && msg.is_read && " ✓✓"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t border-border p-3 space-y-2">
              {/* Quick Templates */}
              <div className="flex gap-1 overflow-x-auto pb-1">
                {QUICK_TEMPLATES.map((tmpl, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs shrink-0 h-7"
                    onClick={() => setMessageInput(tmpl)}
                  >
                    {tmpl.slice(0, 25)}...
                  </Button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  className="shrink-0"
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
