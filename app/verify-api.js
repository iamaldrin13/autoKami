import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    // 1. Get a user
    const { data: user, error } = await supabase.from('users').select('id').limit(1).single();
    
    if (error || !user) {
        console.error("No user found:", error);
        return;
    }
    
    console.log("Found User ID:", user.id);
    
    // 2. Fetch API
    const url = `http://localhost:3000/api/kamigotchis?privyUserId=${user.id}`;
    console.log("Fetching:", url);
    
    try {
        const response = await fetch(url);
        const json = await response.json();
        
        if (json.kamigotchis && json.kamigotchis.length > 0) {
            console.log("First Kami Automation Settings:");
            console.log(JSON.stringify(json.kamigotchis[0].automation, null, 2));
            
            if (json.kamigotchis[0].automation.lastFeedAt !== undefined) {
                console.log("✅ lastFeedAt is present!");
            } else {
                console.error("❌ lastFeedAt is MISSING!");
            }
        } else {
            console.log("No kamigotchis found for user.");
        }
        
    } catch (e) {
        console.error("API Fetch failed:", e);
    }
}

run();
