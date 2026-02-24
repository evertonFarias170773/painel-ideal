import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vwbtitjlpelrcnsytzqw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnRpdGpscGVscmNuc3l0enF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzE5NTEsImV4cCI6MjA2NDU0Nzk1MX0.te1kg9RKJUQ-gBQ7YiXLDk-Ej8JMNcujIzIR-fTGR-o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectData() {
    try {
        console.log('--- view_fatu_diario_total ---');
        const { data: vfdt, error: err1 } = await supabase.from('view_fatu_diario_total').select('*').limit(2);
        if (err1) console.error(err1); else console.log(vfdt);

        console.log('--- view_fatu_diario_por_empresa ---');
        const { data: vfdpe, error: err2 } = await supabase.from('view_fatu_diario_por_empresa').select('*').limit(2);
        if (err2) console.error(err2); else console.log(vfdpe);

        console.log('--- pagamentos_v2 ---');
        const { data: pag, error: err3 } = await supabase.from('pagamentos_v2').select('*').limit(2);
        if (err3) console.error(err3); else console.log(pag);

        console.log('--- empresas ---');
        const { data: emp, error: err4 } = await supabase.from('empresas').select('*').limit(5);
        if (err4) console.error(err4); else console.log(emp);

    } catch (e) {
        console.error(e);
    }
}

inspectData();
