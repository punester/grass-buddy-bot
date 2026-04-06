import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FALLBACK_URL = "https://thirstygrass.com";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    // Extract code from path — supports /redirect/CODE or /redirect?code=CODE
    const pathParts = url.pathname.split("/").filter(Boolean);
    const code = pathParts[pathParts.length - 1] === "redirect"
      ? url.searchParams.get("code")
      : pathParts[pathParts.length - 1];

    if (!code || code === "redirect") {
      return new Response(null, { status: 302, headers: { Location: FALLBACK_URL } });
    }

    const { data, error } = await supabase
      .from("short_links")
      .select("destination_url, expires_at")
      .eq("code", code)
      .single();

    if (error || !data) {
      return new Response(null, { status: 302, headers: { Location: FALLBACK_URL } });
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return new Response(null, { status: 302, headers: { Location: FALLBACK_URL } });
    }

    return new Response(null, { status: 302, headers: { Location: data.destination_url } });
  } catch {
    return new Response(null, { status: 302, headers: { Location: FALLBACK_URL } });
  }
});
