/**
 * calculate-recommendation — Single-user recommendation endpoint.
 *
 * Returns the full watering recommendation, seasonal state, and alert
 * determination for one user. Called by SMS dispatch, and available as
 * a standalone API for any consumer that needs per-user recommendations.
 *
 * Input (JSON body): { userId: string }
 * Output: RecommendationResult (see _shared/recommendation.ts)
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getRecommendationForUser } from '../_shared/recommendation.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let userId: string
  try {
    const body = await req.json()
    userId = body.userId
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required and must be a string')
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const result = await getRecommendationForUser(supabase, userId)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('calculate-recommendation error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
