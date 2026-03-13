import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getRedirectPath } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in with a profile, redirect
  if (!authLoading && session && profile) {
    navigate(getRedirectPath(profile.role), { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Fetch role to redirect
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleError || !roleData) {
          setError("No role assigned to this account. Contact your administrator.");
          setLoading(false);
          return;
        }

        const role = roleData.role as "super_admin" | "admin" | "client";
        navigate(getRedirectPath(role), { replace: true });
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent" 
        />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -left-[10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[10%] -right-[10%] h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[120px]"
        />
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, -100, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[30%] left-[20%] h-[300px] w-[300px] rounded-full bg-indigo-500/10 blur-[100px]"
        />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] opacity-20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-[400px]"
      >
        <div className="mb-8 flex flex-col items-center gap-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-600 shadow-xl shadow-primary/20"
          >
            <Sparkles className="h-8 w-8 text-white" />
          </motion.div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white">Pixoranest</h1>
            <p className="text-slate-400">Premium AI Automation</p>
          </div>
        </div>

        <Card className="border-white/10 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold text-white">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-200">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-primary/50 focus:ring-primary/20 transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-11 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Login"
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  className="text-sm text-slate-400 hover:text-primary transition-colors hover:underline underline-offset-4"
                  onClick={async () => {
                    if (!email) {
                      setError("Please enter your email address first.");
                      return;
                    }
                    setLoading(true);
                    setError("");
                    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: window.location.origin + "/login",
                    });
                    setLoading(false);
                    if (resetError) {
                      setError(resetError.message);
                    } else {
                      setError("");
                      alert("Password reset email sent! Check your inbox.");
                    }
                  }}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

