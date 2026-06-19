import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giekeskbbgbjacpgoiar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZWtlc2tiYmdiamFjcGdvaWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU1MjAsImV4cCI6MjA5Njg0MTUyMH0._H4sV-Z-aBU2_PB4-MDSvrd1ayUOplHufSPzaNVJre4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getUsers() {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(10);
      
    if (error) {
      console.log('Error fetching users:', error.message);
      return;
    }
    
    console.log('Users in database:');
    console.log(JSON.stringify(users, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

getUsers();
