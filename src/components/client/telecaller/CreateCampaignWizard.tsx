import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, ArrowRight, Upload, FileText, CheckCircle2, XCircle,
  ChevronDown, Plus, Trash2, X, Rocket, Save, Eye, Pencil,
  Phone, Users, Settings, AlertTriangle, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

const STORAGE_KEY = "telecaller-campaign-draft";
const GOALS = ["Lead Generation", "Sales", "Survey", "Follow-up", "Appointment Booking", "Other"];
const HOURS = Array.from({ length: 25 }, (_, i) => {
  const h = Math.floor(i / 1);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { value: `${h}:00`, label: `${h12}:00 ${ampm}` };
}).slice(0, 24);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const VOICES = [
  { value: "male_professional", label: "Male Voice 1 (Professional)" },
  { value: "male_friendly", label: "Male Voice 2 (Friendly)" },
  { value: "female_professional", label: "Female Voice 1 (Professional)" },
  { value: "female_friendly", label: "Female Voice 2 (Friendly)" },
];
const LANGUAGES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "en-IN", label: "English (India)" },
  { value: "hi-IN", label: "Hindi" },
];

const VARIABLE_CHIPS = [
  { key: "{name}", label: "Name" },
  { key: "{company}", label: "Company" },
  { key: "{email}", label: "Email" },
  { key: "{phone}", label: "Phone" },
];

interface Contact {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  [key: string]: string | undefined;
}

interface WizardData {
  campaignName: string;
  goal: string;
  scheduleType: "immediate" | "later";
  scheduledAt: string;
  fromHour: string;
  toHour: string;
  activeDays: string[];
  maxCallsPerDay: string;
  retryEnabled: boolean;
  maxRetries: number;
  retryAfter: number;
  retryUnit: "hours" | "days";
  contacts: Contact[];
  csvFileName: string;
  contactTab: "csv" | "manual";
  manualPhone: string;
  manualName: string;
  manualEmail: string;
  manualCompany: string;
  // Step 3
  script: string;
  voice: string;
  language: string;
  speakingSpeed: number;
  leadQualification: boolean;
  qualifyingQuestions: string[];
  callRecording: boolean;
  voicemailDetection: boolean;
  voicemailAction: "skip" | "leave_message";
  voicemailScript: string;
}

const defaultData: WizardData = {
  campaignName: "",
  goal: "",
  scheduleType: "immediate",
  scheduledAt: "",
  fromHour: "9:00",
  toHour: "18:00",
  activeDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  maxCallsPerDay: "",
  retryEnabled: false,
  maxRetries: 2,
  retryAfter: 1,
  retryUnit: "hours",
  contacts: [],
  csvFileName: "",
  contactTab: "csv",
  manualPhone: "",
  manualName: "",
  manualEmail: "",
  manualCompany: "",
  script: "",
  voice: "female_professional",
  language: "en-US",
  speakingSpeed: 1.0,
  leadQualification: false,
  qualifyingQuestions: [],
  callRecording: true,
  voicemailDetection: false,
  voicemailAction: "skip",
  voicemailScript: "",
};

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned);
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  primaryColor: string;
  usageLimit: number;
  usageConsumed: number;
  clientId: string;
  userId: string;
}

export default function CreateCampaignWizard({
  open, onOpenChange, primaryColor, usageLimit, usageConsumed, clientId, userId,
}: Props) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultData, ...JSON.parse(saved) } : defaultData;
    } catch { return defaultData; }
  });
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [confirmCalls, setConfirmCalls] = useState(false);
  const [confirmCosts, setConfirmCosts] = useState(false);

  // Auto-save
  useEffect(() => {
    if (open) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, open]);

  const update = useCallback(<K extends keyof WizardData>(key: K, val: WizardData[K]) => {
    setData(prev => ({ ...prev, [key]: val }));
  }, []);

  const validContacts = data.contacts.filter(c => isValidPhone(c.phone));
  const invalidContacts = data.contacts.filter(c => !isValidPhone(c.phone));
  const remaining = usageLimit - usageConsumed;
  const exceedsLimit = validContacts.length > remaining;

  const step1Valid = data.campaignName.trim().length >= 3 &&
    (data.scheduleType === "immediate" || data.scheduledAt);
  const step2Valid = validContacts.length > 0 && !exceedsLimit;
  const step3Valid = data.script.trim().length >= 50 && data.script.trim().length <= 2000;
  const step4Valid = confirmCalls && confirmCosts && !exceedsLimit;

  function handleCsvFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setCsvErrors(["File exceeds 10MB limit"]);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      setCsvErrors(["Please upload a CSV or Excel file"]);
      return;
    }
    setCsvErrors([]);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const errors: string[] = [];
        if (results.errors.length > 0) {
          errors.push(...results.errors.slice(0, 3).map(e => e.message));
        }
        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          setCsvErrors(["CSV file is empty"]);
          return;
        }
        const headers = Object.keys(rows[0] || {});
        const phoneCol = headers.find(h =>
          /^(phone|mobile|phone_number|phone number|contact|tel)$/i.test(h.trim())
        );
        const nameCol = headers.find(h => /^(name|full_name|full name|contact_name)$/i.test(h.trim()));
        const emailCol = headers.find(h => /^(email|email_address)$/i.test(h.trim()));
        const companyCol = headers.find(h => /^(company|company_name|organization)$/i.test(h.trim()));

        if (!phoneCol) {
          setCsvErrors(["CSV must contain a 'phone' column"]);
          return;
        }

        const contacts: Contact[] = rows.slice(0, 10000).map(row => ({
          phone: formatPhone((row[phoneCol] || "").trim()),
          name: nameCol ? row[nameCol]?.trim() : undefined,
          email: emailCol ? row[emailCol]?.trim() : undefined,
          company: companyCol ? row[companyCol]?.trim() : undefined,
        }));

        if (contacts.length === 0) {
          setCsvErrors(["No valid rows found"]);
          return;
        }

        setCsvErrors(errors);
        update("contacts", contacts);
        update("csvFileName", file.name);
      },
      error: () => setCsvErrors(["Failed to parse CSV file"]),
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCsvFile(file);
  }

  function addManualContact() {
    if (!data.manualPhone.trim()) return;
    const phone = formatPhone(data.manualPhone.trim());
    const contact: Contact = {
      phone,
      name: data.manualName || undefined,
      email: data.manualEmail || undefined,
      company: data.manualCompany || undefined,
    };
    update("contacts", [...data.contacts, contact]);
    update("manualPhone", "");
    update("manualName", "");
    update("manualEmail", "");
    update("manualCompany", "");
  }

  function removeContact(idx: number) {
    update("contacts", data.contacts.filter((_, i) => i !== idx));
  }

  function downloadSampleCsv() {
    const csv = "phone,name,email,company\n+919876543210,John Doe,john@example.com,Acme Inc\n+919876543211,Jane Smith,jane@example.com,Beta Corp";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    onOpenChange(false);
  }

  function handleNext() {
    if (step < 4) setStep(step + 1);
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  async function handleSaveAsDraft() {
    try {
      // Step 1: Create Contact List
      const { data: list, error: listErr } = await (supabase as any).from("outbound_contact_lists").insert({
        owner_user_id: userId,
        name: data.campaignName,
        description: data.script || null,
      }).select("id").single();
      
      if (listErr || !list) throw listErr || new Error("Failed to create list");

      const schedAt = data.scheduleType === "later" && data.scheduledAt
        ? new Date(data.scheduledAt).toISOString()
        : new Date().toISOString();

      const { error } = await supabase.from("voice_campaigns").insert({
        client_id: clientId,
        campaign_name: data.campaignName,
        script: data.script || null,
        campaign_type: "telecaller",
        status: "draft",
        scheduled_at: schedAt,
      });

      if (error) throw error;
      toast.success("Campaign saved as draft");
      localStorage.removeItem(STORAGE_KEY);
      setData(defaultData);
      setStep(1);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to save draft: " + (err.message || "Unknown error"));
    }
  }

  async function handleLaunch() {
    if (!step4Valid) return;
    setLaunching(true);
    setLaunchStep(1);

    try {
      // Step 1: Create Contact List
      const { data: list, error: listError } = await (supabase as any)
        .from("outbound_contact_lists")
        .insert({
          owner_user_id: userId,
          name: data.campaignName,
          description: data.script || null,
        })
        .select("id")
        .single();

      if (listError || !list) throw listError || new Error("Failed to create contact list");
      setLaunchStep(2);

      // Step 2: Insert contacts to custom contacts table
      const BATCH = 500;
      for (let i = 0; i < validContacts.length; i += BATCH) {
        const batch = validContacts.slice(i, i + BATCH).map(c => ({
          list_id: list.id,
          phone_number: c.phone,
          name: c.name || "Unknown",
          email: c.email || null,
          extra_data: { company: c.company },
        }));
        const { error: contactErr } = await (supabase as any)
          .from("outbound_contacts")
          .insert(batch);
        if (contactErr) throw contactErr;
      }
      setLaunchStep(3);

      // Step 3: Create Campaign
      const schedAt = data.scheduleType === "later" && data.scheduledAt
        ? new Date(data.scheduledAt).toISOString()
        : new Date().toISOString();

      const { data: campaign, error: campError } = await supabase
        .from("voice_campaigns")
        .insert({
          client_id: clientId,
          campaign_name: data.campaignName,
          script: data.script || null,
          campaign_type: "telecaller",
          status: data.scheduleType === "later" ? "scheduled" : "running",
          scheduled_at: schedAt,
        })
        .select("id")
        .single();

      if (campError || !campaign) throw campError || new Error("Failed to create campaign");
      setLaunchStep(4);

      const {data:agent_id,error:agentError}=await supabase.from("outboundagents").select("id").eq("owner_user_id",userId).eq("status",'active').single();
      if(agentError||!agent_id) throw agentError||new Error("Failed to get agent id");

      
      // Trigger workflow (best-effort)
      try {
        const webhookUrl = import.meta.env.VITE_N8N_OUTBOUND_LIST_IMMEDIATE_CALLS_WEBHOOK;
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              campaign_id: campaign.id,
              agent_id: agent_id.id,
              client_id: clientId,
              list_id: list.id,
              campaign_name: data.campaignName,
              goal: data.goal,
              schedule_type: data.scheduleType,
              scheduled_at: schedAt,
              from_hour: data.fromHour,
              to_hour: data.toHour,
              active_days: data.activeDays,
              max_calls_per_day: data.maxCallsPerDay,
              retry_enabled: data.retryEnabled,
              max_retries: data.maxRetries,
              retry_after: data.retryAfter,
              retry_unit: data.retryUnit,
              script: data.script,
              voice: data.voice,
              language: data.language,
              speaking_speed: data.speakingSpeed,
              lead_qualification: data.leadQualification,
              qualifying_questions: data.qualifyingQuestions,
              call_recording: data.callRecording,
              voicemail_detection: data.voicemailDetection,
              voicemail_action: data.voicemailAction,
              voicemail_script: data.voicemailScript,
            }),
          });
        } else {
          await supabase.functions.invoke("trigger-telecaller-campaign", {
            body: { campaign_id: campaign.id, client_id: clientId },
          });
        }
      } catch (err) {
        console.error("Webhook trigger failed", err);
        // Non-fatal: workflow may not be set up yet
      }

      // Clean up
      localStorage.removeItem(STORAGE_KEY);
      toast.success(`Campaign "${data.campaignName}" launched! 🚀`);
      setData(defaultData);
      setStep(1);
      setConfirmCalls(false);
      setConfirmCosts(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Launch failed: " + (err.message || "Unknown error"));
    } finally {
      setLaunching(false);
      setLaunchStep(0);
    }
  }

  const totalSteps = 4;
  const progressPct = (step / totalSteps) * 100;

  const nextLabel = step === 1 ? "Next: Upload Contacts"
    : step === 2 ? "Next: Call Script"
    : step === 3 ? "Next: Review"
    : "Launch";

  const nextDisabled = (step === 1 && !step1Valid) ||
    (step === 2 && !step2Valid) ||
    (step === 3 && !step3Valid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Progress Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <DialogHeader className="p-6 pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">Create Campaign</DialogTitle>
              <Badge variant="outline" className="text-xs">Step {step} of {totalSteps}</Badge>
            </div>
          </DialogHeader>
          <div className="px-6 pb-4">
            <Progress value={progressPct} className="h-1.5" />
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
              {["Details", "Contacts", "Script", "Review"].map((label, i) => (
                <span key={label} className={i + 1 <= step ? "font-semibold text-foreground" : ""}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 pt-2">
          {step === 1 && <Step1 data={data} update={update} primaryColor={primaryColor} />}
          {step === 2 && (
            <Step2
              data={data} update={update} primaryColor={primaryColor}
              validContacts={validContacts} invalidContacts={invalidContacts}
              csvErrors={csvErrors} setCsvErrors={setCsvErrors}
              dragOver={dragOver} setDragOver={setDragOver}
              handleDrop={handleDrop} handleCsvFile={handleCsvFile}
              fileRef={fileRef} addManualContact={addManualContact}
              removeContact={removeContact} downloadSampleCsv={downloadSampleCsv}
              remaining={remaining} exceedsLimit={exceedsLimit}
            />
          )}
          {step === 3 && <Step3 data={data} update={update} primaryColor={primaryColor} />}
          {step === 4 && (
            <Step4
              data={data} primaryColor={primaryColor}
              validContacts={validContacts}
              usageLimit={usageLimit} usageConsumed={usageConsumed}
              exceedsLimit={exceedsLimit}
              confirmCalls={confirmCalls} setConfirmCalls={setConfirmCalls}
              confirmCosts={confirmCosts} setConfirmCosts={setConfirmCosts}
              goToStep={setStep}
            />
          )}
        </div>

        {/* Launch overlay */}
        {launching && (
          <div className="absolute inset-0 z-20 bg-background/90 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
            <div className="space-y-2 text-sm text-center">
              {[
                "Saving campaign...",
                "Uploading contacts...",
                "Initializing AI caller...",
                "Starting calls...",
              ].map((msg, i) => (
                <p key={i} className={`flex items-center gap-2 ${i + 1 <= launchStep ? "text-foreground" : "text-muted-foreground"}`}>
                  {i + 1 <= launchStep ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <span className="h-4 w-4" />}
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t p-4 flex justify-between">
          {step === 1 ? (
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
          ) : (
            <Button variant="outline" onClick={handleBack} disabled={launching}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <div className="flex gap-2">
            {step === 4 && (
              <Button variant="outline" onClick={handleSaveAsDraft} disabled={launching}>
                <Save className="h-4 w-4 mr-1" /> Save as Draft
              </Button>
            )}
            {step < 4 ? (
              <Button
                onClick={handleNext}
                disabled={nextDisabled}
                style={{ backgroundColor: primaryColor, color: "white" }}
              >
                {nextLabel}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleLaunch}
                disabled={!step4Valid || launching}
                style={{ backgroundColor: primaryColor, color: "white" }}
                className="min-w-[160px]"
              >
                {launching ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Launching...</>
                ) : (
                  <><Rocket className="h-4 w-4 mr-1" /> Launch Campaign</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Step 1 ─── */

function Step1({
  data, update, primaryColor,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, val: WizardData[K]) => void;
  primaryColor: string;
}) {
  const today = new Date().toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="campaign-name">Campaign Name <span className="text-destructive">*</span></Label>
        <Input
          id="campaign-name"
          placeholder="e.g., Summer Sale Outreach"
          value={data.campaignName}
          onChange={e => update("campaignName", e.target.value)}
          maxLength={100}
        />
        {data.campaignName.length > 0 && data.campaignName.length < 3 && (
          <p className="text-[11px] text-destructive">Minimum 3 characters</p>
        )}
        <p className="text-[11px] text-muted-foreground">Choose a memorable name for this campaign</p>
      </div>

      <div className="space-y-2">
        <Label>Campaign Goal</Label>
        <Select value={data.goal} onValueChange={v => update("goal", v)}>
          <SelectTrigger><SelectValue placeholder="Select a goal (optional)" /></SelectTrigger>
          <SelectContent>
            {GOALS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Call Schedule</Label>
        <RadioGroup
          value={data.scheduleType}
          onValueChange={v => update("scheduleType", v as "immediate" | "later")}
          className="space-y-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="immediate" id="sched-now" />
            <Label htmlFor="sched-now" className="font-normal cursor-pointer">Start Immediately</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="later" id="sched-later" />
            <Label htmlFor="sched-later" className="font-normal cursor-pointer">Schedule for Later</Label>
          </div>
        </RadioGroup>
        {data.scheduleType === "later" && (
          <div className="ml-6 space-y-1">
            <Input
              type="datetime-local"
              value={data.scheduledAt}
              min={today}
              onChange={e => update("scheduledAt", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Calls will start automatically at scheduled time</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label>Only call between:</Label>
        <div className="flex items-center gap-2">
          <Select value={data.fromHour} onValueChange={v => update("fromHour", v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{HOURS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">to</span>
          <Select value={data.toHour} onValueChange={v => update("toHour", v)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{HOURS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(day => (
            <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox
                checked={data.activeDays.includes(day)}
                onCheckedChange={checked => {
                  update("activeDays", checked
                    ? [...data.activeDays, day]
                    : data.activeDays.filter(d => d !== day));
                }}
              />
              {day}
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Calls outside these hours will be skipped</p>
      </div>

      <div className="space-y-2">
        <Label>Maximum calls per day</Label>
        <Input
          type="number"
          placeholder="e.g., 100"
          value={data.maxCallsPerDay}
          onChange={e => update("maxCallsPerDay", e.target.value)}
          min={1}
        />
        <p className="text-[11px] text-muted-foreground">Leave empty for unlimited</p>
      </div>

      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium cursor-pointer hover:opacity-80">
          <ChevronDown className="h-3.5 w-3.5" />
          Retry Settings
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 ml-5 space-y-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={data.retryEnabled}
              onCheckedChange={c => update("retryEnabled", !!c)}
            />
            Retry on No Answer
          </label>
          {data.retryEnabled && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Max retries</Label>
                <Input
                  type="number"
                  className="w-20"
                  value={data.maxRetries}
                  min={1}
                  max={5}
                  onChange={e => update("maxRetries", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Retry after</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    className="w-16"
                    value={data.retryAfter}
                    min={1}
                    onChange={e => update("retryAfter", parseInt(e.target.value) || 1)}
                  />
                  <Select value={data.retryUnit} onValueChange={v => update("retryUnit", v as "hours" | "days")}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ─── Step 2 ─── */

function Step2({
  data, update, primaryColor, validContacts, invalidContacts,
  csvErrors, setCsvErrors, dragOver, setDragOver, handleDrop, handleCsvFile,
  fileRef, addManualContact, removeContact, downloadSampleCsv,
  remaining, exceedsLimit,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, val: WizardData[K]) => void;
  primaryColor: string;
  validContacts: Contact[];
  invalidContacts: Contact[];
  csvErrors: string[];
  setCsvErrors: (v: string[]) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleCsvFile: (f: File) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  addManualContact: () => void;
  removeContact: (idx: number) => void;
  downloadSampleCsv: () => void;
  remaining: number;
  exceedsLimit: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-muted rounded-lg p-1">
        {(["csv", "manual"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => update("contactTab", tab)}
            className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${
              data.contactTab === tab
                ? "bg-background shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "csv" ? "Upload CSV" : "Manual Entry"}
          </button>
        ))}
      </div>

      {data.contactTab === "csv" ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <p className="font-medium text-foreground">CSV Requirements</p>
            <p><span className="font-medium">Required:</span> phone</p>
            <p><span className="font-medium">Optional:</span> name, email, company</p>
            <button onClick={downloadSampleCsv} className="underline" style={{ color: primaryColor }}>
              Download sample CSV
            </button>
          </div>

          {!data.csvFileName ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Drag and drop your CSV file here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              <p className="text-[10px] text-muted-foreground mt-2">Accepts .csv • Max 10MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvFile(file);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{data.csvFileName}</p>
                <p className="text-[11px] text-muted-foreground">{data.contacts.length} rows parsed</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => {
                  update("contacts", []);
                  update("csvFileName", "");
                  setCsvErrors([]);
                }}
              >
                Change file
              </Button>
            </div>
          )}

          {csvErrors.length > 0 && (
            <div className="text-xs text-destructive space-y-0.5">
              {csvErrors.map((err, i) => <p key={i}>⚠️ {err}</p>)}
            </div>
          )}

          {data.contacts.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contacts.slice(0, 5).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {isValidPhone(c.phone) ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                        <TableCell className="text-xs">{c.name || "—"}</TableCell>
                        <TableCell className="text-xs">{c.email || "—"}</TableCell>
                        <TableCell className="text-xs">{c.company || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs">Phone <span className="text-destructive">*</span></Label>
              <Input
                placeholder="+91 9876543210"
                value={data.manualPhone}
                onChange={e => update("manualPhone", e.target.value)}
                onKeyDown={e => e.key === "Enter" && addManualContact()}
              />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="John Doe"
                value={data.manualName}
                onChange={e => update("manualName", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input
                placeholder="john@example.com"
                value={data.manualEmail}
                onChange={e => update("manualEmail", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Company</Label>
              <Input
                placeholder="Acme Inc"
                value={data.manualCompany}
                onChange={e => update("manualCompany", e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addManualContact}
            disabled={!data.manualPhone.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Contact
          </Button>

          {data.contacts.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {data.contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded border bg-muted/30">
                  {isValidPhone(c.phone) ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="font-mono flex-1">{c.phone}</span>
                  {c.name && <span className="text-muted-foreground">{c.name}</span>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeContact(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data.contacts.length > 0 && (
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm font-semibold">Contact Summary</p>
          <div className="grid grid-cols-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">Total contacts:</span>
            <span className="font-medium">{data.contacts.length}</span>
            <span className="text-muted-foreground">Valid:</span>
            <span className="font-medium text-green-600">{validContacts.length}</span>
            {invalidContacts.length > 0 && (
              <>
                <span className="text-muted-foreground">Invalid:</span>
                <span className="font-medium text-destructive">{invalidContacts.length}</span>
              </>
            )}
            <span className="text-muted-foreground">Remaining quota:</span>
            <span className="font-medium">{remaining}</span>
          </div>
          {exceedsLimit ? (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded p-2 mt-1">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              Exceeds your limit by {validContacts.length - remaining}. Contact admin to increase.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded p-2 mt-1">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Within your usage limit
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Step 3: Call Script ─── */

function Step3({
  data, update, primaryColor,
}: {
  data: WizardData;
  update: <K extends keyof WizardData>(key: K, val: WizardData[K]) => void;
  primaryColor: string;
}) {
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");

  const charCount = data.script.length;
  const tooShort = charCount > 0 && charCount < 50;
  const tooLong = charCount > 2000;

  function insertVariable(variable: string) {
    const el = scriptRef.current;
    if (!el) {
      update("script", data.script + variable);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newScript = data.script.slice(0, start) + variable + data.script.slice(end);
    update("script", newScript);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }

  function getPreviewScript() {
    return data.script
      .replace(/\{name\}/g, "John Doe")
      .replace(/\{company\}/g, "ABC Corp")
      .replace(/\{email\}/g, "john@example.com")
      .replace(/\{phone\}/g, "+91 98765 43210");
  }

  function addQuestion() {
    if (!newQuestion.trim()) return;
    update("qualifyingQuestions", [...data.qualifyingQuestions, newQuestion.trim()]);
    setNewQuestion("");
  }

  function removeQuestion(idx: number) {
    update("qualifyingQuestions", data.qualifyingQuestions.filter((_, i) => i !== idx));
  }

  // Script suggestions
  const suggestions: string[] = [];
  if (data.script.length > 0) {
    if (!data.script.includes("{name}")) suggestions.push("Consider adding personalization with {name}");
    if (data.script.length < 200) suggestions.push("Add a clear call-to-action for better results");
  }

  return (
    <div className="space-y-6">
      {/* Script Editor */}
      <div className="space-y-2">
        <Label>Call Script <span className="text-destructive">*</span></Label>

        {/* Variable chips */}
        <div className="flex flex-wrap gap-1.5">
          {VARIABLE_CHIPS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-primary/10 hover:bg-primary/20 transition-colors"
              style={{ borderColor: primaryColor + "40", color: primaryColor }}
            >
              {v.label} <span className="font-mono opacity-70">{v.key}</span>
            </button>
          ))}
        </div>

        <Textarea
          ref={scriptRef}
          placeholder="Write your call script here...&#10;&#10;Example:&#10;Hello {name}, this is calling from ABC Company.&#10;I'm reaching out to {company} because we have a special offer..."
          value={data.script}
          onChange={e => update("script", e.target.value)}
          className="min-h-[240px] font-mono text-sm"
          maxLength={2100}
        />
        <div className="flex justify-between text-[11px]">
          <div>
            {tooShort && <span className="text-destructive">Minimum 50 characters required</span>}
            {tooLong && <span className="text-destructive">Maximum 2000 characters exceeded</span>}
          </div>
          <span className={`${tooLong ? "text-destructive" : "text-muted-foreground"}`}>
            {charCount} / 2000
          </span>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-1">
            {suggestions.map((s, i) => (
              <p key={i} className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" /> {s}
              </p>
            ))}
          </div>
        )}

        {/* Preview */}
        {data.script.length > 0 && (
          <div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowPreview(!showPreview)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              {showPreview ? "Hide Preview" : "Preview with Sample Contact"}
            </Button>
            {showPreview && (
              <div className="mt-2 rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                {getPreviewScript()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Voice Settings */}
      <div className="space-y-4">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Settings className="h-4 w-4" /> Voice Settings
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">AI Voice</Label>
            <Select value={data.voice} onValueChange={v => update("voice", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VOICES.map(v => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Language</Label>
            <Select value={data.language} onValueChange={v => update("language", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Speaking Speed: {data.speakingSpeed}x</Label>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">Slow</span>
            <Slider
              value={[data.speakingSpeed]}
              onValueChange={v => update("speakingSpeed", v[0])}
              min={0.8}
              max={1.5}
              step={0.1}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground">Fast</span>
          </div>
        </div>
      </div>

      {/* Call Behavior */}
      <div className="space-y-4">
        <p className="text-sm font-semibold">Call Behavior</p>

        {/* Lead Qualification */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Lead Qualification</p>
            <p className="text-[11px] text-muted-foreground">AI will ask qualifying questions and score leads</p>
          </div>
          <Switch
            checked={data.leadQualification}
            onCheckedChange={v => update("leadQualification", v)}
          />
        </div>
        {data.leadQualification && (
          <div className="ml-4 space-y-2">
            <Label className="text-xs">Qualifying Questions</Label>
            {data.qualifyingQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="flex-1 p-2 rounded border bg-muted/30">{q}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeQuestion(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                placeholder="e.g., What's your budget?"
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addQuestion()}
                className="text-xs"
              />
              <Button variant="outline" size="sm" onClick={addQuestion} disabled={!newQuestion.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Call Recording */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Record Calls</p>
            <p className="text-[11px] text-muted-foreground">All calls will be recorded and transcribed</p>
          </div>
          <Switch
            checked={data.callRecording}
            onCheckedChange={v => update("callRecording", v)}
          />
        </div>

        {/* Voicemail Detection */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Detect Voicemail</p>
            <p className="text-[11px] text-muted-foreground">Skip or leave message when voicemail detected</p>
          </div>
          <Switch
            checked={data.voicemailDetection}
            onCheckedChange={v => update("voicemailDetection", v)}
          />
        </div>
        {data.voicemailDetection && (
          <div className="ml-4 space-y-3">
            <RadioGroup
              value={data.voicemailAction}
              onValueChange={v => update("voicemailAction", v as "skip" | "leave_message")}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="skip" id="vm-skip" />
                <Label htmlFor="vm-skip" className="text-xs font-normal cursor-pointer">Skip voicemail</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="leave_message" id="vm-msg" />
                <Label htmlFor="vm-msg" className="text-xs font-normal cursor-pointer">Leave a message</Label>
              </div>
            </RadioGroup>
            {data.voicemailAction === "leave_message" && (
              <Textarea
                placeholder="Voicemail message script..."
                value={data.voicemailScript}
                onChange={e => update("voicemailScript", e.target.value)}
                className="min-h-[80px] text-sm"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 4: Review & Launch ─── */

function Step4({
  data, primaryColor, validContacts,
  usageLimit, usageConsumed, exceedsLimit,
  confirmCalls, setConfirmCalls,
  confirmCosts, setConfirmCosts,
  goToStep,
}: {
  data: WizardData;
  primaryColor: string;
  validContacts: Contact[];
  usageLimit: number;
  usageConsumed: number;
  exceedsLimit: boolean;
  confirmCalls: boolean;
  setConfirmCalls: (v: boolean) => void;
  confirmCosts: boolean;
  setConfirmCosts: (v: boolean) => void;
  goToStep: (s: number) => void;
}) {
  const afterUsage = usageConsumed + validContacts.length;
  const afterPct = usageLimit > 0 ? Math.round((afterUsage / usageLimit) * 100) : 0;
  const currentPct = usageLimit > 0 ? Math.round((usageConsumed / usageLimit) * 100) : 0;

  const voiceLabel = VOICES.find(v => v.value === data.voice)?.label || data.voice;
  const langLabel = LANGUAGES.find(l => l.value === data.language)?.label || data.language;

  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold">Review your campaign before launching</p>

      {/* Campaign Details */}
      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="h-4 w-4" /> Campaign Details
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goToStep(1)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs space-y-1">
          <Row label="Name" value={data.campaignName} />
          {data.goal && <Row label="Goal" value={data.goal} />}
          <Row label="Schedule" value={data.scheduleType === "immediate" ? "Start immediately" : `Scheduled: ${data.scheduledAt}`} />
          <Row label="Calling Hours" value={`${data.fromHour} - ${data.toHour}, ${data.activeDays.join(", ")}`} />
          <Row label="Max Calls/Day" value={data.maxCallsPerDay || "Unlimited"} />
          {data.retryEnabled && (
            <Row label="Retries" value={`${data.maxRetries} retries after ${data.retryAfter} ${data.retryUnit}`} />
          )}
        </CardContent>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Contacts
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goToStep(2)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs space-y-1">
          <Row label="Total Contacts" value={String(validContacts.length)} />
          <Row label="Source" value={data.csvFileName ? `CSV: ${data.csvFileName}` : "Manual Entry"} />
        </CardContent>
      </Card>

      {/* Script */}
      <Card>
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Call Script
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goToStep(3)}>
            <Pencil className="h-3 w-3 mr-1" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs space-y-1">
          <p className="text-muted-foreground line-clamp-3 whitespace-pre-wrap">{data.script}</p>
          <Row label="Voice" value={voiceLabel} />
          <Row label="Language" value={langLabel} />
          <Row label="Speed" value={`${data.speakingSpeed}x`} />
          <Row label="Lead Qualification" value={data.leadQualification ? "Enabled" : "Disabled"} />
          <Row label="Call Recording" value={data.callRecording ? "Enabled" : "Disabled"} />
          <Row label="Voicemail Detection" value={data.voicemailDetection ? (data.voicemailAction === "skip" ? "Skip" : "Leave Message") : "Disabled"} />
        </CardContent>
      </Card>

      {/* Usage Impact */}
      <Card className={exceedsLimit ? "border-destructive" : ""}>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">Usage Impact</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="text-xs space-y-1">
            <Row label="Calls to make" value={String(validContacts.length)} />
            <Row label="Current usage" value={`${usageConsumed} / ${usageLimit}`} />
            <Row label="After campaign" value={`${afterUsage} / ${usageLimit}`} />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Current: {currentPct}%</span>
              <span>After: {afterPct}%</span>
            </div>
            <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="absolute h-full rounded-full bg-muted-foreground/30"
                style={{ width: `${Math.min(afterPct, 100)}%` }}
              />
              <div
                className="absolute h-full rounded-full"
                style={{ width: `${Math.min(currentPct, 100)}%`, backgroundColor: primaryColor }}
              />
            </div>
          </div>
          {exceedsLimit && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              This campaign will exceed your limit. Contact admin to increase.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmations */}
      <div className="space-y-3">
        <label className="flex items-start gap-2.5 text-xs cursor-pointer">
          <Checkbox
            checked={confirmCalls}
            onCheckedChange={c => setConfirmCalls(!!c)}
            className="mt-0.5"
          />
          <span>I confirm that I have permission to call these contacts</span>
        </label>
        <label className="flex items-start gap-2.5 text-xs cursor-pointer">
          <Checkbox
            checked={confirmCosts}
            onCheckedChange={c => setConfirmCosts(!!c)}
            className="mt-0.5"
          />
          <span>I understand the estimated usage and costs</span>
        </label>
        <p className="text-[10px] text-muted-foreground">
          By launching, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}

/* ─── Helper ─── */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
