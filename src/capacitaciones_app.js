// SISTEMA DE CAPACITACIONES POLICIALES - V3 CON FIREBASE AUTH
var C = { navy: "#0f2444", blue: "#1B3A6B", mid: "#2E5FA3", light: "#D6E4F0", green: "#16a34a", greenBg: "#D1FAE5", red: "#dc2626", redBg: "#FEE2E2", gray: "#64748b", border: "#e2e8f0", bg: "#f0f4f8", card: "#ffffff", orange: "#ea580c" };

// CONFIGURACIÓN FIREBASE - se carga desde firebase-config.js
var USE_FIREBASE = true;
var db = null;
var auth = null;
var currentUser = null;

// LOCAL STORAGE
function getLS(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } }
function setLS(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

// KEYS
var K_PERS = "cap_personal";
var K_CAP = "cap_capacitaciones";
var K_ASIST = "cap_asistentes";
var K_ESTRUCT = "cap_estructura";
var K_HIST = "cap_historial";
var K_USERS = "cap_usuarios";

// ROLES
var ROLES = {
    PERSONAL: "personal",
    RECURSOS: "recursos",
    CAPACITACION: "capacitacion",
    GESTION: "gestion"
};

// ============================================
// USUARIOS DEL SISTEMA
// ============================================
function getUsuarios() { return getLS(K_USERS); }
function saveUsuarios(list) { setLS(K_USERS, list); }

function getUsuarioByEmail(email) {
    return getUsuarios().find(function(u) { return u.email === email; });
}

function addUsuario(email, rol, nombre) {
    var list = getUsuarios();
    var idx = list.findIndex(function(u) { return u.email === email; });
    if (idx >= 0) {
        list[idx].rol = rol;
        list[idx].nombre = nombre;
        list[idx].updatedAt = new Date().toISOString();
    } else {
        list.push({ email: email, nombre: nombre, rol: rol, createdAt: new Date().toISOString() });
    }
    saveUsuarios(list);
}

function deleteUsuario(email) {
    var list = getUsuarios().filter(function(u) { return u.email !== email; });
    saveUsuarios(list);
}

function tieneAcceso(seccion) {
    var userEmail = sessionStorage.getItem("userEmail");
    if (!userEmail) return false;
    var usu = getUsuarioByEmail(userEmail);
    if (!usu) return false;
    if (usu.rol === ROLES.GESTION) return true;
    if (usu.rol === ROLES.PERSONAL) return seccion === "personal";
    if (usu.rol === ROLES.CAPACITACION) return seccion === "capacitaciones";
    if (usu.rol === ROLES.RECURSOS) return seccion === "recursos";
    return false;
}

function puedeAdmin() {
    var userEmail = sessionStorage.getItem("userEmail");
    if (!userEmail) return false;
    var usu = getUsuarioByEmail(userEmail);
    return usu && usu.rol === ROLES.GESTION;
}

// ============================================
// FIREBASE
// ============================================
async function initFirebase() {
    if (!USE_FIREBASE || !window.FIREBASE_CONFIG?.apiKey) {
        console.log("Firebase no configurado - modo local");
        return false;
    }
    try {
        var app = window.firebase.initializeApp(window.FIREBASE_CONFIG);
        db = window.firebase.firestore();
        auth = window.firebase.auth();
        console.log("Firebase inicializado");
        return true;
    } catch(e) {
        console.error("Error Firebase:", e);
        return false;
    }
}

async function saveToFirestore(collection, data) {
    if (!db) return null;
    try {
        var docRef = await db.collection(collection).add(data);
        return docRef.id;
    } catch(e) {
        console.error("Error guardando:", e);
        return null;
    }
}

async function loadFromFirestore(collection) {
    if (!db) return [];
    try {
        var snap = await db.collection(collection).get();
        return snap.docs.map(function(d) { return Object.assign({id: d.id}, d.data()); });
    } catch(e) {
        console.error("Error cargando:", e);
        return [];
    }
}

// ============================================
// PERSONAL
// ============================================
function getPersonal() { return getLS(K_PERS); }
function savePersonal(list) { setLS(K_PERS, list); }

function addOrUpdatePersonal(emp) {
    var list = getPersonal();
    var idx = list.findIndex(function(e) { return e.dni === emp.dni; });
    var ahora = new Date().toISOString();
    if (idx >= 0) {
        var anterior = list[idx];
        list[idx] = Object.assign({}, anterior, emp, { updatedAt: ahora });
        guardarHistorial(emp.dni, "ACTUALIZACION", Object.keys(emp).filter(function(k) { return emp[k] !== anterior[k]; }).join(", "));
    } else {
        list.push(Object.assign({}, emp, { createdAt: ahora, updatedAt: ahora, estado: "activo" }));
        guardarHistorial(emp.dni, "ALTA", "Alta en el sistema");
    }
    savePersonal(list);
    
    // Guardar en Firebase si está configurado
    if (USE_FIREBASE && db) {
        saveToFirestore("personal", emp);
    }
    return list;
}

function deletePersonal(dni) {
    var list = getPersonal().filter(function(e) { return e.dni !== dni; });
    savePersonal(list);
}

function getPersonalById(dni) {
    return getPersonal().find(function(e) { return e.dni === dni; });
}

// ============================================
// HISTORIAL
// ============================================
function guardarHistorial(dni, tipo, detalle) {
    var hist = getLS(K_HIST);
    hist.push({ dni: dni, tipo: tipo, detalle: detalle, fecha: new Date().toISOString() });
    setLS(K_HIST, hist);
}

function getHistorial(dni) {
    return getLS(K_HIST).filter(function(h) { return h.dni === dni; }).sort(function(a,b) { return new Date(b.fecha) - new Date(a.fecha); });
}

// ============================================
// CAPACITACIONES
// ============================================
function getCapacitaciones() { return getLS(K_CAP); }
function saveCapacitaciones(list) { setLS(K_CAP, list); }

function addCapacitacion(cap) {
    var list = getCapacitaciones();
    var nuevo = Object.assign({}, cap, { id: "CAP_" + Date.now().toString(36), createdAt: new Date().toISOString(), estado: "activa" });
    list.push(nuevo);
    saveCapacitaciones(list);
    if (USE_FIREBASE && db) saveToFirestore("capacitaciones", cap);
    return nuevo;
}

function deleteCapacitacion(id) {
    var list = getCapacitaciones().filter(function(c) { return c.id !== id; });
    saveCapacitaciones(list);
}

// ============================================
// ASISTENCIAS
// ============================================
function getAsistencias() { return getLS(K_ASIST); }
function saveAsistencias(list) { setLS(K_ASIST, list); }

function agregarAsistentes(capId, dnis) {
    var personal = getPersonal();
    var list = getAsistencias();
    var agregados = 0;
    var errores = [];
    
    dnis.forEach(function(dni) {
        var emp = personal.find(function(e) { return e.dni === dni; });
        if (!emp) { errores.push(dni); return; }
        
        var ya = list.find(function(a) { return a.capacitacionId === capId && a.dni === dni; });
        if (ya) return;
        
        list.push({
            id: "ASIST_" + Date.now().toString(36) + Math.random().toString(36).substr(2,4),
            capacitacionId: capId,
            dni: emp.dni,
            nombre: emp.nombre,
            jerarquia: emp.jerarquia,
            dependencia: emp.dependencia,
            presente: true,
            fecha: new Date().toISOString()
        });
        agregados++;
        
        var cap = getCapacitaciones().find(function(c) { return c.id === capId });
        guardarHistorial(dni, "CAPACITACION", (cap ? cap.titulo : capId) + " - Asistió");
    });
    
    saveAsistencias(list);
    return { agregados: agregados, errores: errores };
}

function getAsistentesCap(capId) {
    return getAsistencias().filter(function(a) { return a.capacitacionId === capId; });
}

function getCapacitacionesDelEmpleado(dni) {
    var asists = getAsistencias().filter(function(a) { return a.dni === dni; });
    var caps = getCapacitaciones();
    return asists.map(function(a) {
        var cap = caps.find(function(c) { return c.id === a.capacitacionId; });
        return cap ? { id: cap.id, titulo: cap.titulo, tema: cap.temaPrincipal, fecha: cap.fechaDictado, tipo: cap.tipo, presente: a.presente } : null;
    }).filter(Boolean).sort(function(a,b) { return new Date(b.fecha || 0) - new Date(a.fecha || 0); });
}

// ============================================
// ESTRUCTURA
// ============================================
function getEstructura() {
    var e = getLS(K_ESTRUCT);
    if (!e || !e.length) {
        e = [
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
        setLS(K_ESTRUCT, e);
    }
    return e;
}

function getNombrePorId(id) {
    var e = getEstructura().find(function(x) { return x.id === id; });
    return e ? e.nombre : (id || "");
}

function getJerarquias() {
    var personal = getPersonal();
    var set = new Set();
    personal.forEach(function(p) { if (p.jerarquia) set.add(p.jerarquia); });
    var arr = Array.from(set).sort();
    return arr.length ? arr : ["Oficial", "Suboficial", "Agente", "Sgte.", "Cgto.", "Sarg.", "Tte.", "Cap.", "Mayor", "Cmte."];
}

// ============================================
// IMPORTAR PERSONAL CSV
// ============================================
function importarPersonalCSV(content) {
    var lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var imported = [];
    lines.forEach(function(line, i) {
        if (!line.trim()) return;
        if (i === 0 && line.toLowerCase().indexOf("dni") !== -1) return;
        var cols = line.split(";").map(function(c) { return c.trim(); });
        if (cols.length < 2 || !cols[0]) return;
        var dni = cols[0].replace(/[^0-9]/g, "");
        if (dni.length < 7) return;
        imported.push({ dni: dni, nombre: cols[1] || "", jerarquia: cols[2] || "", dependencia: cols[3] || "" });
    });
    var agregados = 0, actualizados = 0;
    imported.forEach(function(emp) {
        var existe = getPersonal().find(function(e) { return e.dni === emp.dni; });
        addOrUpdatePersonal(emp);
        if (existe) actualizados++; else agregados++;
    });
    return { agregados: agregados, actualizados: actualizados };
}

// ============================================
// ESTADISTICAS
// ============================================
function getEstadisticasCap() {
    var caps = getCapacitaciones();
    var asists = getAsistencias();
    var personal = getPersonal();
    
    var porTipo = {};
    var porMes = {};
    var totalAsistentes = 0;
    
    caps.forEach(function(cap) {
        var cant = asists.filter(function(a) { return a.capacitacionId === cap.id; }).length;
        totalAsistentes += cant;
        var tipo = cap.tipo || "unica";
        porTipo[tipo] = (porTipo[tipo] || 0) + cant;
        if (cap.fechaDictado) {
            var mes = cap.fechaDictado.substring(0, 7);
            porMes[mes] = (porMes[mes] || 0) + cant;
        }
    });
    
    return { totalCaps: caps.length, totalAsistentes: totalAsistentes, porTipo: porTipo, porMes: porMes, totalPersonal: personal.length };
}

// ============================================
// RENDER DASHBOARD
// ============================================
function renderDashboard(container) {
    var stats = getEstadisticasCap();
    var html = '<div style="padding:20">' +
        '<div style="background:linear-gradient(135deg,' + C.navy + ',' + C.blue + ');border-radius:16px;padding:32px;margin-bottom:24px;color:#fff">' +
        '<h1 style="font-size:32px;font-weight:950">Sistema de Capacitaciones</h1>' +
        '<div style="font-size:14px;opacity:0.8;margin-top:8px">' + stats.totalPersonal + ' personal • ' + stats.totalCaps + ' capacitaciones • ' + stats.totalAsistentes + ' inscripciones</div></div>' +
        
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">' +
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Personal Total</div><div style="font-size:32px;font-weight:900;color:' + C.blue + '">' + stats.totalPersonal + '</div></div>' +
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Capacitaciones</div><div style="font-size:32px;font-weight:900;color:' + C.green + '">' + stats.totalCaps + '</div></div>' +
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Asistencias Totales</div><div style="font-size:32px;font-weight:900;color:' + C.orange + '">' + stats.totalAsistentes + '</div></div>' +
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><div style="font-size:11px;color:' + C.gray + ';text-transform:uppercase">Promedio/Cap</div><div style="font-size:32px;font-weight:900;color:' + C.mid + '">' + (stats.totalCaps ? Math.round(stats.totalAsistentes / stats.totalCaps) : 0) + '</div></div>' +
        '</div>' +
        
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><h3 style="font-size:14px;font-weight:800;color:' + C.navy + ';margin-bottom:16px">Por Tipo de Capacitación</h3>';
    Object.keys(stats.porTipo).forEach(function(k) {
        var cant = stats.porTipo[k];
        var pct = Math.round((cant / stats.totalAsistentes) * 100);
        html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ' + C.border + '"><span style="text-transform:capitalize">' + k + '</span><span style="font-weight:700">' + cant + ' (' + pct + '%)</span></div>';
    });
    html += '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '"><h3 style="font-size:14px;font-weight:800;color:' + C.navy + ';margin-bottom:16px">Por Mes</h3>';
    var meses = Object.keys(stats.porMes).sort().reverse().slice(0,6);
    meses.reverse().forEach(function(m) {
        html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ' + C.border + '"><span>' + m + '</span><span style="font-weight:700">' + stats.porMes[m] + '</span></div>';
    });
    html += '</div></div></div>';
    
    if (container) container.innerHTML = html;
}

// ============================================
// RENDER PERSONAL
// ============================================
function renderPersonal(container) {
    if (!tieneAcceso("personal")) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:' + C.gray + '">No tenés acceso a Personal</div>';
        return;
    }
    
    var pers = getPersonal();
    var jerarquias = getJerarquias();
    var estruct = getEstructura();
    var nivel4 = estruct.filter(function(e) { return e.nivel === 4; });
    
    var filterJer = '<select id="filtro-jer" onchange="filtrarPersonal()" style="padding:10px;border-radius:8px;border:1px solid ' + C.border + ';width:100%"><option value="">Todas las Jerarquías</option>';
    jerarquias.forEach(function(j) { filterJer += '<option value="' + j + '">' + j + '</option>'; });
    filterJer += '</select>';
    
    var filterDiv = '<select id="filtro-div" onchange="filtrarPersonal()" style="padding:10px;border-radius:8px;border:1px solid ' + C.border + ';width:100%"><option value="">Todas las Divisiones</option>';
    nivel4.forEach(function(e) { filterDiv += '<option value="' + e.id + '">' + e.nombre + '</option>'; });
    filterDiv += '</select>';
    
    var puedeEditar = tieneAcceso("personal");
    
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
    
    pers.slice(0,50).forEach(function(p) {
        var caps = getCapacitacionesDelEmpleado(p.dni);
        html += '<tr style="border-bottom:1px solid ' + C.border + '"><td style="padding:12px;font-family:monospace">' + p.dni + '</td><td style="padding:12px;font-weight:600"><a href="#" onclick="verPerfil(\'' + p.dni + '\')" style="color:' + C.navy + ';text-decoration:none">' + p.nombre + '</a></td><td style="padding:12px">' + (p.jerarquia||"") + '</td><td style="padding:12px">' + getNombrePorId(p.dependencia) + '</td><td style="padding:12px"><span style="background:' + (caps.length > 0 ? C.greenBg : C.bg) + ';padding:4px 8px;border-radius:4px;font-size:11px;color:' + (caps.length > 0 ? C.green : C.gray) + '">' + caps.length + '</span></td><td style="padding:12px;text-align:right"><button onclick="verPerfil(\'' + p.dni + '\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">Ver Perfil</button></td></tr>';
    });
    
    html += '</tbody></table></div></div>';
    if (container) container.innerHTML = html;
    window.personalActual = pers;
}

function filtrarPersonal() {
    var nombre = document.getElementById("buscar-nombre").value.toLowerCase();
    var jer = document.getElementById("filtro-jer").value;
    var div = document.getElementById("filtro-div").value;
    
    var filtrado = getPersonal().filter(function(p) {
        if (nombre && p.nombre.toLowerCase().indexOf(nombre) === -1) return false;
        if (jer && p.jerarquia !== jer) return false;
        if (div && p.dependencia !== div) return false;
        return true;
    });
    
    var html = filtrado.slice(0,50).map(function(p) {
        var caps = getCapacitacionesDelEmpleado(p.dni);
        return '<tr style="border-bottom:1px solid ' + C.border + '"><td style="padding:12px;font-family:monospace">' + p.dni + '</td><td style="padding:12px;font-weight:600"><a href="#" onclick="verPerfil(\'' + p.dni + '\')" style="color:' + C.navy + ';text-decoration:none">' + p.nombre + '</a></td><td style="padding:12px">' + (p.jerarquia||"") + '</td><td style="padding:12px">' + getNombrePorId(p.dependencia) + '</td><td style="padding:12px"><span style="background:' + (caps.length > 0 ? C.greenBg : C.bg) + ';padding:4px 8px;border-radius:4px;font-size:11px;color:' + (caps.length > 0 ? C.green : C.gray) + '">' + caps.length + '</span></td><td style="padding:12px;text-align:right"><button onclick="verPerfil(\'' + p.dni + '\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">Ver Perfil</button></td></tr>';
    }).join("");
    
    var tbody = document.getElementById("tabla-personal");
    if (tbody) tbody.innerHTML = html;
}

// ============================================
// RENDER CAPACITACIONES
// ============================================
function renderCapacitaciones(container) {
    if (!tieneAcceso("capacitaciones")) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:' + C.gray + '">No tenés acceso a Capacitaciones</div>';
        return;
    }
    
    var caps = getCapacitaciones();
    var asists = getAsistencias();
    var puedeEditar = tieneAcceso("capacitaciones");
    
    var html = '<div style="padding:20">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:24px;align-items:center">' +
        '<div><h1 style="font-size:28px;font-weight:950;color:' + C.navy + '">Capacitaciones</h1><div style="font-size:13px;color:' + C.gray + '">' + caps.length + ' registradas</div></div>' +
        (puedeEditar ? '<button onclick="openModalCapacitacion()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">➕ Nueva Capacitación</button>' : '') +
        '</div>';
    
    if (caps.length === 0) {
        html += '<div style="background:' + C.card + ';border-radius:14px;padding:40px;text-align:center;color:' + C.gray + '">No hay capacitaciones</div>';
    } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">';
        caps.forEach(function(cap) {
            var cant = asists.filter(function(a) { return a.capacitacionId === cap.id; }).length;
            html += '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + '">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
                '<div style="flex:1"><h3 style="font-size:16px;font-weight:900;color:' + C.navy + '">' + cap.titulo + '</h3>' +
                '<div style="font-size:12px;color:' + C.mid + ';margin-top:4px">' + (cap.temaPrincipal||"") + '</div></div>' +
                '<span style="background:' + (cap.tipo === "multiple" ? C.orBg : C.greenBg) + ';color:' + (cap.tipo === "multiple" ? C.orange : C.green) + ';padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700">' + (cap.tipo === "multiple" ? "MÚLTIPLE" : "ÚNICA") + '</span></div>' +
                '<div style="font-size:12px;color:' + C.gray + ';margin-top:12px">' + 
                '<span style="background:' + C.light + ';padding:4px 8px;border-radius:4px;margin-right:8px">' + (cap.fechaDictado||"") + '</span>' +
                '<span style="background:' + C.greenBg + ';padding:4px 8px;border-radius:4px;color:' + C.green + ';font-weight:700">' + cant + ' asistentes</span></div>' +
                '<div style="margin-top:12px"><button onclick="verCapacitacion(\'' + cap.id + '\')" style="width:100%;background:' + C.mid + ';color:#fff;border:none;border-radius:6px;padding:10px;font-size:12px;cursor:pointer">Ver Detalle</button></div></div>';
        });
        html += '</div>';
    }
    html += '</div>';
    if (container) container.innerHTML = html;
}

// ============================================
// PERFIL CON SOLAPAS
// ============================================
function verPerfil(dni) {
    var emp = getPersonalById(dni);
    if (!emp) { alert("No encontrado"); return; }
    var caps = getCapacitacionesDelEmpleado(dni);
    var hist = getHistorial(dni);
    
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
        '<div style="font-size:12px;opacity:0.7;margin-top:4px">' + getNombrePorId(emp.dependencia) + '</div></div>' +
        
        // SOLAPAS
        '<div style="display:flex;border-bottom:1px solid ' + C.border + ';background:' + C.bg + '">' +
        '<button onclick="cambiarSolapa(\'datos\')" id="solapa-datos" style="flex:1;padding:14px;background:' + C.card + ';border:none;font-size:13px;font-weight:700;color:' + C.navy + ';cursor:pointer;border-bottom:3px solid ' + C.blue + '">📋 Datos Personales</button>' +
        '<button onclick="cambiarSolapa(\'caps\')" id="solapa-caps" style="flex:1;padding:14px;background:transparent;border:none;font-size:13px;font-weight:700;color:' + C.gray + ';cursor:pointer">🎓 Capacitaciones</button>' +
        '<button onclick="cambiarSolapa(\'hist\')" id="solapa-hist" style="flex:1;padding:14px;background:transparent;border:none;font-size:13px;font-weight:700;color:' + C.gray + ';cursor:pointer">📝 Historial</button>' +
        '</div>' +
        
        '<div id="contenido-solapa" style="padding:24px;overflow-y:auto;flex:1"></div>' +
        
        '<div style="padding:16px;border-top:1px solid ' + C.border + ';text-align:right"><button onclick="closeModal(\'modal-perfil\')" style="padding:10px 24px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cerrar</button></div>';
    
    m.querySelector("div").innerHTML = html;
    m.style.display = "flex";
    
    // Renderizar solapa inicial
    renderSolapaDatos(emp);
}

function cambiarSolapa(solapa) {
    var emp = getPersonalById(window.perfilDniActual);
    if (!emp) return;
    
    // Actualizar botones
    var botones = ["datos", "caps", "hist"];
    botones.forEach(function(s) {
        var btn = document.getElementById("solapa-" + s);
        if (btn) {
            var esActiva = s === solapa;
            btn.style.background = esActiva ? C.card : "transparent";
            btn.style.color = esActiva ? C.navy : C.gray;
            btn.style.borderBottom = esActiva ? "3px solid " + C.blue : "none";
        }
    });
    
    // Renderizar contenido
    var contenido = document.getElementById("contenido-solapa");
    if (solapa === "datos") renderSolapaDatos(emp, contenido);
    else if (solapa === "caps") renderSolapaCaps(emp, contenido);
    else if (solapa === "hist") renderSolapaHist(emp, contenido);
}

function renderSolapaDatos(emp, container) {
    var div = container || document.getElementById("contenido-solapa");
    var estrut = getEstructura();
    
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">' +
        '<div><h4 style="font-size:12px;color:' + C.gray + ';text-transform:uppercase;margin-bottom:8px">Datos Personales</h4>' +
        '<div style="background:' + C.bg + ';padding:16px;border-radius:8px">' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">DNI</div><div style="font-weight:700;font-size:16px;font-family:monospace">' + emp.dni + '</div></div>' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">Nombre Completo</div><div style="font-weight:700">' + emp.nombre + '</div></div>' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">Jerarquía</div><div style="font-weight:700">' + (emp.jerarquia || "No asignada") + '</div></div>' +
        '<div><div style="font-size:11px;color:' + C.gray + '">Estado</div><div style="font-weight:700;color:' + C.green + '">' + (emp.estado || "activo").toUpperCase() + '</div></div>' +
        '</div></div>' +
        
        '<div><h4 style="font-size:12px;color:' + C.gray + ';text-transform:uppercase;margin-bottom:8px">Ubicación</h4>' +
        '<div style="background:' + C.bg + ';padding:16px;border-radius:8px">' +
        '<div style="margin-bottom:12"><div style="font-size:11px;color:' + C.gray + '">División</div><div style="font-weight:700">' + getNombrePorId(emp.dependencia) + '</div></div>';
    
    // Buscar ruta completa
    var ruta = [];
    var actual = emp.dependencia;
    while (actual) {
        var e = estrut.find(function(x) { return x.id === actual; });
        if (e) { ruta.unshift(e.nombre); actual = e.padre; }
        else break;
    }
    
    html += '<div><div style="font-size:11px;color:' + C.gray + '">Ruta Completa</div><div style="font-size:12px;color:' + C.navy + '">' + ruta.join(" > ") + '</div></div>';
    html += '</div></div></div>';
    
    if (div) div.innerHTML = html;
}

function renderSolapaCaps(emp, container) {
    var div = container || document.getElementById("contenido-solapa");
    var caps = getCapacitacionesDelEmpleado(emp.dni);
    
    var html = '<h4 style="font-size:12px;color:' + C.gray + ';text-transform:uppercase;margin-bottom:12px">Capacitaciones Realizadas (' + caps.length + ')</h4>';
    
    if (caps.length === 0) {
        html += '<div style="padding:40px;text-align:center;color:' + C.gray + ';background:' + C.bg + ';border-radius:8px">Sin capacitaciones registradas</div>';
    } else {
        caps.forEach(function(c) {
            html += '<div style="padding:14px;background:' + (c.presente ? C.greenBg : C.bg) + ';border-radius:8px;margin-bottom:8px;border-left:4px solid ' + (c.presente ? C.green : C.gray) + '">' +
                '<div style="font-weight:700;color:' + C.navy + '">' + c.titulo + '</div>' +
                '<div style="font-size:11px;color:' + C.gray + ';margin-top:4px">' + (c.fecha || "") + ' • ' + (c.tipo === "multiple" ? "Curso múltiple" : "Clase única") + '</div>' +
                '<div style="font-size:11px;color:' + C.mid + '">' + (c.tema || "") + '</div>' +
                '</div>';
        });
    }
    
    if (div) div.innerHTML = html;
}

function renderSolapaHist(emp, container) {
    var div = container || document.getElementById("contenido-solapa");
    var hist = getHistorial(emp.dni);
    
    var html = '<h4 style="font-size:12px;color:' + C.gray + ';text-transform:uppercase;margin-bottom:12px">Historial de Actividad (' + hist.length + ')</h4>';
    
    if (hist.length === 0) {
        html += '<div style="padding:40px;text-align:center;color:' + C.gray + ';background:' + C.bg + ';border-radius:8px">Sin actividad registrada</div>';
    } else {
        hist.slice(0,20).forEach(function(h) {
            var fecha = new Date(h.fecha).toLocaleString("es-AR");
            var color = h.tipo === "ALTA" ? C.green : (h.tipo === "ACTUALIZACION" ? C.blue : C.orange);
            html += '<div style="padding:10px;border-bottom:1px solid ' + C.border + ';font-size:12px">' +
                '<span style="color:' + C.gray + '">[' + fecha + ']</span> ' +
                '<span style="font-weight:700;color:' + color + '">' + h.tipo + '</span> ' +
                '<span style="color:' + C.navy + '">' + h.detalle + '</span>' +
                '</div>';
        });
    }
    
    if (div) div.innerHTML = html;
}

// ============================================
// MODALES
// ============================================
function openModalAgregar() {
    var estrut = getEstructura();
    var nivel4 = estrut.filter(function(e) { return e.nivel === 4; });
    var optsD = nivel4.map(function(e) { return '<option value="' + e.id + '">' + e.nombre + '</option>'; }).join("");
    var optsJ = getJerarquias().map(function(j) { return '<option value="' + j + '">' + j + '</option>'; }).join("");
    
    var m = document.getElementById("modal-agregar");
    if (!m) {
        m = document.createElement("div");
        m.id = "modal-agregar";
        m.style = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;overflow:auto";
        m.innerHTML = '<div style="background:' + C.card + ';border-radius:16px;padding:32px;width:450px;max-height:90vh;overflow:auto">' +
            '<h2 style="font-size:20px;font-weight:900;color:' + C.navy + ';margin-bottom:20px">Agregar Empleado</h2>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">DNI *</label><input id="emp-dni" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Nombre *</label><input id="emp-nombre" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Jerarquía</label><select id="emp-jerarquia" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"><option value="">-- Seleccionar --</option>' + optsJ + '<option value="OTRA">+ Otra</option></select></div>' +
            '<div id="div-jer-otro" style="margin-bottom:16px;display:none"><input id="emp-jerarquia-otro" placeholder="Nueva jerarquía" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
            '<div style="margin-bottom:20px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">División *</label><select id="emp-division" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"><option value="">-- Seleccionar --</option>' + optsD + '</select></div>' +
            '<div style="display:flex;gap:12px;margin-top:20px">' +
            '<button onclick="closeModal(\'modal-agregar\')" style="flex:1;padding:12px;border-radius:8px;border:1px solid ' + C.border + ';background:' + C.bg + ';cursor:pointer">Cancelar</button>' +
            '<button onclick="guardarEmpleado()" style="flex:1;padding:12px;border-radius:8px;border:none;background:' + C.blue + ';color:#fff;cursor:pointer;font-weight:700">Guardar</button>' +
            '</div></div>';
        document.body.appendChild(m);
        
        document.getElementById("emp-jerarquia").onchange = function() {
            var otro = document.getElementById("div-jer-otro");
            if (otro) otro.style.display = this.value === "OTRA" ? "block" : "none";
        };
    } else {
        m.style.display = "flex";
    }
}

function guardarEmpleado() {
    var dni = document.getElementById("emp-dni").value;
    var nombre = document.getElementById("emp-nombre").value;
    var jerSel = document.getElementById("emp-jerarquia").value;
    var division = document.getElementById("emp-division").value;
    var jerarquia = jerSel === "OTRA" ? document.getElementById("emp-jerarquia-otro").value : jerSel;
    
    if (!dni || !nombre || !division) { alert("DNI, Nombre y División son req."); return; }
    addOrUpdatePersonal({ dni: dni, nombre: nombre, jerarquia: jerarquia, dependencia: division, estado: "activo" });
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
            '<div style="margin-bottom:16px"><label style="display:block;font-size:11px;font-weight:700;color:' + C.navy + ';margin-bottom:6">Tópicos</label><input id="cap-topicos" placeholder="Tema1, Tema2" style="width:100%;padding:10px;border-radius:8px;border:1px solid ' + C.border + '"></div>' +
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

function guardarCapacitacion() {
    var titulo = document.getElementById("cap-titulo").value;
    var fecha = document.getElementById("cap-fecha").value;
    if (!titulo || !fecha) { alert("Título y Fecha son req."); return; }
    
    addCapacitacion({
        titulo: titulo,
        temaPrincipal: document.getElementById("cap-tema").value,
        topicos: document.getElementById("cap-topicos").value,
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

function verCapacitacion(id) {
    var cap = getCapacitaciones().find(function(c) { return c.id === id; });
    if (!cap) return;
    var asists = getAsistentesCap(id);
    var puedeEditar = tieneAcceso("capacitaciones");
    
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
    asists.forEach(function(a) {
        html += '<tr style="border-bottom:1px solid ' + C.border + '"><td style="padding:10px;font-family:monospace">' + a.dni + '</td><td style="padding:10px;font-weight:600">' + a.nombre + '</td><td style="padding:10px">' + (a.jerarquia||"") + '</td><td style="padding:10px">' + getNombrePorId(a.dependencia) + '</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById("lista-asist").innerHTML = html;
    
    m.style.display = "flex";
}

function handleSubirAsist(file) {
    if (!file || !window.capActualId) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var dnis = ev.target.result.split(/\r?\n/).map(function(l) { return l.trim().replace(/[^0-9]/g, ""); }).filter(function(d) { return d.length >= 7; });
        var res = agregarAsistentes(window.capActualId, dnis);
        alert("Agregados: " + res.agregados + (res.errores.length ? ". No encontrados: " + res.errores.join(", ") : ""));
        verCapacitacion(window.capActualId);
    };
    reader.readAsText(file);
}

function agregarAsistManual() {
    var dnis = prompt("DNIs uno por línea:");
    if (!dnis) return;
    var lista = dnis.split("\n").map(function(d) { return d.trim().replace(/[^0-9]/g, ""); }).filter(function(d) { return d.length >= 7; });
    var res = agregarAsistentes(window.capActualId, lista);
    alert("Agregados: " + res.agregados);
    verCapacitacion(window.capActualId);
}

// ============================================
// AUXILIARES
// ============================================
function handleImportCSV(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var res = importarPersonalCSV(ev.target.result);
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

function exportarPersonal() {
    var pers = getPersonal();
    var rows = pers.map(function(p) { return [p.dni, p.nombre, p.jerarquia, p.dependencia].join(";"); });
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
    
    document.querySelectorAll(".nav-btn").forEach(function(b) { b.style.background = "transparent"; });
    var btn = document.getElementById("btn-" + view);
    if (btn) btn.style.background = C.mid;
}

// ============================================
// ADMIN - GESTION DE USUARIOS
// ============================================
function renderAdmin(container) {
    if (!puedeAdmin()) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:' + C.gray + '">No tenés acceso a esta sección</div>';
        return;
    }
    
    var usuarios = getUsuarios();
    var userEmail = sessionStorage.getItem("userEmail");
    var userName = sessionStorage.getItem("userName") || userEmail;
    
    var html = '<div style="padding:20">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:24px;align-items:center">' +
        '<div><h1 style="font-size:28px;font-weight:950;color:' + C.navy + '">Administración</h1><div style="font-size:13px;color:' + C.gray + '">Gestión de usuarios del sistema</div></div>' +
        '<button onclick="openModalUsuario()" style="background:' + C.blue + ';color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer">➕ Agregar Usuario</button>' +
        '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;padding:20px;border:1px solid ' + C.border + ';margin-bottom:20px">' +
        '<div style="font-size:12px;color:' + C.gray + ';margin-bottom:12px">SESIÓN ACTUAL</div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="width:40px;height:40px;border-radius:50%;background:' + C.blue + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">' + (userName.charAt(0).toUpperCase()) + '</div>' +
        '<div><div style="font-weight:700">' + userName + '</div><div style="font-size:12px;color:' + C.gray + '">' + userEmail + '</div></div>' +
        '</div>' +
        '</div>' +
        
        '<div style="background:' + C.card + ';border-radius:14px;overflow:hidden">' +
        '<div style="padding:16px;border-bottom:1px solid ' + C.border + ';font-size:12px;color:' + C.gray + '">USUARIOS AUTORIZADOS (' + usuarios.length + ')</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
        '<thead><tr style="background:' + C.bg + '"><th style="padding:12px;text-align:left;font-size:11px">Usuario</th><th style="padding:12px;text-align:left;font-size:11px">Nombre</th><th style="padding:12px;text-align:left;font-size:11px">Rol</th><th style="padding:12px;text-align:left;font-size:11px">Acceso</th><th style="padding:12px;text-align:right;font-size:11px">Acción</th></tr></thead>' +
        '<tbody id="tabla-usuarios">';
    
    if (usuarios.length === 0) {
        html += '<tr><td colspan="5" style="padding:24px;text-align:center;color:' + C.gray + '">No hay usuarios configurados</td></tr>';
    } else {
        usuarios.forEach(function(u) {
            var rolLabel = u.rol === ROLES.GESTION ? "Gestión" : (u.rol === ROLES.PERSONAL ? "Personal" : (u.rol === ROLES.CAPACITACION ? "Capacitación" : "Recursos"));
            var color = u.rol === ROLES.GESTION ? C.red : (u.rol === ROLES.PERSONAL ? C.blue : (u.rol === ROLES.CAPACITACION ? C.green : C.orange));
            var acceso = u.rol === ROLES.GESTION ? "Total" : (u.rol === ROLES.PERSONAL ? "Personal" : (u.rol === ROLES.CAPACITACION ? "Capacitaciones" : "Personal + Caps"));
            html += '<tr style="border-bottom:1px solid ' + C.border + '">' +
                '<td style="padding:12px;font-family:monospace;font-size:12px">' + u.email + '</td>' +
                '<td style="padding:12px;font-weight:600">' + (u.nombre || "-") + '</td>' +
                '<td style="padding:12px"><span style="background:' + color + ';color:#fff;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700">' + rolLabel + '</span></td>' +
                '<td style="padding:12px">' + acceso + '</td>' +
                '<td style="padding:12px;text-align:right"><button onclick="eliminarUsuario(\'' + u.email + '\')" style="background:' + C.red + ';color:#fff;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer">Eliminar</button></td></tr>';
        });
    }
    
    html += '</tbody></table></div></div>';
    container.innerHTML = html;
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

function guardarUsuario() {
    var email = document.getElementById("user-email").value.trim().toLowerCase();
    var nombre = document.getElementById("user-nombre").value.trim();
    var rol = document.getElementById("user-rol").value;
    
    if (!email) { alert("Email es requerido"); return; }
    if (email.indexOf("@") === -1) { alert("Email inválido"); return; }
    
    addUsuario(email, rol, nombre);
    closeModal("modal-usuario");
    renderAdmin(document.getElementById("main"));
    alert("Usuario guardado");
}

function eliminarUsuario(email) {
    if (!confirm("Eliminar acceso de " + email + "?")) return;
    deleteUsuario(email);
    renderAdmin(document.getElementById("main"));
}

// ============================================
// INIT
// ============================================
document.body.onload = function() {
    getEstructura();
    
    var userEmail = sessionStorage.getItem("userEmail");
    var userName = sessionStorage.getItem("userName") || "";
    
    // Auto-crear primer gestión si no existe nadie
    if (userEmail && getUsuarios().length === 0 && userEmail.indexOf("@") !== -1) {
        addUsuario(userEmail, ROLES.GESTION, userName);
    }
    
    var showAdmin = puedeAdmin();
    var usu = getUsuarioByEmail(userEmail) || {};
    
    document.getElementById("root").innerHTML = 
        '<nav style="background:' + C.navy + ';padding:16px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;flex-wrap:wrap">' +
        '<img src="src/img/favicon.png" style="width:36px;height:36px;border-radius:6px">' +
        '<div style="font-size:18px;font-weight:900;color:#fff">911 - Admin</div>' +
        '<button class="nav-btn" id="btn-dashboard" onclick="setView(\'dashboard\')" style="background:' + C.mid + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Inicio</button>' +
        (usu.rol === ROLES.PERSONAL || usu.rol === ROLES.RECURSOS || usu.rol === ROLES.GESTION ? '<button class="nav-btn" id="btn-personal" onclick="setView(\'personal\')" style="background:transparent;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Personal</button>' : '') +
        (usu.rol === ROLES.CAPACITACION || usu.rol === ROLES.RECURSOS || usu.rol === ROLES.GESTION ? '<button class="nav-btn" id="btn-capacitaciones" onclick="setView(\'capacitaciones\')" style="background:transparent;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Capacitaciones</button>' : '') +
        (showAdmin ? '<button class="nav-btn" id="btn-admin" onclick="setView(\'admin\')" style="background:transparent;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer">Admin</button>' : '') +
        '<div style="margin-left:auto;display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:12px;color:rgba(255,255,255,0.7)">' + (userName || userEmail) + '</span>' +
        '<button onclick="window.location.href=\'login.html\'" style="background:rgba(255,255,255,0.1);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer">Salir</button>' +
        '</div>' +
        '</nav>' +
        '<main id="main" style="padding:24px;max-width:1400px;margin:0 auto"></main>';
    
    setView("personal");
};

// Bootstrap global para usar desde index.html
window.initApp = function() {
    document.body.onload();
};

document.body.style.margin = "0";