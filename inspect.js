const url = 'https://vwbtitjlpelrcnsytzqw.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3YnRpdGpscGVscmNuc3l0enF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzE5NTEsImV4cCI6MjA2NDU0Nzk1MX0.te1kg9RKJUQ-gBQ7YiXLDk-Ej8JMNcujIzIR-fTGR-o';

fetch(url)
    .then(res => res.json())
    .then(data => {
        console.log(JSON.stringify(Object.keys(data.definitions || {}).map(k => ({
            name: k,
            columns: Object.keys(data.definitions[k].properties || {})
        })), null, 2));
    })
    .catch(err => console.error(err));
