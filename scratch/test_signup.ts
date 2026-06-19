import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giekeskbbgbjacpgoiar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZWtlc2tiYmdiamFjcGdvaWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU1MjAsImV4cCI6MjA5Njg0MTUyMH0._H4sV-Z-aBU2_PB4-MDSvrd1ayUOplHufSPzaNVJre4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('==================================================');
  console.log('SUPABASE SIGNUP TRIGGER INTEGRATION TEST (BYPASS RATE LIMIT)');
  console.log('==================================================\n');

  // We use the successfully registered user from the previous step to bypass the rate limit
  const email = 'wakeit_test_38284@gmail.com';
  const password = 'Password123!_38284';
  const expectedFullName = 'Test User 38284';
  const userId = 'd9080753-6013-44f2-9355-4b26d74a10dc';

  console.log(`1. Attempting explicit sign in with pre-existing user: ${email}...`);
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw new Error(`Auth sign in failed: ${authError.message}`);
    }

    console.log(`  -> Sign in successful. Authenticated as user ID: ${authData.user?.id}`);

    console.log('2. Fetching profile row from public.users table...');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch public.users profile: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error('Fetched profile is null.');
    }

    console.log('  -> Profile row found:');
    console.log(JSON.stringify(profile, null, 2));

    // Assertions
    console.log('\n3. Running validation checks on signup trigger result...');

    // a. Check plan_type is free_trial
    const planTypeMatch = profile.plan_type === 'free_trial';
    console.log(`   - plan_type is 'free_trial': ${planTypeMatch ? 'PASS' : 'FAIL'} (${profile.plan_type})`);

    // b. Check full_name is correctly passed from metadata via trigger
    const fullNameMatch = profile.full_name === expectedFullName;
    console.log(`   - full_name is '${expectedFullName}': ${fullNameMatch ? 'PASS' : 'FAIL'} (${profile.full_name})`);

    // c. Check trial started and trial ends timestamps
    if (!profile.trial_started_at || !profile.trial_ends_at) {
      throw new Error('Trial timestamps are null.');
    }

    const start = new Date(profile.trial_started_at);
    const end = new Date(profile.trial_ends_at);
    
    // Check difference is exactly 3 days (in milliseconds: 3 * 24 * 60 * 60 * 1000 = 259200000)
    const diffMs = end.getTime() - start.getTime();
    const expectedDiffMs = 3 * 24 * 60 * 60 * 1000;
    
    // Allow small margin of error (e.g. 5 seconds) due to DB processing/rounding
    const marginMs = 5000;
    const diffMatch = Math.abs(diffMs - expectedDiffMs) <= marginMs;
    const diffDaysRounded = Math.round(diffMs / (24 * 60 * 60 * 1000));

    console.log(`   - trial duration is 3 days: ${diffMatch ? 'PASS' : 'FAIL'} (${diffDaysRounded} days calculated from timestamps)`);

    const allPassed = planTypeMatch && fullNameMatch && diffMatch;
    console.log('\n==================================================');
    if (allPassed) {
      console.log('TEST RESULT: ALL SIGNUP VALIDATION CHECKS PASSED!');
    } else {
      console.log('TEST RESULT: SOME CHECKS FAILED!');
      process.exit(1);
    }
    console.log('==================================================');

  } catch (err: any) {
    console.error(`\nTEST RESULT: FAILED with error: ${err.message}`);
    process.exit(1);
  }
}

runTest();
