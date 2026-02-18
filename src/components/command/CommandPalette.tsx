import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  Phone, Users, Settings, LogOut, Home, BarChart,
  MessageSquare, Search, Mail, Megaphone,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => run(() => navigate("/client"))}>
            <Home className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/client/voice-telecaller"))}>
            <Phone className="mr-2 h-4 w-4" /> Voice Telecaller
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/client/leads"))}>
            <Users className="mr-2 h-4 w-4" /> Leads
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/client/analytics"))}>
            <BarChart className="mr-2 h-4 w-4" /> Analytics
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/client/whatsapp"))}>
            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => navigate("/client/voice-telecaller"))}>
            <Megaphone className="mr-2 h-4 w-4" /> Create Campaign
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/client/leads"))}>
            <Search className="mr-2 h-4 w-4" /> Search Leads
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => run(() => navigate("/client/settings"))}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/login"))}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
