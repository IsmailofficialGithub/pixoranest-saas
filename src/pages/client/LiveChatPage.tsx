import { useState, useRef, useEffect } from "react";
import { 
  MessageSquare, 
  Search, 
  User, 
  Paperclip, 
  Send, 
  MoreHorizontal, 
  Sparkles, 
  CheckCheck, 
  Clock, 
  Phone, 
  Mail, 
  ExternalLink,
  Bot,
  UserCheck,
  Filter,
  Trash2,
  Archive,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useClient } from "@/contexts/ClientContext";

// --- Mock Data ---
const MOCK_CHATS = [
  {
    id: "1",
    name: "Rahul Sharma",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul",
    lastMessage: "Is there a discount for annual billing?",
    time: "10:30 AM",
    unread: 2,
    status: "online",
    assignedTo: "AI Agent",
    labels: ["Pricing", "Hot Lead"]
  },
  {
    id: "2",
    name: "Sneha Gupta",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sneha",
    lastMessage: "I need help with the API integration.",
    time: "Yesterday",
    unread: 0,
    status: "offline",
    assignedTo: "You",
    labels: ["Technical"]
  },
  {
    id: "3",
    name: "Vikram Singh",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram",
    lastMessage: "Thank you for the quick response!",
    time: "Monday",
    unread: 0,
    status: "online",
    assignedTo: "AI Agent",
    labels: ["General"]
  }
];

const MOCK_MESSAGES = [
  { id: "m2", sender: "ai", text: "Hi! I'm the Pixora AI assistant. How can I help you regarding our pricing or services today?", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isAI: true },
];

export default function LiveChatPage() {
  const { primaryColor } = useClient();
  const [selectedChat, setSelectedChat] = useState(MOCK_CHATS[0]);
  const [message, setMessage] = useState("");
  const [isAIActive, setIsAIActive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Real Chat State
  const [chatMessages, setChatMessages] = useState<any[]>(MOCK_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, selectedChat]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    const userText = message.trim();
    setMessage(""); // Clear input immediately
    
    // Optimistic UI update
    const userMsg = { 
        id: Date.now().toString(), 
        sender: "customer", 
        text: userText, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
        const { data, error } = await supabase.functions.invoke('ai-chat', {
            body: {
                userMessage: userText,
                sessionId: sessionId,
                chatbotId: null, // Use default
                isNewSession: !sessionId
            }
        });

        if (error) {
            console.error("Error from AI:", error);
            const errorMsg = { 
                id: Date.now().toString(), 
                sender: "ai", 
                text: "Sorry, I am having trouble connecting to my servers.", 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                isAI: true 
            };
            setChatMessages(prev => [...prev, errorMsg]);
        } else if (data) {
            if (data.sessionId) setSessionId(data.sessionId);
            const aiMsg = { 
                id: Date.now().toString(), 
                sender: "ai", 
                text: data.message, 
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                isAI: true 
            };
            setChatMessages(prev => [...prev, aiMsg]);
        }
    } catch (err) {
        console.error("Failed to send message:", err);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-3xl bg-white/50 backdrop-blur-xl border border-primary/10 shadow-2xl">
      
      {/* 1. Sidebar: Chat List */}
      <div className="w-80 flex flex-col border-r border-sidebar-border/10 bg-white/30">
        <div className="p-4 border-b border-sidebar-border/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-800 tracking-tight">LeadNest <span className="text-primary">Chat</span></h2>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Filter className="w-4 h-4 text-slate-500" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search conversations..." 
              className="pl-9 bg-white/50 border-white/20 rounded-xl text-sm focus:ring-primary/20"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {MOCK_CHATS.map((chat) => (
              <motion.div
                key={chat.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedChat(chat)}
                className={cn(
                  "p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 relative overflow-hidden group",
                  selectedChat.id === chat.id 
                    ? "bg-white shadow-md border border-primary/10" 
                    : "hover:bg-white/40"
                )}
              >
                {selectedChat.id === chat.id && (
                  <motion.div 
                    layoutId="chat-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary" 
                  />
                )}
                
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                    <AvatarImage src={chat.avatar} />
                    <AvatarFallback>{chat.name[0]}</AvatarFallback>
                  </Avatar>
                  {chat.status === "online" && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-bold text-sm text-slate-800 truncate">{chat.name}</span>
                    <span className="text-[10px] font-medium text-slate-400">{chat.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate leading-relaxed">
                    {chat.lastMessage}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
                    {chat.labels.map(l => (
                      <span key={l} className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold uppercase tracking-wider">{l}</span>
                    ))}
                  </div>
                </div>

                {chat.unread > 0 && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-primary/20">
                    {chat.unread}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 2. Main: Chat Window */}
      <div className="flex-1 flex flex-col bg-white/20">
        {/* Chat Header */}
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border/10">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-white">
              <AvatarImage src={selectedChat.avatar} />
              <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-slate-800 leading-tight">{selectedChat.name}</h3>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <UserCheck className="w-3 h-3" />
                  Assigned to: <span className="text-primary">{selectedChat.assignedTo}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-4 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-wider">AI Agent Active</span>
              <Switch checked={isAIActive} onCheckedChange={setIsAIActive} className="scale-75 data-[state=checked]:bg-primary" />
            </div>
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50">
              <Phone className="w-4 h-4 text-slate-500" />
            </Button>
            <DropdownMenuWrapper />
          </div>
        </div>

        {/* Chat Messages */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-center my-4">
              <span className="text-[10px] font-bold text-slate-400 border border-slate-100 rounded-full px-3 py-1 uppercase tracking-widest bg-white/30">Conversation started today</span>
            </div>

            <AnimatePresence>
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.sender === "customer" ? "mr-auto items-start" : "ml-auto items-end"
                  )}
                >
                  <div className={cn(
                    "relative p-4 rounded-3xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap",
                    msg.sender === "customer" 
                      ? "bg-white text-slate-700 rounded-tl-none border border-slate-100" 
                      : msg.isAI 
                        ? "bg-gradient-to-br from-primary/90 to-primary text-white rounded-tr-none shadow-lg shadow-primary/10"
                        : "bg-slate-800 text-white rounded-tr-none shadow-lg shadow-black/10"
                  )}>
                    {msg.isAI && (
                      <div className="absolute -top-3 -right-2 bg-white/20 backdrop-blur-md rounded-full p-1 border border-white/20 shadow-sm">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-2">
                    <span className="text-[9px] font-bold text-slate-400">{msg.time}</span>
                    {msg.sender !== "customer" && <CheckCheck className="w-3 h-3 text-primary" />}
                  </div>
                </motion.div>
              ))}
              
              {isLoading && (
                 <motion.div
                 initial={{ opacity: 0, y: 10, scale: 0.95 }}
                 animate={{ opacity: 1, y: 0, scale: 1 }}
                 className="flex flex-col max-w-[80%] ml-auto items-end"
               >
                 <div className="relative p-4 rounded-3xl text-sm leading-relaxed shadow-sm bg-gradient-to-br from-primary/90 to-primary text-white rounded-tr-none shadow-lg shadow-primary/10">
                   <div className="absolute -top-3 -right-2 bg-white/20 backdrop-blur-md rounded-full p-1 border border-white/20 shadow-sm">
                     <Sparkles className="h-3 w-3 text-white animate-spin" />
                   </div>
                   <div className="flex gap-1 items-center h-5">
                       <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                       <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                       <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                   </div>
                 </div>
               </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Chat Input */}
        <div className="p-4 bg-white/30 border-t border-sidebar-border/10">
          <div className="max-w-4xl mx-auto relative flex items-center gap-2">
            <div className="flex-1 relative">
              <Input 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type your message here..."
                className="w-full bg-white border-white/20 h-12 pl-4 pr-24 rounded-2xl shadow-inner focus:ring-primary/20 overflow-hidden"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-slate-100">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-slate-100">
                  <Sparkles className="w-4 h-4 text-primary" />
                </Button>
              </div>
            </div>
            <Button 
              onClick={handleSendMessage}
              className="h-12 w-12 rounded-2xl shadow-lg shadow-primary/20 hover:scale-105 transition-transform shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Details: Lead Panel */}
      <div className="w-72 border-l border-sidebar-border/10 bg-white/40 hidden xl:flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {/* User Overview */}
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20 border-4 border-white shadow-xl mb-4">
                <AvatarImage src={selectedChat.avatar} />
                <AvatarFallback>{selectedChat.name[0]}</AvatarFallback>
              </Avatar>
              <h3 className="text-lg font-bold text-slate-800">{selectedChat.name}</h3>
              <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1">Lead High Potential</p>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Contact Context</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 group">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm text-slate-400 group-hover:text-primary transition-colors">
                    <Phone className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">+91 98765 43210</span>
                </div>
                <div className="flex items-center gap-3 group">
                  <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center border border-slate-100 shadow-sm text-slate-400 group-hover:text-primary transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-600 truncate">{selectedChat.name.toLowerCase()}@gmail.com</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2">Recent Activity</h4>
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                <ActivityItem title="Leads Form Submitted" time="2h ago" icon={<div className="w-2.5 h-2.5 rounded-full bg-primary" />} />
                <ActivityItem title="Visited Pricing Page" time="3h ago" icon={<div className="w-2.5 h-2.5 rounded-full bg-slate-300" />} />
                <ActivityItem title="First Interaction" time="5h ago" icon={<div className="w-2.5 h-2.5 rounded-full bg-slate-300" />} />
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl border-slate-100 text-[10px] font-bold uppercase h-9">
                <Archive className="w-3 h-3 mr-2" /> Archive
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-100 text-[10px] font-bold uppercase h-9 hover:text-red-500 hover:bg-red-50">
                <Trash2 className="w-3 h-3 mr-2" /> Delete
              </Button>
              <Button variant="outline" className="rounded-xl border-slate-100 text-[10px] font-bold uppercase h-9 col-span-2">
                <ExternalLink className="w-3 h-3 mr-2" /> View Full CRM Lead
              </Button>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function DropdownMenuWrapper() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white/50">
          <MoreHorizontal className="w-4 h-4 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl border-slate-100">
        <DropdownMenuItem className="py-2.5 font-bold text-xs"><UserCheck className="w-3.5 h-3.5 mr-2" /> Assign to Agent</DropdownMenuItem>
        <DropdownMenuItem className="py-2.5 font-bold text-xs"><Archive className="w-3.5 h-3.5 mr-2" /> Archive Conversation</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="py-2.5 font-bold text-xs text-red-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Chat</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityItem({ title, time, icon }: { title: string; time: string; icon: React.ReactNode }) {
  return (
    <div className="relative group">
      <div className="absolute -left-[1.35rem] top-1 z-10">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-700 leading-none">{title}</p>
        <p className="text-[10px] text-slate-400 mt-1">{time}</p>
      </div>
    </div>
  );
}
