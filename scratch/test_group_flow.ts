import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://giekeskbbgbjacpgoiar.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZWtlc2tiYmdiamFjcGdvaWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjU1MjAsImV4cCI6MjA5Njg0MTUyMH0._H4sV-Z-aBU2_PB4-MDSvrd1ayUOplHufSPzaNVJre4';

async function testGroupFlow() {
  console.log('==================================================');
  console.log('STARTING WAKEIT GROUP CREATION & JOIN FLOW INTEGRATION TEST');
  console.log('==================================================\n');

  const adminEmail = 'test_admin_715514@gmail.com';
  const adminPassword = 'Password123!';
  const memberEmail = 'wakeit_test_38284@gmail.com';
  const memberPassword = 'Password123!_38284';

  try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });
    const supabaseMember = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    // 1. Sign in Admin User
    console.log(`1. Signing in Admin User: ${adminEmail}...`);
    const { data: adminSignIn, error: adminSignInError } = await supabaseAdmin.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (adminSignInError || !adminSignIn.user) {
      throw new Error(`Admin sign in failed: ${adminSignInError?.message}`);
    }
    const adminId = adminSignIn.user.id;
    console.log(`   -> Admin signed in! User ID: ${adminId}`);

    // Clean up any old groups owned by the Admin first to prevent hitting limit
    console.log('   -> Cleaning up any previous test groups owned by Admin...');
    const { data: oldGroups } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('admin_id', adminId);

    if (oldGroups && oldGroups.length > 0) {
      const oldGroupIds = oldGroups.map(g => g.id);
      await supabaseAdmin.from('group_members').delete().in('group_id', oldGroupIds);
      await supabaseAdmin.from('groups').delete().in('id', oldGroupIds);
      console.log(`      Removed ${oldGroups.length} old group(s).`);
    }

    // 2. Admin calls create-group Edge Function
    const groupName = 'Alpha Team ' + Math.floor(Math.random() * 10000);
    const groupDesc = 'Discipline and accountability group';
    console.log(`2. Admin creating group "${groupName}" via Edge Function...`);
    const { data: createData, error: createError } = await supabaseAdmin.functions.invoke('create-group', {
      body: { name: groupName, description: groupDesc, default_sound_url: 'default_sound.mp3' }
    });

    if (createError || !createData?.success) {
      throw new Error(`Group creation Edge Function failed: ${createError?.message || createData?.error}`);
    }

    const { group_id, invite_code } = createData;
    console.log(`   -> Group created successfully!`);
    console.log(`   -> Group ID: ${group_id}`);
    console.log(`   -> Invite Code: ${invite_code}`);

    // 3. Verify Admin's Group database row
    console.log('3. Verifying group entry in "groups" table...');
    const { data: dbGroup, error: fetchGroupError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('id', group_id)
      .single();

    if (fetchGroupError || !dbGroup) {
      throw new Error(`Failed to fetch group from DB: ${fetchGroupError?.message}`);
    }

    console.log('   -> Group DB Row:', JSON.stringify(dbGroup, null, 2));
    const nameMatch = dbGroup.name === groupName;
    const inviteCodeMatch = dbGroup.invite_code === invite_code;
    const adminIdMatch = dbGroup.admin_id === adminId;

    console.log(`   - Group Name match: ${nameMatch ? 'PASS' : 'FAIL'}`);
    console.log(`   - Invite Code match: ${inviteCodeMatch ? 'PASS' : 'FAIL'}`);
    console.log(`   - Admin ID match: ${adminIdMatch ? 'PASS' : 'FAIL'}`);

    // 4. Verify Admin's Membership database row
    console.log('4. Verifying Admin membership entry in "group_members" table...');
    const { data: dbAdminMember, error: fetchAdminMemberError } = await supabaseAdmin
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('user_id', adminId)
      .single();

    if (fetchAdminMemberError || !dbAdminMember) {
      throw new Error(`Failed to fetch Admin membership: ${fetchAdminMemberError?.message}`);
    }

    console.log('   -> Admin Member DB Row:', JSON.stringify(dbAdminMember, null, 2));
    const memberActiveMatch = dbAdminMember.is_active === true;
    console.log(`   - Admin is_active is true: ${memberActiveMatch ? 'PASS' : 'FAIL'}`);

    // 5. Sign in Member User
    console.log(`5. Signing in Second User (Member): ${memberEmail}...`);
    const { data: memberSignIn, error: memberSignInError } = await supabaseMember.auth.signInWithPassword({
      email: memberEmail,
      password: memberPassword
    });

    if (memberSignInError || !memberSignIn.user) {
      throw new Error(`Member sign in failed: ${memberSignInError?.message}`);
    }
    const memberId = memberSignIn.user.id;
    console.log(`   -> Member signed in! User ID: ${memberId}`);

    // Clean up any old memberships for Member first
    await supabaseMember
      .from('group_members')
      .delete()
      .eq('user_id', memberId);

    // 6. Member calls join-group Edge Function using invite code
    console.log(`6. Member joining group via Edge Function using code "${invite_code}"...`);
    const { data: joinData, error: joinError } = await supabaseMember.functions.invoke('join-group', {
      body: { invite_code }
    });

    if (joinError || !joinData?.success) {
      throw new Error(`Group join Edge Function failed: ${joinError?.message || joinData?.error}`);
    }

    console.log(`   -> Group joined successfully! Returned:`, JSON.stringify(joinData));

    // 7. Verify Member's Membership database row
    console.log('7. Verifying Member membership entry in "group_members" table...');
    const { data: dbUserMember, error: fetchUserMemberError } = await supabaseMember
      .from('group_members')
      .select('*')
      .eq('group_id', group_id)
      .eq('user_id', memberId)
      .single();

    if (fetchUserMemberError || !dbUserMember) {
      throw new Error(`Failed to fetch Member membership: ${fetchUserMemberError?.message}`);
    }

    console.log('   -> Member DB Row:', JSON.stringify(dbUserMember, null, 2));
    const userMemberActiveMatch = dbUserMember.is_active === true;
    console.log(`   - Member is_active is true: ${userMemberActiveMatch ? 'PASS' : 'FAIL'}`);

    // 8. Verify updated Group member count
    console.log('8. Verifying updated group member count...');
    const { data: dbGroupUpdated, error: fetchGroupUpdatedError } = await supabaseAdmin
      .from('groups')
      .select('member_count')
      .eq('id', group_id)
      .single();

    if (fetchGroupUpdatedError || !dbGroupUpdated) {
      throw new Error(`Failed to fetch updated group member count: ${fetchGroupUpdatedError?.message}`);
    }

    console.log(`   -> Updated member count: ${dbGroupUpdated.member_count}`);
    const memberCountMatch = dbGroupUpdated.member_count === 2;
    console.log(`   - member_count is 2 (Admin + Member): ${memberCountMatch ? 'PASS' : 'FAIL'}`);

    // Clean up created group (soft or hard delete) to avoid cluttering DB
    console.log('9. Cleaning up test data (hard deleting group & members)...');
    await supabaseAdmin.from('group_members').delete().eq('group_id', group_id);
    await supabaseAdmin.from('groups').delete().eq('id', group_id);
    console.log('   -> Cleanup complete.');

    const allPassed = nameMatch && inviteCodeMatch && adminIdMatch && memberActiveMatch && userMemberActiveMatch && memberCountMatch;

    console.log('\n==================================================');
    if (allPassed) {
      console.log('TEST RESULT: ALL GROUP FLOW VALIDATION CHECKS PASSED!');
    } else {
      throw new Error('TEST RESULT: SOME VALIDATION CHECKS FAILED!');
    }
    console.log('==================================================');

  } catch (err: any) {
    console.error(`\nTEST FAILED: ${err.message}`);
    throw err;
  }
}

testGroupFlow();
