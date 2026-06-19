import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giekeskbbgbjacpgoiar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZWtlc2tiYmdiamFjcGdvaWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU1MjAsImV4cCI6MjA5Njg0MTUyMH0._H4sV-Z-aBU2_PB4-MDSvrd1ayUOplHufSPzaNVJre4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAnon() {
  try {
    console.log('Attempting anonymous sign in...');
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.log('Anonymous sign in failed:', error.message);
      return;
    }
    console.log('Anonymous sign in succeeded!', data.user?.id);
    
    // Attempt to query the profile
    console.log('Querying profile...');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user?.id)
      .single();
      
    if (profileError) {
      console.log('Profile query failed:', profileError.message);
      return;
    }
    
    console.log('Profile details:', JSON.stringify(profile, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

checkAnon();
