// Human authentication uses Supabase Auth, never an agent credential or owner ID.
function requireClient(client) {
 if (!client?.auth) throw Error('Sign-in is still loading. Please try again.');
 return client.auth;
}
export async function passwordSignIn(client, email, password) {
 const {error}=await requireClient(client).signInWithPassword({email:email.trim(),password});
 if(error)throw Error('Could not sign in. Check your email and password, or choose Set or reset password.');
}
export async function requestPasswordSetup(client,email,redirectTo) {
 const {error}=await requireClient(client).resetPasswordForEmail(email.trim(),{redirectTo});
 if(error)throw Error('Could not send the password link. Please try again in a few minutes.');
}
export async function savePassword(client,password,confirmation) {
 if(password.length<8)throw Error('Use at least 8 characters for your password.');
 if(password!==confirmation)throw Error('The passwords do not match. Please try again.');
 const {error}=await requireClient(client).updateUser({password});
 if(error)throw Error('Could not save your password. Try a different password or request a new setup link.');
}
