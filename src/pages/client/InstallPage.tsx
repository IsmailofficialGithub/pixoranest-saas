import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, Check, Share, MoreVertical } from "lucide-react";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferredPrompt(null);
  };

  if (installed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="p-4 rounded-full bg-green-500/10 mb-4">
          <Check className="h-12 w-12 text-green-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">App Installed!</h1>
        <p className="text-muted-foreground">You can now access Client Portal from your home screen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="text-center">
        <div className="p-4 rounded-full bg-primary/10 inline-flex mb-4">
          <Smartphone className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Install Client Portal</h1>
        <p className="text-muted-foreground mt-2">Add to your home screen for quick access, offline support, and an app-like experience.</p>
      </div>

      {/* Install button (Android / Desktop) */}
      {deferredPrompt && (
        <Button onClick={handleInstall} size="lg" className="w-full h-14 text-base">
          <Download className="mr-2 h-5 w-5" /> Install App
        </Button>
      )}

      {/* iOS instructions */}
      {isIOS && !deferredPrompt && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Install on iPhone / iPad</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">1</div>
                <div>
                  <p className="text-sm text-foreground">Tap the <Share className="inline h-4 w-4" /> Share button in Safari</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">2</div>
                <p className="text-sm text-foreground">Scroll down and tap "Add to Home Screen"</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">3</div>
                <p className="text-sm text-foreground">Tap "Add" to confirm</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Android instructions fallback */}
      {!isIOS && !deferredPrompt && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground">Install on Android</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">1</div>
                <p className="text-sm text-foreground">Tap the <MoreVertical className="inline h-4 w-4" /> menu button in Chrome</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">2</div>
                <p className="text-sm text-foreground">Tap "Add to Home Screen"</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">3</div>
                <p className="text-sm text-foreground">Tap "Add" to confirm</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { title: "Offline Access", desc: "Use even without internet" },
          { title: "Fast Loading", desc: "Instant app experience" },
          { title: "Push Notifications", desc: "Stay updated in real-time" },
          { title: "Home Screen Icon", desc: "One tap to open" },
        ].map((f) => (
          <Card key={f.title}>
            <CardContent className="p-4 text-center">
              <p className="font-medium text-sm text-foreground">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
