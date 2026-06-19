import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giekeskbbgbjacpgoiar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZWtlc2tiYmdiamFjcGdvaWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU1MjAsImV4cCI6MjA5Njg0MTUyMH0._H4sV-Z-aBU2_PB4-MDSvrd1ayUOplHufSPzaNVJre4';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TEST_EMAIL = 'test_admin_715514@gmail.com';
const TEST_PASSWORD = 'Password123!';

async function runQA() {
  console.log('==================================================');
  console.log('SUPABASE QA: ALARM CHALLENGE ATTEMPTS VERIFICATION');
  console.log('==================================================\n');

  // 1. Sign in
  console.log(`[Auth] Signing in as ${TEST_EMAIL}...`);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });

  if (authError || !authData || !authData.user) {
    console.error('FAIL: Authentication failed', authError);
    return;
  }
  const userId = authData.user.id;
  console.log(`PASS: Authenticated successfully. User ID: ${userId}\n`);

  // 2. Find or Create Group
  console.log('[Group] Searching for active group where user is a member...');
  const { data: memberRows, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1);

  if (memberError) {
    console.error('FAIL: Querying groups failed', memberError);
    return;
  }

  let groupId = '';
  if (memberRows && memberRows.length > 0) {
    groupId = memberRows[0].group_id;
    console.log(`PASS: Found existing active group: ${groupId}\n`);
  } else {
    console.log('[Group] No group found. Creating a new group...');
    // Create new group via edge function
    const { data: newGroup, error: functionError } = await supabase.functions.invoke('create-group', {
      body: { name: 'QA Test Group', description: 'Testing Alarm Challenge' }
    });

    if (functionError || !newGroup || !newGroup.success) {
      console.error('FAIL: Failed to create group', functionError || newGroup);
      return;
    }
    groupId = newGroup.group_id;
    console.log(`PASS: Group created successfully: ${groupId}\n`);
  }

  // 3. Schedule Alarm
  console.log('[Alarm] Creating a medium difficulty alarm...');
  const alarmTime = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins in future
  const { data: alarmRes, error: alarmError } = await supabase.functions.invoke('create-alarm', {
    body: {
      group_id: groupId,
      title: 'QA Challenge Alarm',
      alarm_time: alarmTime,
      difficulty: 'medium',
      is_recurring: false
    }
  });

  if (alarmError) {
    console.error('FAIL: Failed to create alarm via edge function:', alarmError);
    if ((alarmError as any).context) {
      try {
        const bodyText = await (alarmError as any).context.text();
        console.error('Response Body:', bodyText);
      } catch (e) {
        console.error('Failed to read error response context text:', e);
      }
    }
    return;
  }

  if (!alarmRes || !alarmRes.success) {
    console.error('FAIL: Alarm creation response success is false:', alarmRes);
    return;
  }
  const alarmId = alarmRes.alarm_id;
  console.log(`PASS: Scheduled alarm successfully. Alarm ID: ${alarmId}\n`);

  // 4. Verify Pending Completion Row
  console.log('[Database] Checking for pending alarm completion row in Supabase...');
  const { data: completions, error: compError } = await supabase
    .from('alarm_completions')
    .select('*')
    .eq('alarm_id', alarmId)
    .eq('user_id', userId);

  if (compError || !completions || completions.length === 0) {
    console.error('FAIL: Pending completion row not found in Supabase', compError || completions);
    return;
  }
  console.log(`PASS: Found pending completion row: ${completions[0].id} (status: ${completions[0].status})\n`);

  // 5. Invoke complete-challenge (simulate 2 wrong answers + 1 correct = 3 attempts)
  console.log('[Challenge] Simulating entering 2 wrong answers, then 1 correct answer...');
  console.log('[Challenge] Posting completion (attempts = 3) to complete-challenge Edge Function...');
  const { data: completeRes, error: completeError } = await supabase.functions.invoke('complete-challenge', {
    body: {
      alarm_id: alarmId,
      status: 'completed',
      completed_at: new Date().toISOString(),
      attempts: 3
    }
  });

  if (completeError) {
    console.error('FAIL: Failed to complete challenge via edge function:', completeError);
    if ((completeError as any).context) {
      try {
        const bodyText = await (completeError as any).context.text();
        console.error('Response Body:', bodyText);
      } catch (e) {
        console.error('Failed to read error response context text:', e);
      }
    }
    return;
  }

  if (!completeRes || !completeRes.success) {
    console.error('FAIL: complete-challenge response success is false:', completeRes);
    return;
  }
  console.log('PASS: complete-challenge Edge Function returned success:', completeRes, '\n');

  // 6. Verify row in Supabase alarm_completions
  console.log('[Database] Querying Supabase alarm_completions to verify attempts count and status...');
  const { data: updatedCompletions, error: finalError } = await supabase
    .from('alarm_completions')
    .select('*')
    .eq('alarm_id', alarmId)
    .eq('user_id', userId);

  if (finalError || !updatedCompletions || updatedCompletions.length === 0) {
    console.error('FAIL: Failed to fetch updated completion row', finalError);
    return;
  }

  const resultRow = updatedCompletions[0];
  console.log('Result Row details:');
  console.log(`  - ID: ${resultRow.id}`);
  console.log(`  - Alarm ID: ${resultRow.alarm_id}`);
  console.log(`  - User ID: ${resultRow.user_id}`);
  console.log(`  - Status: ${resultRow.status}`);
  console.log(`  - Attempts: ${resultRow.attempts}`);
  console.log(`  - Difficulty Saved: ${resultRow.challenge_difficulty}`);
  console.log(`  - Completed At: ${resultRow.completed_at}\n`);

  if (resultRow.status === 'completed' && resultRow.attempts === 3 && resultRow.challenge_difficulty === 'medium') {
    console.log('==================================================');
    console.log('SUCCESS: Supabase alarm_completions verified!');
    console.log('All QA verification checks passed successfully.');
    console.log('==================================================');
  } else {
    console.error('FAIL: Mismatch in alarm_completions row values.');
  }
}

runQA();
