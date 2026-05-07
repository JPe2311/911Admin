// SISTEMA DE CAPACITACIONES 911 - ADMIN CON FIREBASE
var C = { navy: "#0f2444", blue: "#1B3A6B", mid: "#2E5FA3", light: "#D6E4F0", green: "#16a34a", greenBg: "#D1FAE5", red: "#dc2626", redBg: "#FEE2E2", gray: "#64748b", border: "#e2e8f0", bg: "#f0f4f8", card: "#ffffff", orange: "#ea580c" };

var db = null;
var auth = null;
var currentUser = null;
var currentUserData = null;

var ROLES = {
    PERSONAL: "personal",
    RECURSOS: "recursos",
    CAPACITACION: "capacitacion",
    GESTION: "gestion"
};

// ============================================
// FIREBASE INIT
// ============================================
async function initFirebase() {
    if (!window.FIREBASE_CONFIG?.apiKey) {
        console.error("Firebase config missing");
        return false;
    }
    try {
        const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        
        window.firebase = { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc };
        
        const app = getApps().length === 0 ? initializeApp(window.FIREBASE_CONFIG) : getApps()[0];
        db = getFirestore(app);
        auth = getAuth(app);
        
        console.log("Firebase initialized");
        return true;
    } catch(e) {
        console.error("Firebase error:", e);
        return false;
    }
}

// ============================================
// FIRESTORE HELPERS
// ============================================
async function getCollection(name) {
    if (!db) return [];
    try {
        const { getDocs, collection } = window.firebase;
        const snap = await getDocs(collection(db, name));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
        console.error("Error getting " + name, e);
        return [];
    }
}

async function getDocById(coll, id) {
    if (!db) return null;
    try {
        const { getDoc, doc } = window.firebase;
        const d = await getDoc(doc(db, coll, id));
        return d.exists() ? { id: d.id, ...d.data() } : null;
    } catch(e) {
        return null;
    }
}

async function saveDoc(coll, id, data) {
    if (!db) return;
    try {
        const { setDoc, doc } = window.firebase;
        await setDoc(doc(db, coll, id), data, { merge: true });
    } catch(e) {
        console.error("Error saving", e);
    }
}

async function deleteDocById(coll, id) {
    if (!db) return;
    try {
        const { deleteDoc, doc } = window.firebase;
        await deleteDoc(doc(db, coll, id));
    } catch(e) {
        console.error("Error deleting", e);
    }
}

// ============================================
// PERSONAL
// ============================================
async function getPersonalDB() { return await getCollection('personal'); }
async function getPersonalByIdDB(dni) { return await getDocById('personal', dni); }

async function addOrUpdatePersonalDB(emp) {
    var ahora = new Date().toISOString();
    var data = { ...emp, updatedAt: ahora };
    var existe = await getPersonalByIdDB(emp.dni);
    if (!existe) {
        data.createdAt = ahora;
        data.estado = "activo";
    }
    await saveDoc('personal', emp.dni, data);
    return data;
}

async function deletePersonalDB(dni) {
    await deleteDocById('personal', dni);
}

async function getCapacitacionesDelEmpleadoDB(dni) {
    var asists = await getCollection('asistencias');
    var caps = await getCollection('capacitaciones');
    return asists
        .filter(a => a.dni === dni)
        .map(a => {
            var cap = caps.find(c => c.id === a.capacitacionId);
            return cap ? { id: cap.id, titulo: cap.titulo, tema: cap.temaPrincipal, fecha: cap.fechaDictado, tipo: cap.tipo, presente: a.presente } : null;
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
}

// ============================================
// CAPACITACIONES
// ============================================
async function getCapacitacionesDB() { return await getCollection('capacitaciones'); }

async function addCapacitacionDB(cap) {
    var id = "CAP_" + Date.now().toString(36);
    var data = { ...cap, id, createdAt: new Date().toISOString(), estado: "activa" };
    await saveDoc('capacitaciones', id, data);
    return data;
}

async function deleteCapacitacionDB(id) {
    await deleteDocById('capacitaciones', id);
}

async function getAsistenciasDB() { return await getCollection('asistencias'); }

async function agregarAsistentesDB(capId, dnis) {
    var personal = await getPersonalDB();
    var list = await getAsistenciasDB();
    var agregados = 0, errores = [];
    
    for (var dni of dnis) {
        var emp = personal.find(e => e.dni === dni);
        if (!emp) { errores.push(dni); continue; }
        
        var ya = list.find(a => a.capacitacionId === capId && a.dni === dni);
        if (ya) continue;
        
        var id = "ASIST_" + Date.now().toString(36) + Math.random().toString(36).substr(2,4);
        await saveDoc('asistencias', id, {
            id, capacitacionId: capId, dni: emp.dni, nombre: emp.nombre,
            jerarquia: emp.jerarquia, dependencia: emp.dependencia,
            presente: true, fecha: new Date().toISOString()
        });
        agregados++;
    }
    return { agregados, errores };
}

async function getAsistentesCapDB(capId) {
    var list = await getAsistenciasDB();
    return list.filter(a => a.capacitacionId === capId);
}

// ============================================
// USUARIOS
// ============================================
async function getUsuariosDB() { return await getCollection('usuarios'); }

async function getUsuarioByEmailDB(email) {
    var list = await getUsuariosDB();
    return list.find(u => u.email === email);
}

async function addUsuarioDB(email, rol, nombre) {
    var usu = await getUsuarioByEmailDB(email);
    var data = { email, nombre, rol, updatedAt: new Date().toISOString() };
    if (!usu) data.createdAt = new Date().toISOString();
    await saveDoc('usuarios', email, data);
}

async function deleteUsuarioDB(email) {
    await deleteDocById('usuarios', email);
}

function tieneAccesoDB(seccion) {
    if (!currentUserData) return false;
    if (currentUserData.rol === ROLES.GESTION) return true;
    if (currentUserData.rol === ROLES.PERSONAL) return seccion === "personal";
    if (currentUserData.rol === ROLES.CAPACITACION) return seccion === "capacitaciones";
    if (currentUserData.rol === ROLES.RECURSOS) return seccion === "personal" || seccion === "capacitaciones";
    return false;
}

function puedeAdminDB() {
    return currentUserData && currentUserData.rol === ROLES.GESTION;
}

// ============================================
// ESTRUCTURA
// ============================================
async function getEstructuraDB() {
    var list = await getCollection('estructura');
    if (!list.length) {
        var inicial = [
            { id: "dg", nombre: "Dirección General", nivel: 1, padre: "" },
            { id: "d1", nombre: "Dirección Operaciones", nivel: 2, padre: "dg" },
            { id: "d2", nombre: "Dirección Administración", nivel: 2, padre: "dg" },
            { id: "d3", nombre: "Dirección RRHH", nivel: 2, padre: "dg" },
            { id: "dept1", nombre: "Departamento Despacho", nivel: 3, padre: "d1" },
            { id: "dept2", nombre: "Departamento Investigación", nivel: 3, padre: "d1" },
            { id: "div1", nombre: "División Central", nivel: 4, padre: "dept1" },
            { id: "div2", nombre: "División Norte", nivel: 4, padre: "dept1" },
            { id: "div3", nombre: "División Sur", nivel: 4, padre: "dept1" }
        ];
        for (var e of inicial) await saveDoc('estructura', e.id, e);
        return inicial;
    }
    return list;
}

async function addEstructuraDB(id, nombre, nivel, padre) {
    await saveDoc('estructura', id, { id, nombre, nivel, padre });
}

async function deleteEstructuraDB(id) {
    var list = await getCollection('estructura');
    var hijos = list.filter(e => e.padre === id);
    for (var h of hijos) await deleteEstructuraDB(h.id);
    await deleteDocById('estructura', id);
}

function getNombrePorIdDB(id, estructura) {
    var e = estructura.find(x => x.id === id);
    return e ? e.nombre : (id || "");
}

function getJerarquiasDB(personal) {
    var set = new Set();
    personal.forEach(p => { if (p.jerarquia) set.add(p.jerarquia); });
    var arr = Array.from(set).sort();
    return arr.length ? arr : ["Oficial", "Suboficial", "Agente", "Sgte.", "Cgto.", "Sarg.", "Tte.", "Cap.", "Mayor", "Cmte."];
}

// ============================================
// IMPORTAR PERSONAL CSV
// ============================================
async function importarPersonalCSVDB(content) {
    var lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var imported = [];
    lines.forEach((line, i) => {
        if (!line.trim()) return;
        if (i === 0 && line.toLowerCase().indexOf("dni") !== -1) return;
        var cols = line.split(";").map(c => c.trim());
        if (cols.length < 2 || !cols[0]) return;
        var dni = cols[0].replace(/[^0-9]/g, "");
        if (dni.length < 7) return;
        imported.push({ dni, nombre: cols[1] || "", jerarquia: cols[2] || "", dependencia: cols[3] || "" });
    });
    var agregados = 0, actualizados = 0;
    var personal = await getPersonalDB();
    for (var emp of imported) {
        var existe = personal.find(e => e.dni === emp.dni);
        await addOrUpdatePersonalDB(emp);
        if (existe) actualizados++; else agregados++;
    }
    return { agregados, actualizados };
}

// ============================================
// ESTADISTICAS
// ============================================
async function getEstadisticasDB() {
    var caps = await getCapacitacionesDB();
    var asists = await getAsistenciasDB();
    var personal = await getPersonalDB();
    
    var porTipo = {}, porMes = {}, totalAsistentes = 0;
    
    caps.forEach(cap => {
        var cant = asists.filter(a => a.capacitacionId === cap.id).length;
        totalAsistentes += cant;
        var tipo = cap.tipo || "unica";
        porTipo[tipo] = (porTipo[tipo] || 0) + cant;
        if (cap.fechaDictado) {
            var mes = cap.fechaDictado.substring(0, 7);
            porMes[mes] = (porMes[mes] || 0) + cant;
        }
    });
    
    return { totalCaps: caps.length, totalAsistentes, porTipo, porMes, totalPersonal: personal.length };
}

// ============================================
// RENDER DASHBOARD
// ============================================
function renderDashboard(container) {
    getEstadisticasDB().then(stats => {
        var html = '<div style="padding:20">' +
            '<div style="background:linear-gradient(135deg,' + C.navy + ',' + C.blue + ');border-radius:16px;padding:32px;margin-bottom:24px;color:#fff">' +
            '<h1 style="font-size:32px;font-weight:950">911 - Admin Gestión General</h1>' +
            '<div style="font-size:14px;opacity:0.8;margin-top:8px">' + stats.totalPersonal + ' personal • ' + stats.totalCaps + ' capacitaciones • ' + stats.totalAsistentes + ' inscripciones</div></div>' +
            
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">' +
            '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Personal Total</div><div style="font-size:32px;font-weight:900;color:' + C.blue + '">' + stats.totalPersonal + '</div></div>' +
            '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Capacitaciones</div><div style="font-size:32px;font-weight:900;color:' + C.green + '">' + stats.totalCaps + '</div></div>' +
            '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Asistencias Totales</div><div style="font-size:32px;font-weight:900;color:' + C.orange + '">' + stats.totalAsistentes + '</div></div>' +
            '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Promedio/Cap</div><div style="font-size:32px;font-weight:900;color:' + C.mid + '">' + (stats.totalCaps ? Math.round(stats.totalAsistentes / stats.totalCaps) : 0) + '</div></div>' +
            '</div>' +
            
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
            '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><h3 style="font-size:14px;font-weight:800;color:' + C.navy + ';margin-bottom:16px">Por Tipo de Capacitación</h3>';
        
        Object.keys(stats.porTipo).forEach(k => {
            var cant = stats.porTipo[k];
            var pct = Math.round((cant / stats.totalAsistentes) * 100);
            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ' + C.border + '"><span style="text-transform:capitalize">' + k + '</span><span style="font-weight:700">' + cant + ' (' + pct + '%)</span></div>';
        });
        html += '</div>' +
            
            '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><h3 style="font-size:14px;font-weight:800;color:' + C.navy + ';margin-bottom:16px">Por Mes</h3>';
        var meses = Object.keys(stats.porMes).sort().reverse().slice(0,6);
        meses.reverse().forEach(m => {
            html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ' + C.border + '"><span>' + m + '</span><span style="font-weight:700">' + stats.porMes[m] + '</span></div>';
        });
        html += '</div></div></div>';
        
        container.innerHTML = html;
    });
}

// ============================================
// RENDER PERSONAL
// ============================================
async function renderPersonal(container) {
    if (!tieneAccesoDB("personal")) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:' + C.gray + '">No tenés acceso a Personal</div>';
        return;
    }
    
    var pers = await getPersonalDB();
    var estruct = await getEstructuraDB();
    var nivel4 = estruct.filter(e => e.nivel === 4);
    var puedeEditar = tieneAccesoDB("personal");
    
    var filterJer = '<select id="filtro-jer" onchange="filtrarPersonal()" style="padding:10px;border-radius:8px;border:1px solid ' + C.border + ';width:100%"><option value="">Todas las Jerarquías</option>';
    var jerarquias = getJerarquiasDB(pers);
    jerarquias.forEach(j => { filterJer += '<option value="' + j + '">' + j + '</option>'; });
    filterJer += '</select>';
    
    var filterDiv = '<select id="filtro-div" onchange="filtrarPersonal()" style="padding:10px;border-radius:8px;border:1px solid ' + C.border + ';width:100%"><option value="">Todas las Divisiones</option>';
    nivel4.forEach(e => { filterDiv += '<option value="' + e.id + '">' + e.nombre + '</option>'; });
    filterDiv += '</select>';
    
    var html = '<div style="padding:20">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:24px;align-items:center">' +
        '<div><h1 style="font-size:28px;font-weight:950;color:' + C.navy + '">Personal</h1><div style="font-size:13px;color:' + C.gray + '">' + pers.length + ' empleados</div></div>' +
        '<div style="display:flex;gap:8px">' +
        (puedeEditar ? '<button onclick="document.getElementById(\'file-csv\').click()" style="background:' + C.bg + ';color:' + C.navy + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer">📥 Importar</button>' : '') +
        '<input type="file" accept=".csv" id="file-csv" style="display:none" onchange="handleImportCSV(this.files[0])">' +
        '<button onclick="exportarPersonal()" style="background:' + C.bg + ';color:' + C.navy + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer">📤 Exportar</button>' +
        (puedeEditar ? '<button onclick="openModalAgregar()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer">➕ Agregar</button>' : '') +
        '</div></div>' +
        
        '<div style="border:2px dashed ' + C.border + ';border-radius:12px;padding:24px;text-align:center;background:' + C.bg + ';margin-bottom:20px" ondrop="dropCSV(event)" ondragover="this.style.borderColor=\'' + C.blue + '\'" ondragleave="this.style.borderColor=\'' + C.border + '\'" onclick="document.getElementById(\'file-csv\').click()">' +
        '<div style="font-size:20px;margin-bottom:4px">📂</div>' +
        '<div style="font-size:12px;color:' + C.gray + '">Arrastrá archivo CSV o hacé clic para importar</div>' +
        '</div>' +
        
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">' +
        '<div><input type="text" id="buscar-nombre" placeholder="Buscar por nombre..." onkeyup="filtrarPersonal()" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
        '<div>' + filterJer + '</div>' +
        '<div>' + filterDiv + '</div>' +
        '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;overflow:hidden;max-height:60vh;overflow-y:auto">' +
        '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:' + C.bg + '"><th style="padding:12px;text-align:left;font-size:11px">DNI</th><th style="padding:12px;text-align:left;font-size:11px">Nombre</th><th style="padding:12px;text-align:left;font-size:11px">Jerarquía</th><th style="padding:12px;text-align:left;font-size:11px">División</th><th style="padding:12px;text-align:left;font-size:11px">Caps</th><th style="padding:12px;text-align:right;font-size:11px">Acción</th></tr></thead>' +
        '<tbody id="tabla-personal">';
    
    for (var p of pers.slice(0, 50)) {
        var capsCount = (await getCapacitacionesDelEmpleadoDB(p.dni)).length;
        html += '<tr style="border-bottom:1px solid ' + C.border + '"><td style="padding:12px;font-family:monospace">' + p.dni + '</td><td style="padding:12px;font-weight:600"><a href="#" onclick="verPerfil(\'' + p.dni + '\')" style="color:' + C.navy + ';text-decoration:none">' + p.nombre + '</a></td><td style="padding:12px">' + (p.jerarquia||"") + '</td><td style="padding:12px">' + getNombrePorIdDB(p.dependencia, estruct) + '</td><td style="padding:12px"><span style="background:' + (capsCount > 0 ? C.greenBg : C.bg) + ';padding:4px 8px;border-radius:4px;font-size:11px;color:' + (capsCount > 0 ? C.green : C.gray) + '">' + capsCount + '</span></td><td style="padding:12px;text-align:right"><button onclick="verPerfil(\'' + p.dni + '\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">Ver Perfil</button></td></tr>';
    }
    
    html += '</tbody></table></div></div>';
    container.innerHTML = html;
    window.personalActual = pers;
}

async function filtrarPersonal() {
    var nombre = document.getElementById("buscar-nombre").value.toLowerCase();
    var jer = document.getElementById("filtro-jer").value;
    var div = document.getElementById("filtro-div").value;
    
    var pers = await getPersonalDB();
    var estruct = await getEstructuraDB();
    var filtrado = pers.filter(p => {
        if (nombre && p.nombre.toLowerCase().indexOf(nombre) === -1) return false;
        if (jer && p.jerarquia !== jer) return false;
        if (div && p.dependencia !== div) return false;
        return true;
    });
    
    var html = filtrado.slice(0, 50).map(p => '<tr style="border-bottom:1px solid ' + C.border + '"><td style="padding:12px;font-family:monospace">' + p.dni + '</td><td style="padding:12px;font-weight:600"><a href="#" onclick="verPerfil(\'' + p.dni + '\')" style="color:' + C.navy + ';text-decoration:none">' + p.nombre + '</a></td><td style="padding:12px">' + (p.jerarquia||"") + '</td><td style="padding:12px">' + getNombrePorIdDB(p.dependencia, estruct) + '</td><td style="padding:12px">-</td><td style="padding:12px;text-align:right"><button onclick="verPerfil(\'' + p.dni + '\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">Ver Perfil</button></td></tr>').join("");
    
    var tbody = document.getElementById("tabla-personal");
    if (tbody) tbody.innerHTML = html;
}

// ============================================
// RENDER CAPACITACIONES
// ============================================
async function renderCapacitaciones(container) {
    if (!tieneAccesoDB("capacitaciones")) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:' + C.gray + '">No tenés acceso a Capacitaciones</div>';
        return;
    }
    
    var caps = await getCapacitacionesDB();
    var asists = await getAsistenciasDB();
    var puedeEditar = tieneAccesoDB("capacitaciones");
    
    var html = '<div style="padding:20">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:24px;align-items:center">' +
        '<div><h1 style="font-size:28px;font-weight:950;color:' + C.navy + '">Capacitaciones</h1><div style="font-size:13px;color:' + C.gray + '">' + caps.length + ' registradas</div></div>' +
        (puedeEditar ? '<button onclick="openModalCapacitacion()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">➕ Nueva Capacitación</button>' : '') +
        '</div>';
    
    if (caps.length === 0) {
        html += '<div style="background:' + C.card + ';border-radius:14px;padding:40px;text-align:center;color:' + C.gray + '">No hay capacitaciones</div>';
    } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">';
        for (var cap of caps) {
            var cant = asists.filter(a => a.capacitacionId === cap.id).length;
            html += '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                '<div style="flex:1"><h3 style="font-size:16px;font-weight:900;color:' + C.navy + '">' + cap.titulo + '</h3>' +
                '<div style="font-size:12px;color:' + C.mid + ';margin-top:4px">' + (cap.temaPrincipal||"") + '</div></div>' +
                '<span style="background:' + (cap.tipo === "multiple" ? C.orange : C.green) + ';color:#fff;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700">' + (cap.tipo === "multiple" ? "MÚLTIPLE" : "ÚNICA") + '</span></div>' +
                '<div style="font-size:12px;color:' + C.gray + ';margin-top:12px">' + 
                '<span style="background:' + C.light + ';padding:4px 8px;border-radius:4px;margin-right:8px">' + (cap.fechaDictado||"") + '</span>' +
                '<span style="background:' + C.greenBg + ';padding:4px 8px;border-radius:4px;color:' + C.green + ';font-weight:700">' + cant + ' asistentes</span></div>' +
                '<div style="margin-top:12px"><button onclick="verCapacitacion(\'' + cap.id + '\')" style="width:100%;background:' + C.mid + ';color:#fff;border:none;border-radius:6px;padding:10px;font-size:12px;cursor:pointer">Ver Detalle</button></div></div>';
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// PERFIL
// ============================================
async function verPerfil(dni) {
    var emp = await getPersonalByIdDB(dni);
    if (!emp) { alert("No encontrado"); return; }
    var caps = await getCapacitacionesDelEmpleadoDB(dni);
    var estruct = await getEstructuraDB();
    
    var m = document.getElementById("modal-perfil");
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-perfil";
        m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
        m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:0;width:750px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column"></div>';
        document.body.appendChild(m);
    }
    
    window.perfilDniActual = dni;
    
    var html = '<div style="background:' + C.navy + ';padding:24px 32px;border-radius:16px 16px 0 0;color:#fff">' +
        '<h2 style="font-size:24px;font-weight:900;margin:0">' + emp.nombre + '</h2>' +
        '<div style="font-size:13px;opacity:0.8;margin-top:4px">' + emp.dni + ' • ' + (emp.jerarquia||"Sin jerarquía") + '</div>' +
        '<div style="font-size:12px;opacity:0.7;margin-top:4px">' + getNombrePorIdDB(emp.dependencia, estruct) + '</div></div>' +
        
        '<div id="contenido-solapa" style="padding:24px;overflow-y:auto;flex:1"></div>' +
        
        '<div style="padding:16px;border-top:1px solid ' + C.border + ';text-align:right"><button onclick="closeModal(\'modal-perfil\')" style="padding:10px 24px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cerrar</button></div>';
    
    m.querySelector("div").innerHTML = html;
    m.style.display = "flex";
    
    var div = document.getElementById("contenido-solapa");
    var htmlPerfil = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
        '<div><h4 style="font-size:12px;color:' + C.gray + ';text-transform:uppercase;margin-bottom:8px">Datos Personales</h4>' +
        '<div style="background:' + C.bg + ';padding:16px;border-radius:8px">' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">DNI</div><div style="font-weight:700;font-size:16px;font-family:monospace">' + emp.dni + '</div></div>' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">Nombre Completo</div><div style="font-weight:700">' + emp.nombre + '</div></div>' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">Jerarquía</div><div style="font-weight:700">' + (emp.jerarquia || "No asignada") + '</div></div>' +
        '<div><div style="font-size:11px;color:' + C.gray + '">Estado</div><div style="font-weight:700;color:' + C.green + '">' + (emp.estado || "activo").toUpperCase() + '</div></div>' +
        '</div></div>' +
        
        '<div><h4 style="font-size:12px;color:' + C.gray + ';text-transform:uppercase;margin-bottom:8px">Capacitaciones (' + caps.length + ')</h4>' +
        '<div style="background:' + C.bg + ';padding:16px;border-radius:8px;max-height:300px;overflow-y:auto">';
    
    if (caps.length === 0) {
        htmlPerfil += '<div style="color:' + C.gray + ';text-align:center;padding:20px">Sin capacitaciones</div>';
    } else {
        caps.forEach(c => {
            htmlPerfil += '<div style="padding:8px;border-bottom:1px solid ' + C.border + '"><div style="font-weight:600">' + c.titulo + '</div><div style="font-size:11px;color:' + C.gray + '">' + (c.fecha || "") + ' • ' + c.tipo + '</div></div>';
        });
    }
    htmlPerfil += '</div></div></div>';
    
    div.innerHTML = htmlPerfil;
}

// ============================================
// MODALES
// ============================================
async function openModalAgregar() {
    var estruct = await getEstructuraDB();
    var nivel4 = estruct.filter(e => e.nivel === 4);
    var optsD = nivel4.map(e => '<option value="' + e.id + '">' + e.nombre + '</option>').join("");
    var optsJ = ["Oficial", "Suboficial", "Agente", "Sgte.", "Cgto.", "Sarg.", "Tte.", "Cap.", "Mayor", "Cmte."].map(j => '<option value="' + j + '">' + j + '</option>').join("");
    
    var m = document.getElementById("modal-agregar");
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-agregar";
        m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;overflow:auto";
        m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:32px;width:450px;max-height:90vh;overflow:auto">' +
            '<h2 style="font-size:20px;font-weight:900;color:' + C.navy + ';margin-bottom:20px">Agregar Empleado</h2>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">DNI *</label><input id="emp-dni" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Nombre *</label><input id="emp-nombre" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Jerarquía</label><select id="emp-jerarquia" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"><option value="">-- Seleccionar --</option>' + optsJ + '</select></div>' +
            '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">División *</label><select id="emp-division" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"><option value="">-- Seleccionar --</option>' + optsD + '</select></div>' +
            '<div style="display:flex;gap:12px;margin-top:20px">' +
            '<button onclick="closeModal(\'modal-agregar\')" style="flex:1;padding:12px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cancelar</button>' +
            '<button onclick="guardarEmpleado()" style="flex:1;padding:12px;border-radius:8px;border:none;background:' + C.blue + ';color:#fff;cursor:pointer;font-weight:700">Guardar</button>' +
            '</div></div>';
        document.body.appendChild(m);
    } else {
        m.style.display = "flex";
    }
}

async function guardarEmpleado() {
    var dni = document.getElementById("emp-dni").value;
    var nombre = document.getElementById("emp-nombre").value;
    var jerarquia = document.getElementById("emp-jerarquia").value;
    var division = document.getElementById("emp-division").value;
    
    if (!dni || !nombre || !division) { alert("DNI, Nombre y División son req."); return; }
    await addOrUpdatePersonalDB({ dni, nombre, jerarquia, dependencia: division, estado: "activo" });
    closeModal("modal-agregar");
    renderPersonal(document.getElementById("main"));
    alert("Empleado guardado");
}

function openModalCapacitacion() {
    var m = document.getElementById("modal-cap");
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-cap";
        m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
        m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:32px;width:450px">' +
            '<h2 style="font-size:20px;font-weight:900;color:' + C.navy + ';margin-bottom:20px">Nueva Capacitación</h2>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Título *</label><input id="cap-titulo" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Tema Principal</label><input id="cap-tema" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Fecha *</label><input id="cap-fecha" type="date" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Tipo</label><select id="cap-tipo" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"><option value="unica">Clase única</option><option value="multiple">Curso de múltiples clases</option></select></div>' +
            '<div style="display:flex;gap:12px;margin-top:20px">' +
            '<button onclick="closeModal(\'modal-cap\')" style="flex:1;padding:12px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cancelar</button>' +
            '<button onclick="guardarCapacitacion()" style="flex:1;padding:12px;border-radius:8px;border:none;background:' + C.blue + ';color:#fff;cursor:pointer;font-weight:700">Guardar</button>' +
            '</div></div>';
        document.body.appendChild(m);
    } else {
        m.style.display = "flex";
    }
}

async function guardarCapacitacion() {
    var titulo = document.getElementById("cap-titulo").value;
    var fecha = document.getElementById("cap-fecha").value;
    if (!titulo || !fecha) { alert("Título y Fecha son req."); return; }
    
    await addCapacitacionDB({
        titulo,
        temaPrincipal: document.getElementById("cap-tema").value,
        fechaDictado: fecha,
        tipo: document.getElementById("cap-tipo").value
    });
    closeModal("modal-cap");
    renderCapacitaciones(document.getElementById("main"));
    alert("Capacitación creada");
}

function closeModal(id) {
    var m = document.getElementById(id);
    if (m) m.style.display = "none";
}

async function verCapacitacion(id) {
    var caps = await getCapacitacionesDB();
    var cap = caps.find(c => c.id === id);
    if (!cap) return;
    var asists = await getAsistentesCapDB(id);
    var estruct = await getEstructuraDB();
    var puedeEditar = tieneAccesoDB("capacitaciones");
    
    var m = document.getElementById("modal-ver-cap");
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-ver-cap";
        m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
        m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:32px;width:700px;max-height:85vh;overflow:auto">' +
            '<h2 id="cap-titulo-disp" style="font-size:20px;font-weight:900;color:' + C.navy + ';margin-bottom:8px"></h2>' +
            '<div id="cap-info-disp" style="font-size:12px;color:' + C.gray + ';margin-bottom:16px"></div>' +
            '<div id="botones-asist" style="display:flex;gap:8px;margin-bottom:16px"></div>' +
            '<div id="lista-asist" style="max-height:40vh;overflow-y:auto"></div>' +
            '<button onclick="closeModal(\'modal-ver-cap\')" style="margin-top:16px;padding:10px 20px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cerrar</button></div>';
        document.body.appendChild(m);
    }
    
    window.capActualId = id;
    document.getElementById("cap-titulo-disp").textContent = cap.titulo;
    document.getElementById("cap-info-disp").textContent = (cap.fechaDictado || "") + " • " + (cap.temaPrincipal || "") + " • " + asists.length + " asistentes";
    
    var botonesHtml = "";
    if (puedeEditar) {
        botonesHtml = '<button onclick="document.getElementById(\'file-asist\').click()" style="background:' + C.bg + ';color:' + C.navy + ';border:1px solid ' + C.border + ';border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer">📥 Subir DNIs CSV</button>' +
            '<input type="file" id="file-asist" style="display:none" onchange="handleSubirAsist(this.files[0])">' +
            '<button onclick="agregarAsistManual()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer">➕ Agregar DNIs</button>';
    }
    document.getElementById("botones-asist").innerHTML = botonesHtml;
    
    var html = '<table style="width:100%;border-collapse:collapse"><thead><tr style="background:' + C.bg + '"><th style="padding:10px;text-align:left">DNI</th><th style="padding:10px;text-align:left">Nombre</th><th style="padding:10px;text-align:left">Jerarquía</th><th style="padding:10px;text-align:left">División</th></tr></thead><tbody>';
    for (var a of asists) {
        html += '<tr style="border-bottom:1px solid ' + C.border + '"><td style="padding:10px;font-family:monospace">' + a.dni + '</td><td style="padding:10px;font-weight:600">' + a.nombre + '</td><td style="padding:10px">' + (a.jerarquia||"") + '</td><td style="padding:10px">' + getNombrePorIdDB(a.dependencia, estruct) + '</td></tr>';
    }
    html += '</tbody></table>';
    document.getElementById("lista-asist").innerHTML = html;
    
    m.style.display = "flex";
}

async function handleSubirAsist(file) {
    if (!file || !window.capActualId) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
        var dnis = ev.target.result.split(/\r?\n/).map(l => l.trim().replace(/[^0-9]/g, "")).filter(d => d.length >= 7);
        var res = await agregarAsistentesDB(window.capActualId, dnis);
        alert("Agregados: " + res.agregados + (res.errores.length ? ". No encontrados: " + res.errores.join(", ") : ""));
        verCapacitacion(window.capActualId);
    };
    reader.readAsText(file);
}

async function agregarAsistManual() {
    var dnis = prompt("DNIs uno por línea:");
    if (!dnis) return;
    var lista = dnis.split("\n").map(d => d.trim().replace(/[^0-9]/g, "")).filter(d => d.length >= 7);
    var res = await agregarAsistentesDB(window.capActualId, lista);
    alert("Agregados: " + res.agregados);
    verCapacitacion(window.capActualId);
}

// ============================================
// AUXILIARES
// ============================================
async function handleImportCSV(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function(ev) {
        var res = await importarPersonalCSVDB(ev.target.result);
        alert("Importados: " + res.agregados + ", Actualizados: " + res.actualizados);
        renderPersonal(document.getElementById("main"));
    };
    reader.readAsText(file);
}

function dropCSV(e) {
    e.preventDefault();
    var file = e.dataTransfer.files[0];
    if (file) handleImportCSV(file);
}

async function exportarPersonal() {
    var pers = await getPersonalDB();
    var rows = pers.map(p => [p.dni, p.nombre, p.jerarquia, p.dependencia].join(";"));
    var csv = "DNI;Nombre;Jerarquia;Dependencia\n" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "personal_" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
}

// ============================================
// NAV
// ============================================
function setView(view) {
    var main = document.getElementById("main");
    if (view === "dashboard") renderDashboard(main);
    else if (view === "personal") renderPersonal(main);
    else if (view === "capacitaciones") renderCapacitaciones(main);
    else if (view === "admin") renderAdmin(main);
    
    document.querySelectorAll(".nav-btn").forEach(b => b.style.background = "transparent");
    var btn = document.getElementById("btn-" + view);
    if (btn) btn.style.background = C.mid;
}

// ============================================
// ADMIN
// ============================================
async function renderAdmin(container) {
    if (!puedeAdminDB()) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:' + C.gray + '">No tenés acceso a Admin</div>';
        return;
    }
    
    var usuarios = await getUsuariosDB();
    var estructura = await getEstructuraDB();
    var userEmail = sessionStorage.getItem("userEmail");
    var userName = sessionStorage.getItem("userName") || userEmail;
    
    var html = '<div style="padding:20">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:24px;align-items:center">' +
        '<div><h1 style="font-size:28px;font-weight:950;color:' + C.navy + '">Administración</h1></div>' +
        '</div>' +
        
        '<div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:1px solid ' + C.border + ';padding-bottom:8px">' +
        '<button onclick="renderAdminUsuarios()" id="tab-usuarios" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">Usuarios</button>' +
        '<button onclick="renderAdminEstructura()" id="tab-estructura" style="background:' + C.bg + ';color:' + C.navy + ';border:1px solid ' + C.border + ';border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">Estructura Organizacional</button>' +
        '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + ';margin-bottom:20px">' +
        '<div style="font-size:12px;color:' + C.gray + ';margin-bottom:12px">SESIÓN ACTUAL</div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:' + C.blue + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (userName.charAt(0).toUpperCase()) + '</div>' +
        '<div><div style="font-weight:700">' + userName + '</div><div style="font-size:12px;color:' + C.gray + '">' + userEmail + '</div></div>' +
        '</div>' +
        '</div>' +
        
        '<div id="admin-contenido"></div>';
    
    html += '</div>';
    container.innerHTML = html;
    renderAdminUsuarios();
}

async function renderAdminUsuarios() {
    document.getElementById("tab-usuarios").style.background = C.blue;
    document.getElementById("tab-usuarios").style.color = "#fff";
    document.getElementById("tab-estructura").style.background = C.bg;
    document.getElementById("tab-estructura").style.color = C.navy;
    
    var usuarios = await getUsuariosDB();
    var div = document.getElementById("admin-contenido");
    
    var html = '<div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:center">' +
        '<div style="font-size:16px;font-weight:700;color:' + C.navy + '">Usuarios Autorizados (' + usuarios.length + ')</div>' +
        '<button onclick="openModalUsuario()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">➕ Agregar Usuario</button>' +
        '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;overflow:hidden">' +
        '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:' + C.bg + '"><th style="padding:12px;text-align:left;font-size:11px">Email</th><th style="padding:12px;text-align:left;font-size:11px">Nombre</th><th style="padding:12px;text-align:left;font-size:11px">Rol</th><th style="padding:12px;text-align:left;font-size:11px">Acceso</th><th style="padding:12px;text-align:right;font-size:11px">Acción</th></tr></thead>' +
        '<tbody>';
    
    if (usuarios.length === 0) {
        html += '<tr><td colspan="5" style="padding:24px;text-align:center;color:' + C.gray + '">No hay usuarios</td></tr>';
    } else {
        for (var u of usuarios) {
            var rolLabel = u.rol === ROLES.GESTION ? "Gestión" : (u.rol === ROLES.PERSONAL ? "Personal" : (u.rol === ROLES.CAPACITACION ? "Capacitación" : "Recursos"));
            var color = u.rol === ROLES.GESTION ? C.red : (u.rol === ROLES.PERSONAL ? C.blue : (u.rol === ROLES.CAPACITACION ? C.green : C.orange));
            var acceso = u.rol === ROLES.GESTION ? "Total" : (u.rol === ROLES.PERSONAL ? "Personal" : (u.rol === ROLES.CAPACITACION ? "Capacitaciones" : "Personal + Caps"));
            html += '<tr style="border-bottom:1px solid ' + C.border + '">' +
                '<td style="padding:12px;font-family:monospace;font-size:12px">' + u.email + '</td>' +
                '<td style="padding:12px;font-weight:600">' + (u.nombre || "-") + '</td>' +
                '<td style="padding:12px"><span style="background:' + color + ';color:#fff;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700">' + rolLabel + '</span></td>' +
                '<td style="padding:12px">' + acceso + '</td>' +
                '<td style="padding:12px;text-align:right"><button onclick="eliminarUsuario(\'' + u.email + '\')" style="background:' + C.red + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">Eliminar</button></td></tr>';
        }
    }
    
    html += '</tbody></table></div>';
    div.innerHTML = html;
}

async function renderAdminEstructura() {
    document.getElementById("tab-usuarios").style.background = C.bg;
    document.getElementById("tab-usuarios").style.color = C.navy;
    document.getElementById("tab-estructura").style.background = C.blue;
    document.getElementById("tab-estructura").style.color = "#fff";
    
    var estructura = await getEstructuraDB();
    var div = document.getElementById("admin-contenido");
    
    var nivelLabels = ["", "Dirección", "Departamento", "División"];
    
    var html = '<div style="display:flex;justify-content:space-between;margin-bottom:16px;align-items:center">' +
        '<div style="font-size:16px;font-weight:700;color:' + C.navy + '">Estructura Organizacional (' + estructura.length + ')</div>' +
        '<button onclick="openModalEstructura()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer">➕ Agregar Área</button>' +
        '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;padding:16px">';
    
    for (var nivel = 1; nivel <= 4; nivel++) {
        var items = estructura.filter(e => e.nivel === nivel).sort((a, b) => a.nombre.localeCompare(b.nombre));
        if (items.length === 0) continue;
        
        html += '<div style="font-size:12px;font-weight:700;color:' + C.gray + ';margin-top:' + (nivel > 1 ? '16px' : '0') + ';margin-bottom:8px">' + nivelLabels[nivel] + 'S</div>';
        
        for (var e of items) {
            var padding = (nivel - 1) * 20;
            var nombrePadre = e.padre ? getNombrePorIdDB(e.padre, estructura) : "raíz";
            html += '<div style="display:flex;align-items:center;padding:8px 12px;background:' + C.bg + ';border-radius:8px;margin-bottom:4px;margin-left:' + padding + 'px">' +
                '<div style="flex:1;font-weight:600">' + e.nombre + '</div>' +
                '<div style="font-size:11px;color:' + C.gray + ';margin-right:12px">Padre: ' + nombrePadre + '</div>' +
                '<button onclick="editarEstructura(\'' + e.id + '\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer;margin-right:4px">Editar</button>' +
                '<button onclick="eliminarEstructura(\'' + e.id + '\')" style="background:' + C.red + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:10px;cursor:pointer">Eliminar</button>' +
                '</div>';
        }
    }
    
    html += '</div>';
    div.innerHTML = html;
}

async function openModalEstructura(editarId) {
    var m = document.getElementById("modal-estructura");
    var items = await getEstructuraDB();
    
    var optsPadre = '<option value="">-- Raíz --</option>';
    items.forEach(e => { optsPadre += '<option value="' + e.id + '">' + e.nombre + '</option>'; });
    
    var optsNivel = '<option value="1">Dirección</option><option value="2">Departamento</option><option value="3">División</option><option value="4">Área</option>';
    
    var titulo = editarId ? "Editar Área" : "Agregar Área";
    var nombreVal = "";
    var nivelVal = 1;
    var padreVal = "";
    
    if (editarId) {
        var e = items.find(x => x.id === editarId);
        if (e) { nombreVal = e.nombre; nivelVal = e.nivel; padreVal = e.padre; }
    }
    
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-estructura";
    }
    m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
    m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:32px;width:400px">' +
        '<h2 style="font-size:20px;font-weight:900;color:' + C.navy + ';margin-bottom:20px">' + titulo + '</h2>' +
        '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Nombre *</label><input id="est-nombre" value="' + nombreVal + '" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
        '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Nivel</label><select id="est-nivel" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '">' + optsNivel + '</select></div>' +
        '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Pertenece a</label><select id="est-padre" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '">' + optsPadre + '</select></div>' +
        '<div style="display:flex;gap:12px;margin-top:20px">' +
        '<button onclick="closeModal(\'modal-estructura\')" style="flex:1;padding:12px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cancelar</button>' +
        '<button onclick="guardarEstructura(\'' + (editarId||'') + '\')" style="flex:1;padding:12px;border-radius:8px;border:none;background:' + C.blue + ';color:#fff;cursor:pointer;font-weight:700">Guardar</button>' +
        '</div></div>';
    document.body.appendChild(m);
    m.style.display = "flex";
    
    if (editarId) {
        document.getElementById("est-nivel").value = nivelVal;
        document.getElementById("est-padre").value = padreVal;
    }
}

async function guardarEstructura(editarId) {
    var nombre = document.getElementById("est-nombre").value.trim();
    var nivel = parseInt(document.getElementById("est-nivel").value);
    var padre = document.getElementById("est-padre").value;
    
    if (!nombre) { alert("Nombre es requerido"); return; }
    
    var id = editarId || nombre.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/\s+/g, "-").substring(0, 20) + "_" + Date.now().toString(36);
    
    await addEstructuraDB(id, nombre, nivel, padre);
    closeModal("modal-estructura");
    renderAdminEstructura();
}

async function editarEstructura(id) {
    openModalEstructura(id);
}

async function eliminarEstructura(id) {
    if (!confirm("Eliminar esta área y todas sus subáreas?")) return;
    await deleteEstructuraDB(id);
    renderAdminEstructura();
}

function openModalUsuario() {
    var m = document.getElementById("modal-usuario");
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-usuario";
        m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000";
        m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:32px;width:400px">' +
            '<h2 style="font-size:20px;font-weight:900;color:' + C.navy + ';margin-bottom:20px">Agregar Usuario</h2>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Email *</label><input id="user-email" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Nombre</label><input id="user-nombre" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Rol</label><select id="user-rol" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"><option value="personal">Personal</option><option value="recursos">Recursos Humanos</option><option value="capacitacion">Capacitación</option><option value="gestion">Gestión</option></select></div>' +
            '<div style="display:flex;gap:12px;margin-top:20px">' +
            '<button onclick="closeModal(\'modal-usuario\')" style="flex:1;padding:12px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cancelar</button>' +
            '<button onclick="guardarUsuario()" style="flex:1;padding:12px;border-radius:8px;border:none;background:' + C.blue + ';color:#fff;cursor:pointer;font-weight:700">Guardar</button>' +
            '</div></div>';
        document.body.appendChild(m);
    } else {
        m.style.display = "flex";
    }
}

async function guardarUsuario() {
    var email = document.getElementById("user-email").value.trim().toLowerCase();
    var nombre = document.getElementById("user-nombre").value.trim();
    var rol = document.getElementById("user-rol").value;
    
    if (!email) { alert("Email es requerido"); return; }
    if (email.indexOf("@") === -1) { alert("Email inválido"); return; }
    
    await addUsuarioDB(email, rol, nombre);
    closeModal("modal-usuario");
    renderAdmin(document.getElementById("main"));
    alert("Usuario guardado");
}

async function eliminarUsuario(email) {
    if (!confirm("Eliminar acceso de " + email + "?")) return;
    await deleteUsuarioDB(email);
    renderAdmin(document.getElementById("main"));
}

// ============================================
// INIT
// ============================================
async function initApp() {
    var fbInit = await initFirebase();
    if (!fbInit) {
        console.error("Firebase no inicializado");
        return;
    }
    
    var userEmail = sessionStorage.getItem("userEmail");
    var userName = sessionStorage.getItem("userName") || "";
    
    if (!userEmail) {
        window.location.href = "login.html";
        return;
    }
    
    currentUserData = await getUsuarioByEmailDB(userEmail);
    
    if (!currentUserData) {
        var usuarios = await getUsuariosDB();
        if (usuarios.length === 0) {
            await addUsuarioDB(userEmail, ROLES.GESTION, userName);
            currentUserData = await getUsuarioByEmailDB(userEmail);
        } else {
            alert("No tenés acceso autorizado");
            window.location.href = "login.html";
            return;
        }
    }
    
    var showAdmin = puedeAdminDB();
    
    document.getElementById("root").innerHTML = 
        '<nav style="background:' + C.navy + ';padding:16px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;flex-wrap:wrap">' +
        '<img src="src/img/favicon.png" style="width:36px;height:36px;border-radius:6px">' +
        '<div style="font-size:18px;font-weight:900;color:#fff">911 - Admin</div>' +
        '<button class="nav-btn" id="btn-dashboard" onclick="setView(\'dashboard\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Inicio</button>' +
        (tieneAccesoDB("personal") ? '<button class="nav-btn" id="btn-personal" onclick="setView(\'personal\')" style="background:transparent;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Personal</button>' : '') +
        (tieneAccesoDB("capacitaciones") ? '<button class="nav-btn" id="btn-capacitaciones" onclick="setView(\'capacitaciones\')" style="background:transparent;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Capacitaciones</button>' : '') +
        (showAdmin ? '<button class="nav-btn" id="btn-admin" onclick="setView(\'admin\')" style="background:transparent;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Admin</button>' : '') +
        '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:12px;color:rgba(255,255,255,0.7)">' + (userName || userEmail) + '</span>' +
        '<button onclick="logout()" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer">Salir</button>' +
        '</div>' +
        '</nav>' +
        '<main id="main" style="padding:24px;max-width:1400px;margin:0 auto"></main>';
    
    setView("personal");
}

function logout() {
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userName");
    window.location.href = "login.html";
}

// Expose functions globally
window.initApp = initApp;
window.verPerfil = verPerfil;
window.setView = setView;
window.closeModal = closeModal;
window.handleImportCSV = handleImportCSV;
window.dropCSV = dropCSV;
window.exportarPersonal = exportarPersonal;
window.verCapacitacion = verCapacitacion;
window.handleSubirAsist = handleSubirAsist;
window.agregarAsistManual = agregarAsistManual;
window.renderPersonal = renderPersonal;
window.renderCapacitaciones = renderCapacitaciones;
window.renderAdmin = renderAdmin;
window.filtrarPersonal = filtrarPersonal;
window.openModalAgregar = openModalAgregar;
window.guardarEmpleado = guardarEmpleado;
window.openModalCapacitacion = openModalCapacitacion;
window.guardarCapacitacion = guardarCapacitacion;
window.openModalUsuario = openModalUsuario;
window.guardarUsuario = guardarUsuario;
window.eliminarUsuario = eliminarUsuario;
window.editarEstructura = editarEstructura;
window.eliminarEstructura = eliminarEstructura;
window.logout = logout;

// Auto init
initApp();