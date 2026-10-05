import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vebqvedmhfaebvdantiu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4qUcXYXNFDUc6UAw_nvpDw_M-9w3vuz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
