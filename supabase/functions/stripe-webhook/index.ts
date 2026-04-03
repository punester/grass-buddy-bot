import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

async function sendEmail(supabase: ReturnType<typeof createClient>, templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, any> = {}) {
  try {
    await supabase.functions.invoke('send-transactional-email', {
      body: { templateName, recipientEmail, idempotencyKey, templateData },
    });
    console.log(`[stripe-webhook] Sent ${templateName} to ${recipientEmail}`);
  } catch (err) {
    console.error(`[stripe-webhook] Failed to send ${templateName}:`, err);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId) {
        console.error("[stripe-webhook] No client_reference_id");
        return new Response("OK", { status: 200 });
      }

      // Get subscription details
      const subscriptionId = session.subscription as string;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const endsAt = new Date(subscription.current_period_end * 1000).toISOString();

      await supabase
        .from("profiles")
        .update({
          tier: "paid",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          subscription_ends_at: endsAt,
          subscription_cancel_at_period_end: false,
        })
        .eq("id", userId);

      console.log(`[stripe-webhook] Upgraded user ${userId} to paid`);

      // Send welcome email
      const { data: upgradedProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();

      if (upgradedProfile?.email) {
        await sendEmail(supabase, 'subscription-welcome', upgradedProfile.email, `sub-welcome-${subscriptionId}`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({
            tier: "free",
            stripe_subscription_id: null,
            subscription_cancel_at_period_end: false,
            subscription_ends_at: null,
          })
          .eq("id", profile.id);

        console.log(`[stripe-webhook] Downgraded user ${profile.id} to free`);
      }
    }
  } catch (err) {
    console.error("[stripe-webhook] Error processing event:", err);
    return new Response("Processing error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
