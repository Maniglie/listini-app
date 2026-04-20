// api/auth.js - Questo file gira sul SERVER (Vercel), mai esposto al client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;

  // La password è confrontata SERVER-SIDE, mai nel frontend
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'app@listini.local',
    password: password
  });

  if (error || !data.session) {
    return res.status(401).json({ error: 'Password non corretta' });
  }

  // Ritorna il token al frontend (valido per le query)
  return res.status(200).json({ 
    token: data.session.access_token,
    expires_at: data.session.expires_at
  });
}
