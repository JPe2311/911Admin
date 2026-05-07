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
const monthNum = 1;

const dailyData = {};
const hourlyData = [];
let count = 0;

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
                if (h.includes('abandonadas contestadas') || (h.includes('abandon') && h.includes('contest'))) colIdx.contestadas = i;
                if (h.includes('en cola') || h.includes('cola')) colIdx.enCola = i;
                if (h.includes('abandonadas avisando') || (h.includes('abandon') && h.includes('avisan'))) colIdx.avisandoAb = i;
                if (h === 'avisando') colIdx.avisando = i;
                if (h === 'manejo' || h.includes('manejo')) colIdx.manejo = i;
            });
        }
        return;
    }

    const fechaRaw = (cols[colIdx.fecha] || '').trim();
    if (!fechaRaw) return;

    let ofrec, contest, aband;
    if (isNewFormat) {
        ofrec = parseInt(cols[colIdx.ofrecidas]) || 0;
        contest = parseInt(cols[colIdx.contestadas]) || 0;
        aband = parseInt(cols[colIdx.abandonadas]) || 0;
    }

    if (!ofrec && !contest && !aband) return;

    const dateParts = fechaRaw.split(/[\/-]/);
    let dayNum = 0;
    if (dateParts.length >= 2) {
        const p0 = parseInt(dateParts[0]);
        const p1 = parseInt(dateParts[1]);
        if (p1 === monthNum) dayNum = p0;
        else if (p0 === monthNum) dayNum = p1;
        else dayNum = p0;
    }

    let hour = 0;
    const intervaloRaw = (cols[colIdx.intervalo] || '').trim();
    const hourMatch = intervaloRaw.match(/(\d{1,2}):\d{2}\s*-/);
    if (hourMatch) {
        hour = parseInt(hourMatch[1]);
    } else {
        const simpleH = intervaloRaw.match(/(\d{1,2})/);
        if (simpleH) hour = parseInt(simpleH[1]);
    }

    if (dayNum >= 1 && dayNum <= 31) {
        count++;
        if (!dailyData[dayNum]) dailyData[dayNum] = { d: dayNum, ofrecidas: 0, contestadas: 0, abandonadas: 0 };
        dailyData[dayNum].ofrecidas += ofrec;
        dailyData[dayNum].contestadas += contest;
        dailyData[dayNum].abandonadas += aband;
    }
});
console.log('Parsed rows:', count);
console.log('Daily Data sample:', Object.values(dailyData).slice(0, 2));
