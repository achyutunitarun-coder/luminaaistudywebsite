import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Lock, AlertTriangle, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CONSENT_KEY = "lumina_consent_v1";

export const ConsentBanner = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const local = localStorage.getItem(CONSENT_KEY);
    if (local === "yes") return;
    // Check DB
    (async () => {
      const { data } = await supabase.from("data_consent").select("user_id").eq("user_id", user.id).maybeSingle();
      if (data) {
        localStorage.setItem(CONSENT_KEY, "yes");
      } else {
        setShow(true);
      }
    })();
  }, [user]);

  const accept = async (optIn: boolean) => {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("data_consent").upsert({
      user_id: user.id,
      training_data_opt_in: optIn,
    }, { onConflict: "user_id" });
    setSubmitting(false);
    if (error) { toast.error("Could not save preference"); return; }
    localStorage.setItem(CONSENT_KEY, "yes");
    setShow(false);
    toast.success(optIn ? "Thanks — you're helping improve Lumina!" : "Saved. You can change this anytime.");
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-background/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="max-w-2xl w-full max-h-[90vh] overflow-auto rounded-2xl border border-border/30 bg-background shadow-2xl"
          >
            <div className="px-6 py-5 border-b border-border/20 bg-gradient-to-r from-primary/10 to-background">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Welcome to Lumina AI</h2>
                  <p className="text-xs text-muted-foreground">Before you start, please review how we handle your data.</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4 text-sm">
              <section>
                <div className="flex items-center gap-2 mb-2 font-semibold"><Shield className="w-4 h-4 text-primary" /> What we store</div>
                <ul className="space-y-1 text-muted-foreground pl-6 list-disc">
                  <li>Your chats, generated notes, and exam papers (in your account)</li>
                  <li>Subject, grade, and learning preferences</li>
                  <li>Anonymized interactions (no name/email/PII) to improve the AI</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-2 font-semibold"><Lock className="w-4 h-4 text-primary" /> What we never do</div>
                <ul className="space-y-1 text-muted-foreground pl-6 list-disc">
                  <li>Sell or share your data with third parties</li>
                  <li>Track you across sites or devices</li>
                  <li>Use your identity in any AI training data</li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-2 font-semibold"><AlertTriangle className="w-4 h-4 text-amber-500" /> Third-party AI processing</div>
                <p className="text-muted-foreground">
                  When you chat or generate content, your prompts are sent to our AI providers (Meta, Google, NVIDIA, OpenAI via OpenRouter, plus Lovable AI Gateway).
                  Each provider has their own privacy policy. Some free models may log prompts for model improvement.
                </p>
              </section>

              <section className="rounded-xl border border-border/15 bg-muted/10 p-3">
                <p className="text-xs text-muted-foreground mb-2">
                  You can change these settings anytime in <strong>Settings → Privacy</strong>, or request deletion of all your data.
                </p>
              </section>
            </div>

            <div className="px-6 py-4 border-t border-border/20 bg-muted/5 flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => accept(true)}
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
              >
                ✓ I understand — opt in to improve Lumina
              </Button>
              <Button
                onClick={() => accept(false)}
                disabled={submitting}
                variant="outline"
                className="flex-1"
              >
                I understand — opt out of training
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
