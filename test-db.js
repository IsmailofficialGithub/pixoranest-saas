// No dotenv needed
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ukxoyojiztuvaqgslegw.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVreG95b2ppenR1dmFxZ3NsZWd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NTU4NzgsImV4cCI6MjA4NjUzMTg3OH0.yq_ZJzxkZvL3VdB2GrhkWVkw3DrVZdHelDErQIkKgY4";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
  console.log('Testing Anonymous Chatbot Fetch (what Incognito sees):');
  
  // Test 1: Fetch chatbots anonymously
  const { data: bots, error: botErr } = await supabase
    .from('ai_chatbots')
    .select('*');
    
  console.log("Anon Bots:", bots?.length ? bots.map(b => b.id) : null);
  if (botErr) console.error("Bot Fetch Error:", botErr.message);

  // Test 2: See recent chat sessions (what admin dashboard queries)
  // We won't see any because of RLS, but let's see what anon sees
  const { data: sessions, error: sessionErr } = await supabase
    .from('ai_chat_sessions')
    .select('id, visitor_id, chatbot_id, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log("\\nAnon Sessions Viewable:", sessions);
  if (sessionErr) console.error("Session Fetch Error:", sessionErr.message);
  
}

runTest();
