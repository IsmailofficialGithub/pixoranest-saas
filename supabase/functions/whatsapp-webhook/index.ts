import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"
import OpenAI from "npm:openai@4"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const payload = await req.json()
    console.log("Received Webhook Payload:", JSON.stringify(payload, null, 2))

    // Handle array or object payload
    const dataArray = Array.isArray(payload) ? payload : [payload]

    for (const item of dataArray) {
      const body = item.body || item
      if (body.event !== 'message') continue

      const messageData = body.data
      const senderPhoneNumber = messageData.senderPhoneNumber
      const recipientPhoneNumberId = messageData.recipientPhoneNumberId
      const content = messageData.content?.text || ""
      const messageId = messageData.messageId
      const senderName = messageData.senderName

      console.log(`Processing message from ${senderPhoneNumber} to ${recipientPhoneNumberId}: ${content}`)

      // 1. Find the application/bot by phone_number_id
      const { data: bot, error: botError } = await supabaseAdmin
        .from('whatsapp_applications')
        .select('*')
        .eq('phone_number_id', recipientPhoneNumberId)
        .maybeSingle()

      if (botError || !bot) {
        console.error("Bot not found for recipientPhoneNumberId:", recipientPhoneNumberId)
        continue
      }

      // 2. Find client_id linked to this bot
      // Check if bot has client_id, otherwise check whatsapp_user_access
      let clientId = bot.client_id
      
      if (!clientId) {
        const { data: access } = await supabaseAdmin
          .from('whatsapp_user_access')
          .select('user_id')
          .eq('application_id', bot.id)
          .limit(1)
          .maybeSingle()
        
        if (access) {
          const { data: client } = await supabaseAdmin
            .from('clients')
            .select('id')
            .eq('user_id', access.user_id)
            .maybeSingle()
          clientId = client?.id
        }
      }

      if (!clientId) {
        console.error("Client not found for bot:", bot.id)
        continue
      }

      // 3. Store incoming message
      const { data: storedMsg, error: storeError } = await supabaseAdmin
        .from('whatsapp_messages')
        .insert({
          application_id: bot.id,
          client_id: clientId,
          phone_number: senderPhoneNumber,
          message_content: content,
          direction: 'inbound',
          sender_name: senderName,
          external_id: messageId,
          status: 'delivered',
          sent_at: new Date().toISOString()
        })
        .select()
        .single()

      if (storeError) {
        console.error("Failed to store incoming message:", storeError)
      }

      // 4. AI Chatbot Response
      const openApiKey = Deno.env.get('OPENAI_API_KEY')
      if (openApiKey && content) {
        try {
          const openai = new OpenAI({ apiKey: openApiKey })
          
          // Fetch bot personality (ai_chatbots table)
          const { data: aiBot } = await supabaseAdmin
            .from('ai_chatbots')
            .select('system_prompt, temperature')
            .eq('client_id', clientId)
            .limit(1)
            .maybeSingle()
          
          const systemPrompt = aiBot?.system_prompt || "You are a helpful and professional assistant for LeadNest. Answer queries concisely and kindly in the same language as the user."
          const temperature = aiBot?.temperature || 0.7

          // Fetch recent history for this conversation to give context
          const { data: history } = await supabaseAdmin
            .from('whatsapp_messages')
            .select('direction, message_content')
            .eq('phone_number', senderPhoneNumber)
            .eq('application_id', bot.id)
            .order('sent_at', { ascending: false })
            .limit(10)

          const chatHistory = (history || []).reverse().map(m => ({
            role: m.direction === 'inbound' ? 'user' : 'assistant',
            content: m.message_content
          }))

          // Call AI
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: 'system', content: systemPrompt },
              ...chatHistory
            ],
            temperature: Number(temperature)
          })

          const aiText = completion.choices[0].message.content

          if (aiText) {
            console.log("AI Response:", aiText)
            
            // 5. Send AI response back via WhatsApp
            const apiKey = bot.api_config?.api_key || Deno.env.get('WHATSAPP_API_KEY')
            
            if (apiKey) {
              const whapiRes = await fetch("https://app.whapihub.com/v2/whatsapp-business/messages", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  to: senderPhoneNumber,
                  type: "text",
                  text: aiText
                })
              })

              const whapiResult = await whapiRes.json()
              console.log("Whapi Response:", whapiResult)

              // 6. Store AI response message in DB
              await supabaseAdmin
                .from('whatsapp_messages')
                .insert({
                  application_id: bot.id,
                  client_id: clientId,
                  phone_number: senderPhoneNumber,
                  message_content: aiText,
                  direction: 'outbound',
                  sender_name: bot.name || 'LeadNest AI',
                  status: whapiRes.ok ? 'sent' : 'failed',
                  sent_at: new Date().toISOString(),
                  metadata: { ai_response: true, whapi_id: whapiResult.id }
                })
            } else {
              console.warn("No WhatsApp API key found for bot:", bot.id)
            }
          }
        } catch (aiErr) {
          console.error("AI Generation Error:", aiErr)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error: any) {
    console.error("Webhook Error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
