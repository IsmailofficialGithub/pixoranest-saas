import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import OpenAI from "npm:openai@4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openApiKey) {
        throw new Error("OPENAI_API_KEY is not set. Please add it to your Supabase Edge Function Secrets.");
    }
    
    const openai = new OpenAI({
      apiKey: openApiKey,
    });

    const { sessionId, userMessage, chatbotId, isNewSession } = await req.json()
    
    // Auth header comes with the request to authenticate the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
        throw new Error("Missing Authorization header")
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Create a Supabase client with the user's JWT so RLS policies are applied if they are logged in
    // If not logged in, this uses the anon key, which is fine for public chatbots
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    
    // Fetch user info to track who sent the message (optional)
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Fetch chatbot personality or use default
    let bot = {
        system_prompt: 'You are a helpful and professional assistant for PIXORA Premium AI Automation. Answer queries concisely and kindly.',
        temperature: 0.7
    };
    
    if (chatbotId) {
        const { data: fetchedBot, error: botError } = await supabase
          .from('ai_chatbots')
          .select('*')
          .eq('id', chatbotId)
          .single()
          
        if (fetchedBot) {
            bot = fetchedBot;
        }
    }

    // 2. Fetch recent chat history
    let history = []
    let currentSessionId = sessionId;

    if (!isNewSession && currentSessionId) {
        const { data: chatHistory } = await supabase
          .from('ai_chat_messages')
          .select('role, content')
          .eq('session_id', currentSessionId)
          .order('created_at', { ascending: true })
        
        if (chatHistory && chatHistory.length > 0) {
            history = chatHistory
        }
    } else {
        // Create new session
        const sessionData: any = { status: 'active' }
        if (user) sessionData.visitor_id = user.id
        
        const { data: newSession, error: sessionError } = await supabase
            .from('ai_chat_sessions')
            .insert([sessionData])
            .select('id')
            .single()
            
        if (newSession) {
            currentSessionId = newSession.id;
        }
    }
    
    // 3. Save User Message immediately
    if (currentSessionId) {
      const messageData: any = {
        session_id: currentSessionId,
        role: 'user',
        content: userMessage
      }
      if (user) messageData.user_id = user.id

      await supabase.from('ai_chat_messages').insert([messageData])
    }

    // 4. Construct messages for OpenAI
    const messages = [
      { role: 'system', content: bot.system_prompt },
      ...history,
      { role: 'user', content: userMessage }
    ]

    // 5. Define Tools for Database interaction
    const tools = [
      {
        type: "function",
        function: {
          name: "get_available_services",
          description: "Get a list of all available services/features and their descriptions from the database.",
          parameters: {
             type: "object",
             properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_service_pricing",
          description: "Get the pricing details for available services.",
          parameters: {
              type: "object",
              properties: {
                  service_name: { type: "string" }
              }
          }
        }
      }
    ]

    // 6. Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use gpt-4o-mini for speed and cost effectiveness
      messages: messages as any[],
      tools: tools as any[],
      tool_choice: "auto",
      temperature: Number(bot.temperature) || 0.7,
    })

    let responseMessage = response.choices[0].message

    // 7. Handle Tool Calls if OpenAI decides to query the Database
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      messages.push({
          role: 'assistant',
          tool_calls: responseMessage.tool_calls,
          content: responseMessage.content || "" // ensure content is at least empty string if null
      })

      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'get_available_services') {
           // Query database securely as the user
           const { data: services, error } = await supabase.from('services').select('name, description, service_category').eq('is_active', true)
           messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(services || {error: "Failed to fetch"}) })
        }
        else if (toolCall.function.name === 'get_service_pricing') {
            const { data: pricing, error } = await supabase.from('services')
               .select('name, base_price, pricing_model')
               .eq('is_active', true)
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(pricing || {error: "Failed to fetch pricing"}) })
        }
      }
      
      // Call OpenAI AGAIN with the populated tool data
      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages as any[],
        temperature: Number(bot.temperature) || 0.7,
      })
      
      responseMessage = finalResponse.choices[0].message
    }

    // 8. Save Assistant Response
    if (currentSessionId && responseMessage.content) {
      const assistantMessageData: any = {
        session_id: currentSessionId,
        role: 'assistant',
        content: responseMessage.content
      }
      if (user) assistantMessageData.user_id = user.id
      
      await supabase.from('ai_chat_messages').insert([assistantMessageData])
    }

    return new Response(
      JSON.stringify({ message: responseMessage.content, sessionId: currentSessionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    console.error("Error in ai-chat:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error occurred" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
