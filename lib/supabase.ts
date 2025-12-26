
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bsywyxrzkrkcvhejoeds.supabase.co';
const supabaseKey = 'sb_publishable_Cjn1NY9LfSqTi3r_BV6B8Q_PA22WFcL';

export const supabase = createClient(supabaseUrl, supabaseKey);
