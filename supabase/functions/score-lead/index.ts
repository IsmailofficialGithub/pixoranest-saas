import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { call_log_id } = await req.json();
    if (!call_log_id) throw new Error("call_log_id is required");

    // Fetch call log
    const { data: callLog, error: callError } = await supabaseClient
      .from("call_logs")
      .select("*")
      .eq("id", call_log_id)
      .single();

    if (callError) throw callError;

    // Build scoring prompt
    let context = "";
    if (callLog.transcript) context += `**Call Transcript:**\n${callLog.transcript}\n\n`;
    if (callLog.duration_seconds) context += `**Call Duration:** ${callLog.duration_seconds} seconds\n\n`;
    if (callLog.phone_number) context += `**Phone Number:** ${callLog.phone_number}\n\n`;
    if (callLog.ai_summary) context += `**AI Summary:** ${callLog.ai_summary}\n\n`;

    // Use Lovable AI Gateway with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: `You are an expert sales lead qualification analyst. Analyze leads and provide accurate scoring based on multiple signals including call transcripts, duration, and engagement patterns.

Evaluate based on:
1. Engagement Level: How engaged is the prospect?
2. Intent Signals: Do they show buying intent?
3. Qualification: Do they fit the ideal customer profile?
4. Urgency: How soon might they convert?
5. Budget Indicators: Can they afford the solution?`,
          },
          {
            role: "user",
            content: `Analyze this lead and provide a comprehensive score:\n\n${context || "No data available - assign a neutral score of 50."}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "score_lead",
              description: "Return the lead score analysis result",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Lead score from 0-100" },
                  confidence: { type: "number", description: "Confidence level from 0 to 1" },
                  reasoning: { type: "string", description: "Detailed explanation of the score" },
                  suggested_actions: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of recommended follow-up actions",
                  },
                  key_insights: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key insights extracted from the data",
                  },
                },
                required: ["score", "confidence", "reasoning", "suggested_actions", "key_insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "score_lead" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      // Fallback to rule-based scoring
      return respondWithFallback(supabaseClient, callLog, call_log_id, corsHeaders);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let score: { score: number; confidence: number; reasoning: string; suggested_actions: string[]; key_insights: string[] };
    
    if (toolCall?.function?.arguments) {
      score = JSON.parse(toolCall.function.arguments);
    } else {
      return respondWithFallback(supabaseClient, callLog, call_log_id, corsHeaders);
    }

    // Clamp score
    score.score = Math.max(0, Math.min(100, score.score));

    const qualificationStatus = getQualificationStatus(score.score);

    // Check if lead exists
    const { data: existingLead } = await supabaseClient
      .from("leads")
      .select("id")
      .eq("call_log_id", call_log_id)
      .single();

    if (existingLead) {
      await supabaseClient
        .from("leads")
        .update({
          lead_score: score.score,
          interest_level: Math.round(score.confidence * 5),
          notes: score.reasoning,
          metadata: {
            ai_insights: score.key_insights,
            suggested_actions: score.suggested_actions,
            qualification_status: qualificationStatus,
            scored_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingLead.id);
    } else {
      await supabaseClient.from("leads").insert({
        client_id: callLog.client_id,
        call_log_id: call_log_id,
        phone: callLog.phone_number,
        lead_source: "telecaller",
        lead_score: score.score,
        interest_level: Math.round(score.confidence * 5),
        status: "new",
        notes: score.reasoning,
        metadata: {
          ai_insights: score.key_insights,
          suggested_actions: score.suggested_actions,
          qualification_status: qualificationStatus,
          scored_at: new Date().toISOString(),
        },
      });
    }

    // Notify on hot leads
    if (score.score >= 80) {
      // Get the client's user_id for notification
      const { data: client } = await supabaseClient
        .from("clients")
        .select("user_id")
        .eq("id", callLog.client_id)
        .single();

      if (client) {
        await supabaseClient.from("notifications").insert({
          user_id: client.user_id,
          title: "🔥 Hot Lead Detected!",
          message: `A high-value lead (score: ${score.score}/100) was captured. ${score.reasoning.substring(0, 100)}...`,
          type: "success",
          action_url: "/client/leads",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, score: { ...score, qualificationStatus } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("score-lead error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

function getQualificationStatus(score: number): string {
  if (score >= 80) return "hot";
  if (score >= 60) return "warm";
  if (score >= 40) return "cold";
  return "unqualified";
}

async function respondWithFallback(
  supabaseClient: any,
  callLog: any,
  call_log_id: string,
  corsHeaders: Record<string, string>
) {
  let score = 50;

  if (callLog.duration_seconds) {
    if (callLog.duration_seconds > 120) score += 15;
    else if (callLog.duration_seconds > 60) score += 10;
    else if (callLog.duration_seconds < 30) score -= 10;
  }

  if (callLog.transcript) {
    const t = callLog.transcript.toLowerCase();
    ["interested", "yes", "definitely", "price", "cost", "purchase"].forEach(
      (kw) => { if (t.includes(kw)) score += 5; }
    );
    ["not interested", "no", "busy", "remove", "spam"].forEach(
      (kw) => { if (t.includes(kw)) score -= 10; }
    );
  }

  score = Math.max(0, Math.min(100, score));
  const qualificationStatus = getQualificationStatus(score);

  const result = {
    score,
    confidence: 0.6,
    reasoning: "Scored using rule-based fallback algorithm",
    suggested_actions: getSuggestedActions(score),
    key_insights: [],
    qualificationStatus,
  };

  // Get client user_id for notification
  const { data: client } = await supabaseClient
    .from("clients")
    .select("user_id")
    .eq("id", callLog.client_id)
    .single();

  const { data: existingLead } = await supabaseClient
    .from("leads")
    .select("id")
    .eq("call_log_id", call_log_id)
    .single();

  const leadData = {
    lead_score: score,
    interest_level: 3,
    notes: result.reasoning,
    metadata: {
      qualification_status: qualificationStatus,
      suggested_actions: result.suggested_actions,
      scored_at: new Date().toISOString(),
    },
  };

  if (existingLead) {
    await supabaseClient.from("leads").update({ ...leadData, updated_at: new Date().toISOString() }).eq("id", existingLead.id);
  } else {
    await supabaseClient.from("leads").insert({
      ...leadData,
      client_id: callLog.client_id,
      call_log_id,
      phone: callLog.phone_number,
      lead_source: "telecaller",
      status: "new",
    });
  }

  if (score >= 80 && client) {
    await supabaseClient.from("notifications").insert({
      user_id: client.user_id,
      title: "🔥 Hot Lead Detected!",
      message: `A high-value lead (score: ${score}/100) was detected via rule-based analysis.`,
      type: "success",
      action_url: "/client/leads",
    });
  }

  return new Response(
    JSON.stringify({ success: true, score: result }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
}

function getSuggestedActions(score: number): string[] {
  if (score >= 80) return ["Schedule immediate follow-up call", "Send pricing and proposal", "Assign to senior sales rep"];
  if (score >= 60) return ["Follow up within 24 hours", "Send product information", "Schedule demo"];
  if (score >= 40) return ["Add to nurture sequence", "Send educational content", "Check back in 30 days"];
  return ["Mark as low priority", "Add to general newsletter", "Re-qualify in 90 days"];
}
