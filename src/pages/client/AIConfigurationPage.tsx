import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  BookOpen, 
  Link as LinkIcon, 
  Database, 
  MessageSquare, 
  Phone, 
  Settings2,
  Upload,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  Globe,
  FileText,
  Brain
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useClient } from "@/contexts/ClientContext";

export default function AIConfigurationPage() {
  const { primaryColor } = useClient();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 1500);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-white to-accent/10 border border-primary/20 p-8 md:p-12 shadow-sm group"
      >
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
          <Sparkles className="w-64 h-64 text-primary" />
        </div>
        
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest">
            <Brain className="w-3 h-3" />
            Central Intelligence
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            AI Control <span className="text-primary font-black">Panel</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            Configure your AI's personality, knowledge base, and connections across all channels.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button className="rounded-xl shadow-lg shadow-primary/20 font-bold" style={{ backgroundColor: primaryColor }} onClick={handleSave}>
              {isSaving ? "Synchronizing..." : "Save All Changes"}
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-200 font-bold bg-white/50 backdrop-blur-sm">
              Live Preview
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Configuration Tabs */}
      <Tabs defaultValue="brain" className="space-y-8">
        <TabsList className="bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-primary/10 w-full md:w-auto h-auto grid grid-cols-2 md:grid-cols-4 gap-1 shadow-sm">
          <TabsTrigger value="brain" className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary font-bold">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Brain
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary font-bold">
            <BookOpen className="w-4 h-4 mr-2" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="connections" className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary font-bold">
            <Database className="w-4 h-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="channels" className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary font-bold">
            <Settings2 className="w-4 h-4 mr-2" />
            Channels
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          {/* AI Brain Tab */}
          <TabsContent value="brain">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden md:col-span-2">
                <CardHeader className="border-b border-sidebar-border/5 pb-6">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    System Prompt & Personality
                  </CardTitle>
                  <CardDescription>Define how your AI behaves and speaks to users.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global AI Personality</Label>
                    <Textarea 
                      placeholder="e.g., You are a helpful and professional real estate assistant for Pixoranest..."
                      className="min-h-[200px] bg-slate-50 border-slate-100 rounded-2xl p-4 focus:ring-primary/20 focus:border-primary/30 transition-all text-slate-700"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                      <Label className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-2">Creativity</Label>
                      <Progress value={45} className="h-1.5" />
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                        <span>PRECISE</span>
                        <span>CREATIVE</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-secondary/5 border border-secondary/10">
                      <Label className="text-[10px] font-bold text-secondary uppercase tracking-widest block mb-2">Friendliness</Label>
                      <Progress value={85} className="h-1.5" />
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                        <span>STRICT</span>
                        <span>WARM</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-accent/5 border border-accent/10">
                      <Label className="text-[10px] font-bold text-accent-foreground uppercase tracking-widest block mb-2">Verbosity</Label>
                      <Progress value={60} className="h-1.5" />
                      <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400">
                        <span>SHORT</span>
                        <span>DETAILED</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/5">
                  <CardTitle className="text-lg font-bold">Fallback Response</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">When AI doesn't know the answer</Label>
                  <Textarea 
                    placeholder="I apologize, I don't have that information. Let me connect you with a specialist."
                    className="bg-slate-50 border-slate-100 rounded-2xl"
                  />
                </CardContent>
              </Card>

              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/5">
                  <CardTitle className="text-lg font-bold">Handover Trigger</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Keyword for human escalation</Label>
                  <Input placeholder="talk to agent, help, human" className="bg-slate-50 border-slate-100 rounded-2xl" />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden md:col-span-2">
                  <CardHeader className="border-b border-sidebar-border/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" />
                        Trained Documents
                      </CardTitle>
                      <Button size="sm" className="rounded-xl font-bold shadow-sm" style={{ backgroundColor: primaryColor }}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload PDF/Doc
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {[
                        { name: "Company_Portfolio.pdf", size: "2.4 MB", date: "Mar 12, 2024" },
                        { name: "Pricing_Plans_2024.docx", size: "1.1 MB", date: "Mar 10, 2024" },
                        { name: "Support_Policy.pdf", size: "0.8 MB", date: "Mar 05, 2024" },
                      ].map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/30 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100 text-primary">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{doc.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">{doc.size} • Uploaded on {doc.date}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-sidebar-border/5">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Globe className="w-4 h-4 text-primary" />
                      Web Scraper
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <p className="text-xs text-slate-500">Train AI by crawling your website.</p>
                    <Input placeholder="https://example.com" className="rounded-xl bg-slate-50 border-slate-100" />
                    <Button variant="secondary" className="w-full rounded-xl font-bold bg-slate-100">Start Crawling</Button>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      Q&A / FAQs
                    </CardTitle>
                    <Button variant="outline" size="sm" className="rounded-xl font-bold border-slate-200">
                      <Plus className="w-4 h-4 mr-2" />
                      Add FAQ
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {[
                    "Do you offer refunds outside the guarantee period?",
                    "Can I customize the API integration?",
                    "What happens if usage limits are exceeded?"
                  ].map((q, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-2">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-bold text-slate-700">Q: {q}</p>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed italic">Response mapped to AI personality...</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/5">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-primary" />
                    Links & Funnels
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Primary Website URL</Label>
                    <Input placeholder="https://pixoranest.com" className="rounded-xl bg-slate-50 border-slate-100" />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Appointment Calendar Link</Label>
                    <Input placeholder="https://calendly.com/your-team" className="rounded-xl bg-slate-50 border-slate-100" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-sidebar-border/5">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    External Database
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center border border-slate-100">
                        <Database className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">CRM Integration</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Connection String (Optional)</Label>
                    <Input type="password" placeholder="postgresql://user:pass@host:port/db" className="rounded-xl bg-slate-50 border-slate-100" />
                    <p className="text-[10px] text-slate-400 italic font-medium">Allows AI to check lead status in real-time.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Channels Tab */}
          <TabsContent value="channels">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid gap-6 md:grid-cols-3"
            >
              {[
                { 
                  id: "chatbot", 
                  title: "Website Chatbot", 
                  icon: MessageSquare, 
                  desc: "Floating bubble on your site.", 
                  color: "#304f9f" 
                },
                { 
                  id: "caller", 
                  title: "AI Phone Caller", 
                  icon: Phone, 
                  desc: "Automated outbound outreach.", 
                  color: "#e11d48" 
                },
                { 
                  id: "livechat", 
                  title: "Live Chat AI", 
                  icon: Sparkles, 
                  desc: "Handover to human agents.", 
                  color: "#7c3aed" 
                },
              ].map((channel, idx) => (
                <Card key={idx} className="bg-white/95 border-primary/20 shadow-xl shadow-primary/5 rounded-3xl overflow-hidden group">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="h-12 w-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6"
                        style={{ backgroundColor: `${channel.color}15`, color: channel.color }}
                      >
                        <channel.icon className="w-6 h-6" />
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 leading-none">{channel.title}</h3>
                      <p className="text-xs text-slate-500 mt-2">{channel.desc}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full justify-between rounded-xl hover:bg-slate-50 group/btn">
                      <span className="text-xs font-bold text-slate-600">Advanced Settings</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          </TabsContent>
        </AnimatePresence>
      </Tabs>
      
      {/* Footer Save Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 md:hidden z-50">
        <Button className="w-full rounded-2xl h-12 font-bold text-lg" style={{ backgroundColor: primaryColor }} onClick={handleSave}>
          <Save className="w-5 h-5 mr-2" />
          {isSaving ? "Saving..." : "Save AI Brain"}
        </Button>
      </div>
    </div>
  );
}
