import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {withGatewayCors} from '../agent-gateway/cors.mjs';
import {createResetHandler} from './handler.mjs';
// Deploy with platform JWT verification disabled, like agent-gateway. Every
// request is authenticated with getUser; opaque agent credentials are rejected.
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(withGatewayCors(createResetHandler(admin)));
