/** Receives an authenticated supabase-js client. Never pass a service-role client here. */
export function createBackend(client) {
  async function result(request) {
    const { data, error } = await request;
    if (error) throw error;
    return data;
  }
  async function owner() {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Sign in required');
    return data.user.id;
  }
  const owned = async (table, fields, conflict) => result(client.from(table).upsert(
    { ...fields, user_id: await owner() }, { onConflict: conflict }).select().single());
  return {
    signIn(email, redirectTo) {
      return result(client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }));
    },
    signOut() { return result(client.auth.signOut()); },
    async loadWorkspace() {
      const userId = await owner();
      const tables = ['profiles','preferences','resumes','answer_library','job_batches','applications'];
      const rows = await Promise.all(tables.map(t => result(client.from(t).select('*').eq('user_id',userId))));
      return Object.fromEntries(tables.map((t,i) => [t,rows[i]]));
    },
    saveProfile(facts, verified = false) {
      return owned('profiles',{facts,verified_at:verified ? new Date().toISOString() : null,updated_at:new Date().toISOString()},'user_id');
    },
    savePreferences({search={},tierLists=[],activeTierListId=null,theme={pack:'base'}}) {
      return owned('preferences',{search,tier_lists:tierLists,active_tier_list_id:activeTierListId,theme,updated_at:new Date().toISOString()},'user_id');
    },
    async uploadResume(file,{name,variant='Master',version=1}) {
      const userId = await owner();
      const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx' : null;
      if (!extension || file.size > 10485760) throw new Error('Use PDF or DOCX, up to 10 MB');
      const id = crypto.randomUUID();
      const path = `${userId}/${id}.${extension}`;
      await result(client.storage.from('resumes').upload(path,file,{contentType:file.type,upsert:false}));
      try {
        return await owned('resumes',{id,name,variant,version,object_path:path},'id');
      } catch (error) {
        await client.storage.from('resumes').remove([path]);
        throw error;
      }
    },
    resumeLink(path) { return result(client.storage.from('resumes').createSignedUrl(path,60)); },
    async getBatch(id) {
      const userId = await owner();
      const batch = await result(client.from('job_batches').select('*').eq('id',id).eq('user_id',userId).single());
      const items = await result(client.from('batch_items').select('*,jobs(*)').eq('batch_id',id).eq('user_id',userId).order('position'));
      return {batch,items};
    },
    async saveDraft(id,expectedRevision,draft,blocker=null) {
      const userId = await owner();
      return result(client.from('applications').update({draft,blocker}).eq('id',id).eq('user_id',userId).eq('revision',expectedRevision).select().single());
    },
    approve(id,expectedRevision) {
      return result(client.rpc('approve_application',{application_id:id,expected_revision:expectedRevision}));
    },
    async setLeaderboard(alias,optedIn) {
      const userId = await owner();
      const existing = await result(client.from('leaderboard_entries').select('user_id').eq('user_id',userId).maybeSingle());
      return result(existing
        ? client.from('leaderboard_entries').update({alias,opted_in:optedIn}).eq('user_id',userId).select().single()
        : client.from('leaderboard_entries').insert({user_id:userId,alias,opted_in:optedIn}).select().single());
    },
  };
}
