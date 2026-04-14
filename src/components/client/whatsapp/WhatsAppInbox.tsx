import { useState, useMemo } from "react";
import { 
  Search, MoreVertical, Paperclip, Smile, Send, 
  MessageSquare, User, Filter, Phone, CheckCheck, 
  ChevronDown, Image as ImageIcon, FileText, Zap, 
  MoreHorizontal, Bot, Clock, X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Dummy Data ─── */
const DUMMY_CHATS = [
  {
    id: "1",
    name: "Bhagirath Saini",
    phone: "+919315559719",
    lastMessage: "Theek hai Bhagirath, jab bhi aapko WhatsApp...",
    timestamp: "Yesterday",
    unread: 0,
    status: "All",
    avatar: "BS",
    optIn: true,
    messages: [
      { id: "m1", sender: "them", text: "Mujhe pahle steps me batao kaise kaise help karoge", timestamp: "08:36 pm" },
      { id: "m2", sender: "bot", text: "Sure Bhagirath! PixoraNest aapki madad kaise karta hai:\n- Aapke WhatsApp leads ko turant capture aur organize karta hai\n- Automated replies se har inquiry ka jawab turant jaata hai, 24/7\n- Follow-up reminders set karta hai taaki koi lead miss na ho\n- Lead conversion tracking se aapko performance samajh aaye\nAap agar chahein to main demo schedule karwa ke poora process dikha sakti hoon.", timestamp: "08:36 pm", status: "read" },
      { id: "m3", sender: "them", text: "Abhi nahi", timestamp: "08:37 pm" },
      { id: "m4", sender: "bot", text: "Theek hai Bhagirath, jab bhi aapko WhatsApp automation mein madad ki zarurat ho, main yahan hoon. Feel free to reach out anytime 😊", timestamp: "08:37 pm", status: "read" },
    ]
  },
  {
    id: "2",
    name: "inflow influencers llp",
    phone: "+919876543210",
    lastMessage: "I'd be happy to arrange a call 😊 Could you...",
    timestamp: "Yesterday",
    unread: 2,
    status: "New Lead",
    avatar: "II",
    messages: [
      { id: "m1", sender: "them", text: "I'd be happy to arrange a call 😊 Could you send me more details?", timestamp: "Yesterday" }
    ]
  },
  {
    id: "3",
    name: "Faizan Hassan",
    phone: "+918888888888",
    lastMessage: "No availability on 14-Apr unfortunately. Would you...",
    timestamp: "Monday",
    unread: 0,
    status: "Follow-UP",
    avatar: "FH",
    messages: []
  },
  {
    id: "4",
    name: "Kuldeep Bansur",
    phone: "+910000000000",
    lastMessage: "Dhanyavaad, Kuldeep ji. Aapka email address bhi...",
    timestamp: "Monday",
    unread: 0,
    status: "Demo",
    avatar: "KB",
    messages: []
  }
];

const FILTERS = ["All", "Closed Deal", "Demo", "Demo Pending", "Follow-UP", "Junk Leads", "New Lead"];

export default function WhatsAppInbox() {
  const [activeChatId, setActiveChatId] = useState(DUMMY_CHATS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [messageInput, setMessageInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeChat = useMemo(() => 
    DUMMY_CHATS.find(c => c.id === activeChatId) || DUMMY_CHATS[0], 
  [activeChatId]);

  const filteredChats = DUMMY_CHATS.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         chat.phone.includes(searchQuery);
    const matchesFilter = activeFilter === "All" || chat.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex bg-[#0B0E11] dark:bg-card rounded-3xl overflow-hidden border border-border shadow-2xl min-h-[600px] h-[calc(100vh-210px)] relative">
      {/* ─── Sidebar ─── */}
      <div className={cn(
        "flex flex-col border-r border-border bg-[#14171A] dark:bg-card/50 transition-all duration-300 z-20 overflow-hidden",
        "fixed inset-0 w-full sm:relative sm:inset-auto sm:w-[320px] md:w-[380px] sm:h-full sm:translate-x-0",
        !sidebarOpen ? "-translate-x-full sm:translate-x-0" : "translate-x-0"
      )}>
        {/* Filters */}
        <div className="p-4 space-y-4 border-b border-white/5">
          <div className="flex items-center justify-between sm:hidden">
            <h2 className="text-lg font-bold text-white">Inbox</h2>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5 text-white" />
            </Button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                  activeFilter === f 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-white/5 text-slate-400 border-white/10 hover:border-white/20"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Search here..." 
              className="pl-10 h-10 bg-[#1D2125] border-none text-sm placeholder:text-slate-600 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-slate-200"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="flex flex-col">
            {filteredChats.map(chat => (
              <button
                key={chat.id}
                onClick={() => {
                  setActiveChatId(chat.id);
                  if (window.innerWidth < 640) setSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 p-4 transition-all hover:bg-white/5 relative group text-left w-full",
                  activeChatId === chat.id ? "bg-white/10" : ""
                )}
              >
                {activeChatId === chat.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}
                <Avatar className="h-12 w-12 border-2 border-white/5 shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-white font-bold">
                    {chat.avatar || chat.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-white">{chat.name}</h4>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">{chat.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate leading-relaxed">
                    {chat.lastMessage}
                  </p>
                </div>
                {chat.unread > 0 && (
                  <div className="bg-primary h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                    {chat.unread}
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* ─── Chat Window ─── */}
      <div className="flex-1 flex flex-col bg-[#0B0E11] relative shadow-inner h-full">
        {/* Chat Header */}
        <div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/5 bg-[#14171A]/80 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setSidebarOpen(true)}>
              <ChevronDown className="h-5 w-5 text-white rotate-90" />
            </Button>
            <Avatar className="h-8 w-8 md:h-10 md:w-10 border border-white/10">
              <AvatarFallback className="bg-slate-800 text-white text-xs font-bold">{activeChat.avatar}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2 md:gap-3">
                <h3 className="text-sm md:text-base font-black text-white tracking-tight truncate">{activeChat.name}</h3>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                  <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[8px] md:text-[9px] font-bold text-primary uppercase tracking-widest">OptIn</span>
                </div>
              </div>
              <p className="text-[9px] md:text-[11px] text-slate-500 font-medium truncate">{activeChat.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden lg:flex items-center bg-[#1D2125] rounded-xl px-4 py-2 border border-white/5 gap-3">
              <span className="text-xs font-bold text-slate-300 font-mono tracking-tighter">{activeChat.phone}</span>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex items-center gap-2">
                <div className="p-1 bg-green-500/20 rounded-md">
                   <MessageSquare className="h-3 w-3 text-green-500" />
                </div>
                <ChevronDown className="h-3 w-3 text-slate-500" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500" />
              <span className="text-[8px] md:text-[10px] font-bold text-green-500 uppercase tracking-widest whitespace-nowrap">Connected</span>
            </div>
          </div>
        </div>

        {/* Message List */}
        <ScrollArea className="flex-1 px-4 py-4 md:p-6 min-h-0">
          <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-6">
            {activeChat.messages.length > 0 ? (
              <AnimatePresence mode="popLayout" initial={false}>
                {activeChat.messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "flex flex-col max-w-[90%] md:max-w-[80%]",
                      msg.sender === "them" ? "self-start items-start" : "self-end items-end"
                    )}
                  >
                    <div className="flex items-end gap-2 md:gap-3">
                       {msg.sender === "them" && (
                          <Avatar className="h-6 w-6 md:h-8 md:w-8 shrink-0">
                            <AvatarFallback className="bg-slate-700 text-[8px] md:text-[10px] text-white font-bold">{activeChat.avatar}</AvatarFallback>
                          </Avatar>
                       )}
                       <div className={cn(
                          "px-3 py-2 md:px-4 md:py-3 rounded-2xl text-[13px] md:text-sm relative group whitespace-pre-wrap leading-relaxed transition-all",
                          msg.sender === "them" 
                            ? "bg-[#1D2125] text-slate-200 rounded-bl-none border border-white/5" 
                            : "bg-primary text-primary-foreground rounded-br-none shadow-lg shadow-primary/10"
                        )}>
                          {msg.text}
                          <div className={cn(
                            "flex items-center gap-1 mt-1 justify-end",
                            msg.sender === "them" ? "text-slate-500" : "text-white/60"
                          )}>
                            <span className="text-[9px] md:text-[10px] font-medium">{msg.timestamp}</span>
                            {msg.sender !== "them" && <CheckCheck className="h-2.5 w-2.5 md:h-3 md:w-3 text-white/80" />}
                          </div>
                          
                          <div className={cn(
                            "absolute top-0 hidden group-hover:flex items-center gap-1 transition-opacity animate-in fade-in zoom-in duration-200",
                            msg.sender === "them" ? "-right-8 md:-right-10 flex-col" : "-left-8 md:-left-10 flex-col"
                          )}>
                            <Button variant="ghost" size="icon" className="h-6 w-6 md:h-8 md:w-8 rounded-full bg-white/5 hover:bg-white/10">
                              <MoreHorizontal className="h-3 w-3 md:h-4 md:w-4 text-slate-400" />
                            </Button>
                            {msg.sender === 'bot' && (
                              <div className="p-1 md:p-1.5 bg-primary/10 rounded-full border border-primary/20" title="Sent by AI Bot">
                                <Bot className="h-2.5 w-2.5 md:h-3 md:w-3 text-primary" />
                              </div>
                            )}
                          </div>
                          
                          {/* Bot Indicator Badge for Chat Bubbles */}
                          {msg.sender === 'bot' && (
                            <div className="absolute -right-2 -top-2 p-0.5 md:p-1 bg-[#14171A] border border-primary/20 rounded-full shadow-lg">
                              <Bot className="h-2 w-2 md:h-2.5 md:w-2.5 text-primary" />
                            </div>
                          )}
                       </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : (
                <div className="flex flex-col items-center justify-center h-full py-20 text-center opacity-40">
                    <MessageSquare className="h-12 w-12 md:h-16 md:w-16 mb-4 text-slate-500" />
                    <p className="text-xs md:text-sm font-medium text-slate-400">No messages yet with this contact</p>
                    <p className="text-[10px] md:text-xs text-slate-500 max-w-[200px] mt-2 italic">Start the conversation by sending a template or manual message</p>
                </div>
            )}
          </div>
        </ScrollArea>
 
        {/* Chat Input */}
        <div className="p-4 md:p-6 bg-[#14171A]/90 backdrop-blur-md border-t border-white/5 z-10 shrink-0">
          <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">
            <div className="relative group">
              <Input 
                placeholder="Type a message..." 
                className="w-full bg-[#1D2125] border-none py-5 md:py-7 px-4 md:px-6 text-[13px] md:text-sm placeholder:text-slate-500 rounded-xl md:rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/20 pr-12 text-slate-200"
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
              />
              <div className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2">
                <Button 
                  size="icon" 
                  className={cn(
                    "h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl transition-all",
                    messageInput ? "bg-primary text-primary-foreground scale-100 shadow-lg shadow-primary/20" : "bg-transparent text-slate-500 scale-90 pointer-events-none"
                  )}
                >
                  <Send className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </div>
            </div>
 
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar pb-1">
                <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg md:rounded-xl h-8 md:h-9 px-3 md:px-4 text-[10px] md:text-[12px]">
                  <Smile className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 shrink-0" />
                  Emoji
                </Button>
                <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg md:rounded-xl h-8 md:h-9 px-3 md:px-4 text-[10px] md:text-[12px]">
                  <Paperclip className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 shrink-0" />
                  Attachments
                </Button>
                <Button variant="ghost" size="sm" className="bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg md:rounded-xl h-8 md:h-9 px-3 md:px-4 text-[10px] md:text-[12px]">
                  <Zap className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 shrink-0" />
                  Templates
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="p-2 md:p-2.5 bg-primary/10 rounded-lg md:rounded-xl border border-primary/20 cursor-pointer hover:bg-primary/20 transition-all flex items-center justify-center">
                   <div className="flex items-end space-x-0.5 h-3 md:h-4">
                     <div className="w-0.5 h-1.5 md:h-2 bg-primary rounded-full" />
                     <div className="w-0.5 h-3 md:h-4 bg-primary rounded-full" />
                     <div className="w-0.5 h-2.5 md:h-3 bg-primary rounded-full" />
                     <div className="w-0.5 h-2 md:h-2.5 bg-primary rounded-full" />
                     <div className="w-0.5 h-3 md:h-3.5 bg-primary rounded-full" />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
