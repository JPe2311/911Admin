const fs = require('fs');
const lines = fs.readFileSync('prueba/ENERO_2026.csv', 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
function parseSemicolon(line) {
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '\"') { inQ = !inQ; continue; }
        if (c === ';' && !inQ) { cols.push(cur.trim()); cur = ''; }
        else cur += c;
    }
    cols.push(cur.trim());
    return cols;
}

let colIdx = { fecha: 0, intervalo: 1, abandonadas: 2, ofrecidas: 3, contestadas: 4, enCola: 5, avisandoAb: 6, avisando: 7, manejo: 8 };
let isNewFormat = false;
let headerFound = false;

lines.forEach((line) => {
    const cols = parseSemicolon(line);
    if (cols.length < 3) return;

    if (!headerFound && (cols.some(c => /intervalo/i.test(c)) || cols.some(c => /ofrec/i.test(c)))) {
        headerFound = true;
        if (cols.some(c => /intervalo/i.test(c))) {
            isNewFormat = true;
            cols.forEach((c, i) => {
                const h = c.toLowerCase().trim();
                if (h === 'fecha' || h.includes('fecha')) colIdx.fecha = i;
                if (h.includes('intervalo')) colIdx.intervalo = i;
                if (h === 'abandonadas') colIdx.abandonadas = i;
                if (h === 'ofrecidas' || (h.includes('ofrec') && !h.includes('abandon'))) colIdx.ofrecidas = i;
                if (h.includes('abandonadas contestadas') || h.includes('abandon') && h.includes('contest')) colIdx.contestadas = i;
                if (h.includes('en cola') || h.includes('cola')) colIdx.enCola = i;
                if (h.includes('abandonadas avisando') || (h.includes('abandon') && h.includes('avisan'))) colIdx.avisandoAb = i;
                if (h === 'avisando') colIdx.avisando = i;
                if (h === 'manejo' || h.includes('manejo')) colIdx.manejo = i;
            });
        }
        console.log('Headers detected! isNewFormat:', isNewFormat);
        console.log('colIdx:', colIdx);
        return;
    }
});
