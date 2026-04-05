import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, data } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Extract customer email from Dodo payload
    const customerEmail = data?.customer?.email;
    const subscriptionId = data?.subscription_id || data?.id;
    const status = data?.status;
    const productId = data?.product_id || data?.items?.[0]?.product_id || '';

    // Determine plan tier from product ID
    const ULTIMATE_PRODUCT_ID = 'pdt_0NbKNHJ5nK556qajM5MKa';
    const PRO_PLUS_PRODUCT_ID = 'pdt_0Nbybrhl2M0GdzScdoAwb';
    let planTier = 'ultimate'; // default paid tier
    if (productId === PRO_PLUS_PRODUCT_ID) planTier = 'pro_plus';
    const status = data?.status;

    if (!customerEmail) {
      console.error("No customer email in webhook payload");
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find user by email
    const { data: userData } = await supabase.auth.admin.listUsers();
    const user = userData?.users?.find((u: { email?: string }) => u.email === customerEmail);

    if (!user) {
      console.error("User not found for email:", customerEmail);
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const isActive = status === "active";

    // Upsert subscription
    const { error } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: userId,
        subscription_id: subscriptionId,
        status: isActive ? "active" : "inactive",
        plan: isActive ? "pro" : "basic",
        current_period_end: data?.current_period_end || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ error: "DB update failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Subscription ${type} processed: ${isActive ? 'PRO' : 'BASIC'}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
