import { useState, useCallback, useEffect } from "react";
import { 
  Layout, 
  Sparkles, 
  Plus, 
  Eye, 
  Save, 
  Globe, 
  Smartphone, 
  Monitor, 
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Settings2,
  Image as ImageIcon,
  Type,
  MousePointer2,
  Layers,
  Wand2,
  Trash2,
  ArrowRight,
  RefreshCw,
  X,
  CheckCircle2,
  Menu
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClient } from "@/contexts/ClientContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --- Types ---
interface SectionContent {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  image?: string;
  items?: { title: string; desc: string; icon?: string }[];
}

interface PageSection {
  id: string;
  type: "hero" | "features" | "testimonials" | "cta";
  content: SectionContent;
}

// --- Default Data ---
const DEFAULT_SECTIONS: Record<string, SectionContent> = {
  hero: {
    title: "Premium AI Solutions for Your Business",
    subtitle: "Scale faster with automated workflows and intelligent agents.",
    buttonText: "Start Free Trial",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
  },
  features: {
    title: "Why Choose Pixora Nest?",
    items: [
      { title: "AI Automation", desc: "Save 40+ hours per week on manual tasks." },
      { title: "Real-time Data", desc: "Make informed decisions with instant analytics." },
      { title: "24/7 Support", desc: "Our AI agents never sleep, ensuring your growth." }
    ]
  },
  testimonials: {
    title: "Loved by 500+ Businesses",
    items: [
      { title: "Ankit Varma", desc: "Pixora transformed our sales process overnight." },
      { title: "Sarah Jones", desc: "The AI receptionist is a game changer for my clinic." }
    ]
  },
  cta: {
    title: "Ready to Automate Your Success?",
    description: "Join the elite businesses using AI to lead their categories.",
    buttonText: "Join Now"
  }
};

const BLOCKS = [
  { id: "hero", name: "Hero Section", icon: <Monitor className="w-4 h-4" /> },
  { id: "features", name: "Features Grid", icon: <Layout className="w-4 h-4" /> },
  { id: "testimonials", name: "Social Proof", icon: <Type className="w-4 h-4" /> },
  { id: "cta", name: "Call to Action", icon: <MousePointer2 className="w-4 h-4" /> },
];

export default function LandingPageBuilder() {
  const { primaryColor } = useClient();
  const [mode, setMode] = useState<"gallery" | "editor" | "ai">("gallery");
  const [viewDevice, setViewDevice] = useState<"desktop" | "mobile">("desktop");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Real Logic State
  const [sections, setSections] = useState<PageSection[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("My Landing Page");
  const [isPublishing, setIsPublishing] = useState(false);

  // Persistence Logic
  useEffect(() => {
    const saved = localStorage.getItem("pixora_landing_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.sections) setSections(parsed.sections);
        if (parsed.title) setPageTitle(parsed.title);
      } catch (e) { console.error("Failed to load draft"); }
    }
  }, []);

  useEffect(() => {
    if (sections.length > 0) {
      localStorage.setItem("pixora_landing_draft", JSON.stringify({ sections, title: pageTitle }));
    }
  }, [sections, pageTitle]);

  const addSection = (type: string) => {
    const newSection: PageSection = {
      id: Math.random().toString(36).substr(2, 9),
      type: type as any,
      content: { ...DEFAULT_SECTIONS[type] },
    };
    setSections([...sections, newSection]);
    setSelectedSectionId(newSection.id);
    toast.success(`${type.toUpperCase()} section added`);
  };

  const removeSection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSections(sections.filter(s => s.id !== id));
    if (selectedSectionId === id) setSelectedSectionId(null);
  };

  const updateSectionContent = (id: string, field: keyof SectionContent, value: any) => {
    setSections(sections.map(s => {
      if (s.id === id) {
        return { ...s, content: { ...s.content, [field]: value } };
      }
      return s;
    }));
  };

  const updateFeatureItem = (sectionId: string, index: number, field: string, value: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId && s.content.items) {
        const newItems = [...s.content.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return { ...s, content: { ...s.content, items: newItems } };
      }
      return s;
    }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    setSections(newSections);
  };

  const handlePublish = () => {
    if (sections.length === 0) {
      toast.error("Add at least one section before publishing");
      return;
    }
    setIsPublishing(true);
    toast.info("Connecting to Edge Network...");
    
    setTimeout(() => {
      setIsPublishing(false);
      toast.success("Page Live: pixora.link/" + pageTitle.toLowerCase().replace(/\s+/g, '-'), {
        description: "Your conversion engine is now operational on global CDNs.",
        duration: 5000,
      });
    }, 3000);
  };

  const handleAiGenerate = () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    // Simulate AI Generation by picking 3 sections
    setTimeout(() => {
      const generated: PageSection[] = [
        { id: "ai-1", type: "hero", content: { ...DEFAULT_SECTIONS.hero, title: `AI Generated: ${aiPrompt.slice(0, 20)}...` } },
        { id: "ai-2", type: "features", content: DEFAULT_SECTIONS.features },
        { id: "ai-3", type: "cta", content: DEFAULT_SECTIONS.cta }
      ];
      setSections(generated);
      setIsGenerating(false);
      setMode("editor");
      toast.success("AI Page Generated!");
    }, 2500);
  };

  const selectedSection = sections.find(s => s.id === selectedSectionId);

  return (
    <div className="space-y-8 pb-20">
      <AnimatePresence mode="wait">
        {/* GALLERY MODE */}
        {mode === "gallery" && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-primary via-slate-900 to-primary/40 p-12 text-white shadow-2xl border border-white/5">
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                <Layout className="w-96 h-96 rotate-12" />
              </div>
              <div className="relative z-10 max-w-2xl space-y-6">
                <div className="flex items-center gap-3">
                  <Badge className="bg-white/10 hover:bg-white/20 text-white border-white/10 py-1.5 px-4 rounded-full backdrop-blur-md">
                    <Sparkles className="w-3.5 h-3.5 mr-2 fill-white animate-pulse" />
                    v2.0 Logic Engine
                  </Badge>
                  <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Canvas Ready</span>
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none italic">
                  Launch <span className="text-white opacity-40">Dynamic</span> Funnels
                </h1>
                <p className="text-xl text-slate-300 font-medium leading-relaxed">
                  The industry's first real-time AI landing page architect. Build, customize, and deploy optimized conversion machines in seconds.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <Button 
                    size="lg" 
                    className="rounded-[24px] h-16 px-10 font-black text-xl bg-white text-primary hover:bg-slate-100 transition-all shadow-2xl shadow-white/5"
                    onClick={() => setMode("ai")}
                  >
                    <Wand2 className="w-5 h-5 mr-3" />
                    AI Page Creator
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="rounded-[24px] h-16 px-10 font-black text-xl border-white/10 text-white hover:bg-white/10 backdrop-blur-md"
                    onClick={() => { setSections([]); setMode("editor"); }}
                  >
                    <Plus className="w-5 h-5 mr-3" />
                    Blank Canvas
                  </Button>
                </div>
              </div>
            </div>

            {/* Existing Pages / Templates */}
            <div className="grid gap-8">
               <div className="flex items-center justify-between px-2">
                 <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Project <span className="text-primary italic">Drafts</span></h2>
                    <p className="text-sm text-slate-400 font-medium">Manage and edit your active landing pages</p>
                 </div>
                 <Button variant="ghost" className="text-primary font-black uppercase tracking-widest text-[10px]">View All Assets</Button>
               </div>

               <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {sections.length > 0 && mode === "gallery" && (
                    <Card 
                      className="rounded-[32px] overflow-hidden border-primary/20 bg-primary/5 cursor-pointer group hover:shadow-2xl transition-all"
                      onClick={() => setMode("editor")}
                    >
                       <div className="p-6 h-full flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                             <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg"><Plus className="w-5 h-5" /></div>
                             <Badge className="bg-primary/20 text-primary border-0">ACTIVE DRAFT</Badge>
                          </div>
                          <div>
                             <h4 className="font-black text-slate-800">{pageTitle}</h4>
                             <p className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-widest">{sections.length} Sections Active</p>
                          </div>
                       </div>
                    </Card>
                  )}
                  {/* Mock Templates */}
                  <TemplateCard title="Modern SaaS" category="Software" img="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format" onClick={() => { setSections([{ id: "1", type: "hero", content: DEFAULT_SECTIONS.hero }]); setMode("editor"); }} />
                  <TemplateCard title="Agency Hub" category="Services" img="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format" onClick={() => { setSections([{ id: "1", type: "hero", content: DEFAULT_SECTIONS.hero }]); setMode("editor"); }} />
               </div>
            </div>
          </motion.div>
        )}

        {/* EDITOR MODE */}
        {mode === "editor" && (
          <motion.div
            key="editor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-[calc(100vh-120px)] bg-slate-100 rounded-[40px] overflow-hidden border border-slate-200 shadow-2xl"
          >
            {/* Top Bar Navigation */}
            <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100">
               <div className="flex items-center gap-6">
                 <Button variant="ghost" size="icon" onClick={() => setMode("gallery")} className="rounded-2xl h-10 w-10 hover:bg-slate-50">
                    <ChevronLeft className="w-6 h-6 text-slate-400" />
                 </Button>
                 <div className="space-y-0.5">
                   <div className="flex items-center gap-3">
                     <Input 
                        value={pageTitle} 
                        onChange={(e) => setPageTitle(e.target.value)}
                        className="h-7 w-auto min-w-[150px] p-0 border-0 font-black text-slate-800 text-lg focus:ring-0 focus-visible:ring-0"
                     />
                     <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[9px] font-black uppercase transition-all">LIVE LOGIC</Badge>
                   </div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Build Mode • Web Engine v2.0</p>
                 </div>
               </div>

               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner">
                    <Button 
                      variant={viewDevice === "desktop" ? "secondary" : "ghost"} 
                      size="icon" 
                      onClick={() => setViewDevice("desktop")}
                      className="rounded-xl h-10 w-10 transition-all"
                    >
                      <Monitor className="w-5 h-5" />
                    </Button>
                    <Button 
                      variant={viewDevice === "mobile" ? "secondary" : "ghost"} 
                      size="icon" 
                      onClick={() => setViewDevice("mobile")}
                      className="rounded-xl h-10 w-10 transition-all"
                    >
                      <Smartphone className="w-5 h-5" />
                    </Button>
                  </div>

                  <div className="h-8 w-[1px] bg-slate-100 mx-2" />

                  <Button variant="outline" className="rounded-2xl font-black h-12 px-6 border-slate-200 hover:bg-slate-50 text-slate-600 transition-all">
                    <Eye className="w-4 h-4 mr-2" /> Preview
                  </Button>
                  <Button 
                    className="rounded-2xl font-black h-12 px-8 shadow-2xl shadow-primary/20 group overflow-hidden relative transition-all"
                    style={{ backgroundColor: primaryColor }}
                    disabled={isPublishing}
                    onClick={handlePublish}
                  >
                    {isPublishing ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <>
                        <Globe className="w-4 h-4 mr-2" /> Publish
                      </>
                    )}
                  </Button>
               </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
               {/* Elements Palette */}
               <div className="w-72 bg-white border-r border-slate-100 flex flex-col shadow-inner">
                  <div className="p-6 border-b border-slate-50">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Structure</h4>
                    <div className="grid grid-cols-2 gap-3">
                       {BLOCKS.map(block => (
                         <button
                            key={block.id}
                            onClick={() => addSection(block.id)}
                            className="flex flex-col items-center justify-center p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:border-primary/50 hover:bg-primary/5 transition-all group active:scale-95"
                         >
                           <div className="h-8 w-8 rounded-xl bg-white text-slate-400 group-hover:text-primary group-hover:scale-110 transition-all flex items-center justify-center shadow-sm mb-2">{block.icon}</div>
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest group-hover:text-primary transition-colors">{block.name.split(' ')[0]}</span>
                         </button>
                       ))}
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Active Layers</h4>
                       {sections.length === 0 ? (
                         <div className="text-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-100">
                           <Layers className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                           <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">No sections active</p>
                         </div>
                       ) : (
                         <div className="space-y-2">
                           {sections.map((s, idx) => (
                             <motion.div 
                                layout
                                key={s.id}
                                onClick={() => setSelectedSectionId(s.id)}
                                className={cn(
                                  "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer group",
                                  selectedSectionId === s.id ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-white text-slate-600 border-slate-100 hover:border-primary/20"
                                )}
                             >
                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", selectedSectionId === s.id ? "bg-white/20" : "bg-slate-50")}>
                                   {BLOCKS.find(b => b.id === s.type)?.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[10px] font-black uppercase tracking-wider truncate">{s.type}</p>
                                   <p className={cn("text-[9px] font-medium opacity-60 truncate", selectedSectionId === s.id ? "text-white" : "text-slate-400")}>{s.content.title}</p>
                                </div>
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={(e) => { e.stopPropagation(); moveSection(idx, 'up'); }} className="hover:text-white"><ChevronUp className="w-3 h-3" /></button>
                                   <button onClick={(e) => { e.stopPropagation(); removeSection(s.id, e); }} className="hover:text-red-400 text-destructive"><Trash2 className="w-3 h-3" /></button>
                                </div>
                             </motion.div>
                           ))}
                         </div>
                       )}
                    </div>
                  </ScrollArea>
               </div>

               {/* Live Canvas Area */}
               <div className="flex-1 bg-slate-100 p-12 flex justify-center overflow-y-auto custom-scrollbar relative">
                  <AnimatePresence>
                  <div 
                    key={viewDevice}
                    className={cn(
                      "bg-white shadow-[0_40px_100px_rgba(0,0,0,0.1)] transition-all duration-700 rounded-[30px] min-h-full h-fit flex flex-col overflow-hidden relative",
                      viewDevice === "desktop" ? "w-full max-w-5xl" : "w-[375px]"
                    )}
                  >
                    {sections.length === 0 ? (
                       <div className="flex-1 flex flex-col items-center justify-center p-20 text-center opacity-40">
                          <div className="h-24 w-24 rounded-[40px] bg-slate-50 flex items-center justify-center text-slate-200 mb-8 border border-slate-100"><Layout className="w-10 h-10" /></div>
                          <h4 className="text-2xl font-black text-slate-800">Your Canvas is Empty</h4>
                          <p className="text-slate-400 font-medium mb-8 max-w-[280px]">Drag or click components on the left to start architecting your landing page.</p>
                          <Button 
                             onClick={() => setMode("ai")}
                             className="rounded-2xl h-12 bg-slate-900 font-black text-sm px-6 text-white shadow-xl hover:-translate-y-1 transition-all"
                          >
                             <Sparkles className="w-4 h-4 mr-2" /> Start with AI Architect
                          </Button>
                       </div>
                    ) : (
                      <div className="flex-1">
                        {sections.map((section) => (
                          <div 
                            key={section.id} 
                            onClick={() => setSelectedSectionId(section.id)}
                            className={cn(
                              "relative transition-all group/canvas",
                              selectedSectionId === section.id ? "ring-2 ring-primary ring-inset z-10" : "hover:ring-1 hover:ring-primary/30"
                            )}
                          >
                            {/* Toolbar overlay for each section */}
                            {selectedSectionId === section.id && (
                              <div className="absolute top-4 right-4 z-20 flex gap-1 p-1 bg-white shadow-2xl rounded-xl border border-slate-100">
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-red-500 hover:bg-red-50" onClick={(e) => removeSection(section.id, e)}><Trash2 className="h-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setSelectedSectionId(null)}><CheckCircle2 className="h-3 h-3 text-emerald-500" /></Button>
                              </div>
                            )}
                            <SectionRenderer section={section} viewDevice={viewDevice} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </AnimatePresence>
               </div>

               {/* Design Inspector */}
               <div className="w-80 bg-white border-l border-slate-100 flex flex-col shadow-2xl">
                  <Tabs defaultValue="content" className="h-full flex flex-col">
                     <TabsList className="bg-slate-50 p-1.5 rounded-none h-14 border-b border-slate-100">
                        <TabsTrigger value="content" className="flex-1 rounded-[14px] font-black text-[10px] tracking-widest uppercase data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">Content</TabsTrigger>
                        <TabsTrigger value="design" className="flex-1 rounded-[14px] font-black text-[10px] tracking-widest uppercase data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">Styles</TabsTrigger>
                     </TabsList>

                     <ScrollArea className="flex-1">
                       <TabsContent value="content" className="m-0 p-6 space-y-8">
                         {selectedSection ? (
                           <div className="space-y-6">
                              <div className="flex items-center gap-3 p-4 rounded-3xl bg-primary/5 border border-primary/10">
                                 <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-white">{BLOCKS.find(b => b.id === selectedSection.type)?.icon}</div>
                                 <div>
                                   <p className="text-[10px] font-black uppercase tracking-widest text-primary">Editing Section</p>
                                   <h4 className="font-bold text-slate-800 uppercase text-xs">{selectedSection.type} High-Impact</h4>
                                 </div>
                              </div>

                              <div className="space-y-4 pt-4 border-t border-slate-50">
                                 {selectedSection.content.title !== undefined && (
                                   <div className="space-y-2">
                                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Main Heading</Label>
                                     <Textarea 
                                        value={selectedSection.content.title}
                                        onChange={(e) => updateSectionContent(selectedSection.id, 'title', e.target.value)}
                                        className="rounded-2xl border-slate-100 bg-slate-50/50 min-h-[80px] font-bold text-sm"
                                     />
                                   </div>
                                 )}

                                 {selectedSection.content.subtitle !== undefined && (
                                   <div className="space-y-2">
                                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sub-heading</Label>
                                     <Input 
                                        value={selectedSection.content.subtitle}
                                        onChange={(e) => updateSectionContent(selectedSection.id, 'subtitle', e.target.value)}
                                        className="rounded-2xl border-slate-100 bg-slate-50/50 h-10 font-medium text-xs"
                                     />
                                   </div>
                                 )}

                                 {selectedSection.content.buttonText !== undefined && (
                                   <div className="space-y-2">
                                     <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primary Button</Label>
                                     <div className="relative">
                                       <Input 
                                          value={selectedSection.content.buttonText}
                                          onChange={(e) => updateSectionContent(selectedSection.id, 'buttonText', e.target.value)}
                                          className="rounded-2xl border-slate-100 bg-slate-50/50 h-12 font-black text-xs pl-4 pr-10"
                                       />
                                       <MousePointer2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                     </div>
                                   </div>
                                 )}

                                 {selectedSection.content.items && (
                                   <div className="space-y-4">
                                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Feature List Items</Label>
                                      {selectedSection.content.items.map((item, i) => (
                                        <div key={i} className="p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-3">
                                           <Input 
                                              value={item.title} 
                                              onChange={(e) => updateFeatureItem(selectedSection.id, i, 'title', e.target.value)}
                                              className="h-8 rounded-xl font-bold text-xs"
                                           />
                                           <Textarea 
                                              value={item.desc} 
                                              onChange={(e) => updateFeatureItem(selectedSection.id, i, 'desc', e.target.value)}
                                              className="min-h-[60px] rounded-xl text-[11px] leading-relaxed"
                                           />
                                        </div>
                                      ))}
                                   </div>
                                 )}
                              </div>
                           </div>
                         ) : (
                           <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 opacity-30">
                              <div className="h-16 w-16 rounded-[24px] bg-slate-50 border border-slate-100 flex items-center justify-center"><Settings2 className="w-8 h-8 text-slate-200" /></div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 max-w-[150px]">Select a canvas section to inspect logic</p>
                           </div>
                         )}
                       </TabsContent>

                       <TabsContent value="design" className="m-0 p-6 space-y-6">
                          <div className="space-y-4">
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Brand Context</Label>
                                <div className="flex gap-2">
                                   <div className="h-10 w-10 rounded-2xl border-2 border-white shadow-lg shrink-0" style={{ backgroundColor: primaryColor }} />
                                   <Input value={primaryColor} className="rounded-xl h-10 font-mono text-xs" readOnly />
                                </div>
                             </div>

                             <div className="p-5 rounded-[32px] bg-slate-900 text-white relative overflow-hidden group border border-white/5 shadow-2xl mt-8">
                                <div className="absolute -bottom-6 -right-6 opacity-10 group-hover:scale-110 transition-transform duration-700"><Sparkles className="w-24 h-24" /></div>
                                <h4 className="text-sm font-black mb-1 italic">Vibe <span className="text-primary italic">Check</span></h4>
                                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-4">Current aesthetic targets 85% conversion score for Indian market dynamics.</p>
                                <Button className="w-full h-10 rounded-xl bg-white text-slate-900 font-black text-[10px] uppercase tracking-widest">Optimize Styles</Button>
                             </div>
                          </div>
                       </TabsContent>
                     </ScrollArea>
                  </Tabs>
               </div>
            </div>
          </motion.div>
        )}

        {/* AI GENERATOR MODE */}
        {mode === "ai" && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-2xl"
          >
            <div className="w-full max-w-3xl bg-white rounded-[60px] shadow-[0_50px_200px_rgba(0,0,0,0.3)] overflow-hidden border border-white relative">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-indigo-400 to-emerald-400" />
              
              <div className="p-16 space-y-10">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setMode("gallery")} 
                  className="absolute top-10 right-10 rounded-full h-12 w-12 hover:bg-slate-50"
                >
                  <X className="w-6 h-6 text-slate-300" />
                </Button>

                <div className="text-center space-y-4">
                  <div className="inline-flex h-24 w-24 items-center justify-center rounded-[32px] bg-primary/10 text-primary mb-4 shadow-xl shadow-primary/5">
                    <Wand2 className="w-12 h-12" />
                  </div>
                  <h2 className="text-4xl font-black text-slate-800 tracking-tight">AI Page <span className="text-primary italic">Architect</span></h2>
                  <p className="text-slate-400 font-medium text-lg max-w-lg mx-auto leading-relaxed">Describe your conversion goal. Our engine will generate the logical structure, layout, and high-conversion copy instantly.</p>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-2">Page Goal & Context</Label>
                  <Textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g., A luxury car rental landing page for Mumbai tourists. High-end, trust-driven, and includes a quick booking form."
                    className="min-h-[160px] rounded-[40px] border-slate-100 bg-slate-50/50 p-10 text-xl focus:ring-primary/20 transition-all font-medium text-slate-700 leading-relaxed shadow-inner"
                  />
                </div>

                <div className="pt-6">
                  <Button 
                    disabled={!aiPrompt || isGenerating}
                    onClick={handleAiGenerate}
                    className="w-full h-20 rounded-[30px] font-black text-2xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 overflow-hidden group"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {isGenerating ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}><Sparkles className="w-8 h-8" /></motion.div>
                        <span>Architecting Layout...</span>
                      </>
                    ) : (
                      <>
                        <span>Generate High-Conv Engine</span>
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {isGenerating && (
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.5 }}
                  className="h-2 bg-primary absolute bottom-0 left-0"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Dynamic Section Renderer ---
function SectionRenderer({ section, viewDevice }: { section: PageSection; viewDevice: 'desktop' | 'mobile' }) {
  const { primaryColor } = useClient();
  
  const BaseWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.section 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative py-12 md:py-24 px-8 overflow-hidden",
        section.type === 'cta' ? "bg-slate-900 text-white" : "bg-white text-slate-800"
      )}
    >
      {children}
    </motion.section>
  );

  switch (section.type) {
    case "hero":
      return (
        <BaseWrapper>
          <div className={cn("max-w-4xl mx-auto flex flex-col gap-10 items-center text-center", viewDevice === 'mobile' && "gap-6")}>
             <div className="space-y-6">
                <h1 className={cn("font-black tracking-tight leading-[1.1] text-5xl md:text-7xl", viewDevice === 'mobile' && "text-4xl")}>
                  {section.content.title}
                </h1>
                <p className="text-slate-500 text-lg md:text-xl font-medium max-w-2xl mx-auto">
                  {section.content.subtitle}
                </p>
             </div>
             <div className="flex flex-wrap justify-center gap-4">
                <Button size="lg" className="rounded-2xl h-16 px-10 font-black text-lg shadow-xl shadow-primary/20" style={{ backgroundColor: primaryColor }}>
                  {section.content.buttonText}
                </Button>
             </div>
             {section.content.image && (
               <div className="rounded-[40px] overflow-hidden border-8 border-slate-50 shadow-2xl relative group">
                  <img src={section.content.image} className="w-full max-h-[500px] object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
               </div>
             )}
          </div>
        </BaseWrapper>
      );

    case "features":
      return (
        <BaseWrapper>
          <div className="max-w-5xl mx-auto space-y-16">
             <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight">{section.content.title}</h2>
             </div>
             <div className={cn("grid gap-8", viewDevice === 'desktop' ? "grid-cols-3" : "grid-cols-1")}>
                {section.content.items?.map((item, i) => (
                  <div key={i} className="p-8 rounded-[40px] bg-slate-50 border border-slate-100 hover:-translate-y-2 transition-transform group">
                     <div className="h-14 w-14 rounded-[20px] bg-white text-primary flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-6 h-6" />
                     </div>
                     <h4 className="text-xl font-bold text-slate-800 mb-3">{item.title}</h4>
                     <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
                  </div>
                ))}
             </div>
          </div>
        </BaseWrapper>
      );

    case "testimonials":
      return (
        <BaseWrapper>
          <div className="max-w-5xl mx-auto space-y-12">
             <h2 className="text-center text-2xl font-black text-slate-800 uppercase tracking-widest">{section.content.title}</h2>
             <div className={cn("grid gap-6", viewDevice === 'desktop' ? "grid-cols-2" : "grid-cols-1")}>
                {section.content.items?.map((item, i) => (
                  <div key={i} className="p-10 rounded-[40px] bg-white border border-slate-100 shadow-xl shadow-slate-200/50 flex gap-6">
                     <div className="h-12 w-12 rounded-full bg-slate-100 shrink-0" />
                     <div>
                       <p className="text-slate-600 font-medium italic mb-4 leading-relaxed">"{item.desc}"</p>
                       <h5 className="font-bold text-slate-800">{item.title}</h5>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verified Customer</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </BaseWrapper>
      );

    case "cta":
      return (
        <BaseWrapper>
          <div className="max-w-4xl mx-auto rounded-[50px] bg-gradient-to-br from-primary to-indigo-600 p-12 md:p-20 text-center space-y-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-10"><MousePointer2 className="w-48 h-48 rotate-12" /></div>
             <div className="relative z-10 space-y-4">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-none">{section.content.title}</h2>
                <p className="text-white/70 text-lg md:text-xl font-medium max-w-xl mx-auto">{section.content.description}</p>
             </div>
             <Button size="lg" className="rounded-2xl h-16 px-12 font-black text-xl bg-white text-primary hover:bg-slate-100 relative z-10 transition-all shadow-2xl">
                {section.content.buttonText}
             </Button>
          </div>
        </BaseWrapper>
      );

    default:
      return null;
  }
}

// --- Visual Sub-Components ---
function TemplateCard({ title, category, img, onClick }: { title: string; category: string; img: string; onClick: () => void }) {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="group cursor-pointer"
      onClick={onClick}
    >
      <Card className="overflow-hidden rounded-[40px] border-slate-100 bg-white shadow-xl group-hover:shadow-2xl transition-all duration-500">
        <div className="relative aspect-[1.2/1] overflow-hidden">
          <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <Button className="rounded-2xl font-black bg-white text-primary shadow-xl">Use Template</Button>
          </div>
        </div>
        <CardContent className="p-6">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">{category}</p>
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </CardContent>
      </Card>
    </motion.div>
  );
}
