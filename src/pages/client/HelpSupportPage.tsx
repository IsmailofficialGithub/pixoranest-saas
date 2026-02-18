import { useState, useMemo } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Rocket, Zap, Users, DollarSign, MessageSquare, PlayCircle,
  ThumbsUp, ThumbsDown, Send, Phone, Mail, Globe, Keyboard,
  CheckCircle, BookOpen, HelpCircle, ExternalLink, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Static data ──

const quickLinks = [
  { icon: Rocket, title: "Getting Started", desc: "Learn the basics", category: "getting-started" },
  { icon: Zap, title: "Create Campaign", desc: "Start your first campaign", link: "/client/voice-telecaller" },
  { icon: Users, title: "Manage Leads", desc: "Work with your leads", link: "/client/leads" },
  { icon: DollarSign, title: "Billing & Usage", desc: "Understanding your bill", link: "/client/usage" },
  { icon: MessageSquare, title: "Contact Admin", desc: "Send a message", category: "contact" },
  { icon: PlayCircle, title: "View Tutorials", desc: "Watch video guides", category: "tutorials" },
];

interface FaqItem { q: string; a: string; related?: { label: string; link: string }[] }

const faqCategories: { name: string; items: FaqItem[] }[] = [
  {
    name: "Voice Services",
    items: [
      { q: "How do I create a calling campaign?", a: "Navigate to Voice Telecaller from your sidebar, click 'Create Campaign', then follow the wizard: name your campaign, upload contacts via CSV, write your script, and schedule or launch immediately.", related: [{ label: "Create campaign now", link: "/client/voice-telecaller" }] },
      { q: "What happens when I reach my usage limit?", a: "When you reach your usage limit, no new calls can be initiated until the next reset period or until your admin increases your limit. You'll receive a notification when you reach 80% and 100% of your limit.", related: [{ label: "View usage", link: "/client/usage" }] },
      { q: "Can I schedule calls for specific times?", a: "Yes! When creating a campaign you can choose 'Schedule for Later' and pick a date and time. The system will automatically start the campaign at your scheduled time." },
      { q: "How do I listen to call recordings?", a: "Go to Voice Telecaller → Call Logs. Each completed call has a play button to listen to the recording. You can also download recordings for offline review." },
      { q: "What is lead scoring?", a: "Lead scoring is an AI-powered system that rates leads from 0-100 based on conversation quality, interest level, and engagement. Higher scores indicate more qualified leads.", related: [{ label: "View leads", link: "/client/leads" }] },
    ],
  },
  {
    name: "WhatsApp Automation",
    items: [
      { q: "How do I send WhatsApp messages?", a: "Navigate to WhatsApp from your sidebar. You can send individual messages or create bulk campaigns using pre-approved templates." },
      { q: "What are WhatsApp templates?", a: "Templates are pre-approved message formats required by WhatsApp for business messaging. They ensure compliance with WhatsApp's policies and can include variables for personalization." },
      { q: "How do I track message delivery?", a: "Each message shows its delivery status: Queued → Sent → Delivered → Read. You can view detailed delivery stats in your WhatsApp dashboard." },
      { q: "Can I schedule WhatsApp campaigns?", a: "Yes, when creating a campaign you can schedule it for a future date and time. The messages will be sent automatically at the scheduled time." },
      { q: "What's the message character limit?", a: "WhatsApp messages can be up to 4,096 characters. However, for best engagement, we recommend keeping messages under 500 characters." },
    ],
  },
  {
    name: "Social Media",
    items: [
      { q: "How do I connect my social accounts?", a: "Go to Social Media → Connected Accounts. Click 'Connect' next to the platform you want to add. You'll be redirected to authorize the connection.", related: [{ label: "Social Media", link: "/client/social-media" }] },
      { q: "Can I schedule posts in advance?", a: "Yes! When creating a post, select 'Schedule for Later' and pick your desired date and time. You can also use the content calendar to manage scheduled posts." },
      { q: "Which platforms are supported?", a: "We currently support Facebook, Instagram, LinkedIn, and Twitter/X. You can post to multiple platforms simultaneously." },
      { q: "How do I view post analytics?", a: "Go to Social Media → Analytics tab to see engagement metrics, best posting times, and content performance across all platforms." },
      { q: "What's the best time to post?", a: "Our analytics dashboard shows your audience's most active times. Generally, weekdays between 10 AM - 2 PM work well, but check your specific analytics for personalized recommendations." },
    ],
  },
  {
    name: "Billing & Usage",
    items: [
      { q: "How is usage calculated?", a: "Usage is measured in units specific to each service: calls for voice services, messages for WhatsApp, and posts for social media. Each unit consumed counts against your monthly limit." },
      { q: "When does my usage limit reset?", a: "Your usage resets based on your plan's reset period (daily, weekly, or monthly). Check your Usage & Billing page to see your next reset date.", related: [{ label: "View usage", link: "/client/usage" }] },
      { q: "How do I request a limit increase?", a: "Go to Usage & Billing, find the service you need more of, and click 'Request Increase'. Your admin will be notified and can approve the change." },
      { q: "How can I download invoices?", a: "Navigate to Usage & Billing → Invoices section. Each invoice has a 'View Invoice' button with options to download as PDF." },
      { q: "What payment methods are accepted?", a: "Payment methods are managed by your admin. Contact them for details about accepted payment methods and billing cycles." },
    ],
  },
  {
    name: "Account & Settings",
    items: [
      { q: "How do I change my password?", a: "Go to Settings → Security tab. Enter your current password and your new password. Your new password must be at least 8 characters with uppercase, number, and special character.", related: [{ label: "Settings", link: "/client/settings" }] },
      { q: "How do I update my company information?", a: "Go to Settings → Profile tab. You can update your company name, industry, size, and website." },
      { q: "What data can my admin see?", a: "By default, your admin can see usage statistics and service assignments. You can control access to raw data (call recordings, messages) in Settings → Data & Privacy." },
      { q: "How do I export my data?", a: "Go to Settings → Data & Privacy tab. Click 'Download My Data' to generate an export of all your data in JSON/CSV format." },
      { q: "How do I delete my account?", a: "Go to Settings → Data & Privacy → Account Deletion section. Please note this action is permanent and will delete all your data." },
    ],
  },
];

const allFaqItems = faqCategories.flatMap((cat) =>
  cat.items.map((item) => ({ ...item, category: cat.name }))
);

const tutorials = [
  { title: "Getting Started with Your Dashboard", duration: "3:45", category: "Getting Started" },
  { title: "Creating Your First Voice Campaign", duration: "5:20", category: "Voice" },
  { title: "Understanding Call Analytics", duration: "4:10", category: "Voice" },
  { title: "Setting Up WhatsApp Automation", duration: "6:00", category: "WhatsApp" },
  { title: "Scheduling Social Media Posts", duration: "4:30", category: "Social Media" },
  { title: "Managing and Scoring Leads", duration: "5:15", category: "Leads" },
  { title: "Reading Your Usage & Billing", duration: "3:00", category: "Billing" },
  { title: "Best Practices for Call Scripts", duration: "7:20", category: "Voice" },
  { title: "Connecting Social Media Accounts", duration: "2:45", category: "Social Media" },
];

const shortcuts = [
  { keys: "Ctrl + K", desc: "Open search" },
  { keys: "N", desc: "Create new campaign" },
  { keys: "L", desc: "Go to leads" },
  { keys: "U", desc: "Go to usage" },
  { keys: "?", desc: "Show all shortcuts" },
];

// ── Component ──

export default function HelpSupportPage() {
  const { admin } = useClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactType, setContactType] = useState("technical");
  const [contactPriority, setContactPriority] = useState("medium");
  const [activeTab, setActiveTab] = useState("faq");
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "up" | "down">>({});

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allFaqItems
      .filter((item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search]);

  const handleQuickLink = (ql: typeof quickLinks[0]) => {
    if (ql.link) navigate(ql.link);
    else if (ql.category === "tutorials") setActiveTab("tutorials");
    else if (ql.category === "contact") setContactOpen(true);
    else if (ql.category === "getting-started") setActiveTab("docs");
  };

  const handleSubmitTicket = () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      toast({ title: "Missing fields", description: "Please fill in subject and description.", variant: "destructive" });
      return;
    }
    toast({ title: "Ticket submitted!", description: "We'll respond within 24 hours." });
    setContactOpen(false);
    setContactSubject("");
    setContactMessage("");
  };

  const giveFeedback = (id: string, type: "up" | "down") => {
    setFeedbackGiven((prev) => ({ ...prev, [id]: type }));
    toast({ title: type === "up" ? "Glad it helped!" : "Sorry about that", description: type === "down" ? "We'll work on improving this answer." : undefined });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
          <p className="text-sm text-muted-foreground">Get help with your services and account</p>
        </div>
        <Button onClick={() => setContactOpen(true)}>
          <Send className="mr-2 h-4 w-4" /> Contact Support
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search for help..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-12 h-12 text-base"
        />
        {searchResults.length > 0 && (
          <Card className="absolute top-full left-0 right-0 mt-1 z-50">
            <ScrollArea className="max-h-[300px]">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 border-b last:border-0"
                  onClick={() => { setSearch(""); setActiveTab("faq"); }}
                >
                  <HelpCircle className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.q}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{r.category}</Badge>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </Card>
        )}
        {search.trim() && searchResults.length === 0 && (
          <Card className="absolute top-full left-0 right-0 mt-1 z-50 p-6 text-center">
            <p className="text-sm text-muted-foreground">No results found for "{search}"</p>
            <Button variant="link" size="sm" onClick={() => { setSearch(""); setContactOpen(true); }}>Contact support</Button>
          </Card>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">How can we help you?</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map((ql) => {
            const Icon = ql.icon;
            return (
              <Card
                key={ql.title}
                className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                onClick={() => handleQuickLink(ql)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground">{ql.title}</p>
                    <p className="text-xs text-muted-foreground">{ql.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tabs: FAQ / Tutorials / Docs / Status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        {/* FAQ */}
        <TabsContent value="faq" className="space-y-6 mt-6">
          {faqCategories.map((cat) => (
            <Card key={cat.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple">
                  {cat.items.map((item, idx) => {
                    const faqId = `${cat.name}-${idx}`;
                    return (
                      <AccordionItem key={idx} value={faqId}>
                        <AccordionTrigger className="text-sm text-left">{item.q}</AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground mb-3">{item.a}</p>
                          {item.related && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {item.related.map((r) => (
                                <Button key={r.label} variant="outline" size="sm" onClick={() => navigate(r.link)}>
                                  {r.label} <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <span className="text-xs text-muted-foreground">Was this helpful?</span>
                            <Button
                              variant={feedbackGiven[faqId] === "up" ? "default" : "ghost"}
                              size="icon" className="h-7 w-7"
                              onClick={() => giveFeedback(faqId, "up")}
                            >
                              <ThumbsUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant={feedbackGiven[faqId] === "down" ? "destructive" : "ghost"}
                              size="icon" className="h-7 w-7"
                              onClick={() => giveFeedback(faqId, "down")}
                            >
                              <ThumbsDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Tutorials */}
        <TabsContent value="tutorials" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tutorials.map((t, i) => (
              <Card key={i} className="cursor-pointer hover:shadow-sm transition-all group">
                <CardContent className="p-0">
                  <div className="relative bg-muted aspect-video flex items-center justify-center rounded-t-lg">
                    <PlayCircle className="h-12 w-12 text-primary/60 group-hover:text-primary transition-colors" />
                    <Badge className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px]">{t.duration}</Badge>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-sm text-foreground">{t.title}</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">{t.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Documentation */}
        <TabsContent value="docs" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "Getting Started", icon: Rocket, topics: ["Welcome to the platform", "Setting up your account", "Understanding your dashboard", "Your first campaign"] },
              { title: "Voice Services", icon: Phone, topics: ["Voice Telecaller Guide", "Creating campaigns", "Call scripts best practices", "Analyzing results"] },
              { title: "WhatsApp Automation", icon: MessageSquare, topics: ["Getting started with WhatsApp", "Message templates", "Bulk campaigns", "Chatbot setup"] },
              { title: "Social Media", icon: Globe, topics: ["Connecting accounts", "Creating posts", "Scheduling strategies", "Analytics interpretation"] },
              { title: "Leads Management", icon: Users, topics: ["Understanding lead scoring", "Kanban board workflow", "Exporting leads", "CRM integration"] },
              { title: "Billing & Usage", icon: DollarSign, topics: ["Understanding usage limits", "Reading invoices", "Payment methods", "Cost optimization"] },
            ].map((section) => {
              const Icon = section.icon;
              return (
                <Card key={section.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-primary" /> {section.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {section.topics.map((topic) => (
                        <li key={topic}>
                          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left">
                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                            {topic}
                            <ExternalLink className="h-3 w-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* System Status */}
        <TabsContent value="status" className="mt-6 space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div>
                  <p className="font-semibold text-foreground">All Systems Operational</p>
                  <p className="text-xs text-muted-foreground">Last checked just now</p>
                </div>
              </div>
              <div className="space-y-3">
                {["Voice Services", "WhatsApp Automation", "Social Media", "API Gateway", "Dashboard", "Notifications"].map((svc) => (
                  <div key={svc} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-foreground">{svc}</span>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-xs text-muted-foreground">Operational</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Keyboard Shortcuts */}
      <Card>
        <Accordion type="single" collapsible>
          <AccordionItem value="shortcuts" className="border-0">
            <AccordionTrigger className="px-6 py-4">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Keyboard Shortcuts</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {shortcuts.map((s) => (
                  <div key={s.keys} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">{s.desc}</span>
                    <kbd className="px-2 py-0.5 text-xs bg-muted rounded border font-mono">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Still need help */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-6 text-center">
          <h3 className="font-semibold text-foreground mb-1">Still need help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {admin ? `Reach out to ${admin.company_name} or submit a support ticket` : "Submit a support ticket and we'll get back to you"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => setContactOpen(true)}>
              <Mail className="mr-2 h-4 w-4" /> Submit Ticket
            </Button>
            {admin && (
              <Button variant="outline" onClick={() => navigate("/client")}>
                <MessageSquare className="mr-2 h-4 w-4" /> Message Admin
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact / Ticket Dialog */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issue Type</Label>
                <Select value={contactType} onValueChange={setContactType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="billing">Billing Question</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={contactPriority} onValueChange={setContactPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} placeholder="Brief summary of your issue" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={contactMessage} onChange={(e) => setContactMessage(e.target.value)} placeholder="Describe your issue in detail..." rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitTicket}>Submit Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
