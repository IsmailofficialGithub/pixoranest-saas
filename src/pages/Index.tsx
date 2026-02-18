import { Link } from "react-router-dom";
import { useAuth, getRedirectPath } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  ArrowRight, 
  Phone, 
  UserCheck, 
  MessageSquare, 
  Share2, 
  Bot, 
  ShieldCheck, 
  Zap, 
  BarChart3 
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

const Index = () => {
  const { session, profile, loading } = useAuth();

  const features = [
    {
      title: "AI Voice Telecaller",
      description: "Automate outbound calls with natural-sounding AI and reach thousands of leads instantly.",
      icon: <Phone className="h-10 w-10 text-primary" />,
    },
    {
      title: "AI Voice Receptionist",
      description: "Handle inbound calls 24/7. Route calls, take messages, and assist customers without human delay.",
      icon: <UserCheck className="h-10 w-10 text-primary" />,
    },
    {
      title: "WhatsApp Automation",
      description: "Scale your customer outreach on WhatsApp with automated messaging and smart campaigns.",
      icon: <MessageSquare className="h-10 w-10 text-primary" />,
    },
    {
      title: "Social Media Automation",
      description: "Manage and automate your social presence across platforms with AI-driven content scheduling.",
      icon: <Share2 className="h-10 w-10 text-primary" />,
    },
    {
      title: "AI Voice Agent",
      description: "Deploy custom AI agents for specialized voice tasks and deep customer interactions.",
      icon: <Bot className="h-10 w-10 text-primary" />,
    },
    {
      title: "Advanced Analytics",
      description: "Track performance, call sentiment, and conversion rates with our powerful analytics engine.",
      icon: <BarChart3 className="h-10 w-10 text-primary" />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <img src="/logo.png" alt="Pixoranest Logo" className="h-10 w-auto" />
          </Link>
          <nav className="flex items-center gap-4">
            {loading ? (
              <Button variant="ghost" disabled size="sm" className="w-24">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </Button>
            ) : session ? (
              <Link to={getRedirectPath(profile?.role || "client")}>
                <Button size="sm" className="gap-2">
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Login</Button>
                </Link>
                <Link to="/login">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32">
          {/* Background Decorative Blurs */}
          <div className="absolute top-0 -z-10 h-full w-full">
            <div className="absolute top-1/4 left-1/4 h-[400px] w-[400px] rounded-full bg-primary/20 blur-[120px]" />
            <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[120px]" />
          </div>

          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm font-medium mb-8">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
              </span>
              Next-Gen AI Automation Platform
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight md:text-7xl lg:text-8xl">
              Scale Your Communications <span className="bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">with AI</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-xl text-muted-foreground md:text-2xl">
              The all-in-one multi-tenant SaaS for white-labeled AI Voice, WhatsApp, and Social Media automation.
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {loading ? (
                <Button size="lg" disabled className="h-12 w-48">Loading...</Button>
              ) : session ? (
                <Link to={getRedirectPath(profile?.role || "client")}>
                  <Button size="lg" className="h-12 px-8 gap-2 text-lg">
                    Access Dashboard <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button size="lg" className="h-12 px-8 gap-2 text-lg">
                      Start Growing Today <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                  <Button variant="outline" size="lg" className="h-12 px-8 text-lg">
                    Book a Demo
                  </Button>
                </>
              )}
            </div>
            <div className="mt-16 flex items-center justify-center gap-8 grayscale opacity-50">
              <div className="font-bold text-2xl">Exotel</div>
              <div className="font-bold text-2xl">Meta</div>
              <div className="font-bold text-2xl">Twilio</div>
              <div className="font-bold text-2xl">Retell AI</div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight md:text-5xl">Engineered for Success</h2>
              <p className="mt-4 text-lg text-muted-foreground">Comprehensive AI services managed under one roof.</p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card key={index} className="border-none bg-background shadow-lg transition-transform hover:-translate-y-1">
                  <CardHeader>
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Why Us Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center justify-between gap-12 lg:flex-row">
              <div className="max-w-2xl text-left">
                <h2 className="text-3xl font-bold tracking-tight md:text-5xl mb-6">Built for Scale & White-Labeling</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                      <ShieldCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">Multi-Tenant Isolation</h4>
                      <p className="text-muted-foreground">Secure Row-Level Security ensures your client data is perfectly isolated and private.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                      <Zap className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">Real-time Performance</h4>
                      <p className="text-muted-foreground">Monitor your AI's performance in real-time with zero latency dashboards.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative h-[400px] w-full max-w-[500px] rounded-2xl bg-gradient-to-br from-primary to-blue-600 p-8 text-white shadow-2xl flex flex-col justify-end">
                <div className="absolute top-8 right-8 h-24 w-24 bg-white/20 blur-3xl rounded-full" />
                <h3 className="text-4xl font-bold mb-4 italic">"The most robust communication AI we've ever used."</h3>
                <p className="text-lg font-medium opacity-90">— TechFlow Solutions</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Pixoranest Logo" className="h-8 w-auto grayscale brightness-0 invert opacity-60" />
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Pixoranest Corp. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="#" className="text-sm text-muted-foreground hover:text-primary">Privacy</Link>
              <Link to="#" className="text-sm text-muted-foreground hover:text-primary">Terms</Link>
              <Link to="#" className="text-sm text-muted-foreground hover:text-primary">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
