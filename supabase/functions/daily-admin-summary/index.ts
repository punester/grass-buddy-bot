import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAILS = ["punit@110labs.com", "pun279@gmail.com"];

// Resend free tier: 100 emails/day, 3000/month
// Resend paid: $20/mo for 50k emails, then $0.0004/email
const RESEND_COST_PER_EMAIL = 0.0004;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const since = yesterday.toISOString();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    // ── 1. Total user count ──
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    // Users created in last 24h
    const { count: newUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    // ── 2. Zip lookups in last 24h ──
    const { count: totalLookups } = await supabase
      .from("zip_lookup_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    // Unique zips looked up
    const { data: lookupData } = await supabase
      .from("zip_lookup_log")
      .select("zip_code")
      .gte("created_at", since);
    const uniqueZips = new Set(lookupData?.map((r) => r.zip_code) || []).size;

    // Recommendation breakdown
    const { data: recData } = await supabase
      .from("zip_lookup_log")
      .select("recommendation")
      .gte("created_at", since);
    const recCounts: Record<string, number> = {};
    (recData || []).forEach((r) => {
      recCounts[r.recommendation] = (recCounts[r.recommendation] || 0) + 1;
    });

    // ── 3. Cache stats ──
    const { count: totalCached } = await supabase
      .from("zip_cache")
      .select("*", { count: "exact", head: true });

    // Fresh caches (updated in last 24h)
    const { count: freshCaches } = await supabase
      .from("zip_cache")
      .select("*", { count: "exact", head: true })
      .gte("cached_at", since);

    // Total lookup count from cache (shows cache hits)
    const { data: cacheHitData } = await supabase
      .from("zip_cache")
      .select("lookup_count")
      .gt("lookup_count", 0);
    const totalCacheHits = (cacheHitData || []).reduce(
      (sum, r) => sum + r.lookup_count,
      0
    );

    // ── 4. Emails sent in last 24h (deduplicated) ──
    const { data: emailLogs } = await supabase
      .from("email_send_log")
      .select("template_name, status, message_id")
      .gte("created_at", since);

    // Deduplicate by message_id, keeping last status
    const emailsByMessageId = new Map<string, { template_name: string; status: string }>();
    (emailLogs || []).forEach((row) => {
      const key = row.message_id || row.template_name + Math.random();
      emailsByMessageId.set(key, { template_name: row.template_name, status: row.status });
    });
    const deduped = Array.from(emailsByMessageId.values());

    const emailsSent = deduped.filter((r) => r.status === "sent").length;
    const emailsFailed = deduped.filter((r) => r.status === "dlq" || r.status === "failed").length;
    const emailsSuppressed = deduped.filter((r) => r.status === "suppressed").length;

    // By template
    const templateCounts: Record<string, number> = {};
    deduped
      .filter((r) => r.status === "sent")
      .forEach((r) => {
        templateCounts[r.template_name] = (templateCounts[r.template_name] || 0) + 1;
      });

    // ── 5. Subscription stats ──
    const { count: paidUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("tier", "paid");

    const { count: referralPremium } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("premium_source", "referral");

    const { count: stripePremium } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("premium_source", "stripe");

    // ── 6. Suppressed emails total ──
    const { count: totalSuppressed } = await supabase
      .from("suppressed_emails")
      .select("*", { count: "exact", head: true });

    // ── Build email ──
    const estimatedEmailCost = emailsSent * RESEND_COST_PER_EMAIL;

    const recBreakdown = Object.entries(recCounts)
      .map(([rec, count]) => `<li>${rec}: <strong>${count}</strong></li>`)
      .join("") || "<li>No lookups</li>";

    const templateBreakdown = Object.entries(templateCounts)
      .map(([tmpl, count]) => `<li>${tmpl}: <strong>${count}</strong></li>`)
      .join("") || "<li>No emails sent</li>";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h1 style="font-size:22px;color:#16a34a;margin-bottom:4px;">📊 ThirstyGrass Daily Summary</h1>
  <p style="color:#6b7280;font-size:13px;margin-top:0;">${yesterdayStr} → ${todayStr}</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">

  <h2 style="font-size:16px;margin-bottom:8px;">👥 Users</h2>
  <table style="font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Total users</td><td><strong>${totalUsers ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">New (24h)</td><td><strong>${newUsers ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Paid (Stripe)</td><td><strong>${stripePremium ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Paid (Referral)</td><td><strong>${referralPremium ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Total paid</td><td><strong>${paidUsers ?? 0}</strong></td></tr>
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px;">🔍 Lookups (24h)</h2>
  <table style="font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Total lookups</td><td><strong>${totalLookups ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Unique zip codes</td><td><strong>${uniqueZips}</strong></td></tr>
  </table>
  <p style="font-size:13px;color:#6b7280;margin:8px 0 0;">Recommendation breakdown:</p>
  <ul style="font-size:14px;margin:4px 0;">${recBreakdown}</ul>

  <h2 style="font-size:16px;margin:20px 0 8px;">💾 Cache</h2>
  <table style="font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Total cached zips</td><td><strong>${totalCached ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Refreshed (24h)</td><td><strong>${freshCaches ?? 0}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">All-time cache hits</td><td><strong>${totalCacheHits}</strong></td></tr>
  </table>

  <h2 style="font-size:16px;margin:20px 0 8px;">📧 Emails (24h)</h2>
  <table style="font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Sent</td><td><strong style="color:#16a34a;">${emailsSent}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Failed</td><td><strong style="color:${emailsFailed > 0 ? '#dc2626' : '#6b7280'};">${emailsFailed}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Suppressed</td><td><strong>${emailsSuppressed}</strong></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Total suppressed (all-time)</td><td><strong>${totalSuppressed ?? 0}</strong></td></tr>
  </table>
  <p style="font-size:13px;color:#6b7280;margin:8px 0 0;">By template:</p>
  <ul style="font-size:14px;margin:4px 0;">${templateBreakdown}</ul>

  <h2 style="font-size:16px;margin:20px 0 8px;">💰 Estimated Costs</h2>
  <table style="font-size:14px;border-collapse:collapse;">
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Email (Resend)</td><td><strong>$${estimatedEmailCost.toFixed(4)}</strong> <span style="color:#9ca3af;">(${emailsSent} × $0.0004)</span></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Weather API</td><td><strong>Free</strong> <span style="color:#9ca3af;">(Open-Meteo)</span></td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#6b7280;">Database</td><td><strong>Included</strong> <span style="color:#9ca3af;">(Lovable Cloud)</span></td></tr>
  </table>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
  <p style="font-size:12px;color:#9ca3af;text-align:center;">
    Sent automatically by ThirstyGrass · ${todayStr}
  </p>
</body>
</html>`;

    // Send to all admin emails
    for (const adminEmail of ADMIN_EMAILS) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "ThirstyGrass <hello@thirstygrass.com>",
          reply_to: "hello@thirstygrass.com",
          to: [adminEmail],
          subject: `📊 ThirstyGrass Daily Summary — ${todayStr}`,
          html,
        }),
      });

      const resendBody = await resendRes.json().catch(() => ({}));
      console.log(`Admin summary to ${adminEmail}:`, resendRes.status, JSON.stringify(resendBody));

      // Log it
      await supabase.from("email_send_log").insert({
        template_name: "admin-daily-summary",
        recipient_email: adminEmail,
        status: resendRes.ok ? "sent" : "failed",
        message_id: resendBody?.id || null,
        error_message: resendRes.ok ? null : JSON.stringify(resendBody),
        metadata: { type: "admin-summary", date: todayStr },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
