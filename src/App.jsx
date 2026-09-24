import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

/* ══════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════ */
const DEF_PWD = "centro2024";
const LOGO    = "/logo.png";
const uid     = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36);

const resizeImg = (file, max = 2400) => new Promise(res => {
  const img = new Image(), c = document.createElement("canvas");
  img.onload = () => {
    const s = Math.min(max / Math.max(img.width, img.height), 1);
    c.width = img.width * s; c.height = img.height * s;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    res(c.toDataURL("image/jpeg", 0.95));
  };
  img.src = URL.createObjectURL(file);
});

const DEFAULT_SERVICES = [
  "Colloquio individuale",
  "Terapia di coppia",
  "Psicologia dell'età evolutiva",
  "Supporto psicologico",
  "Altro"
];

const DEFAULT_SECTIONS = [
  { id:"home",      title:"Benvenuti",                subtitle:"Un luogo di ascolto, cura e crescita personale",    tagText:"",  headingText:"Benvenuti",              content:"", navLabel:"Home",        images:[], visible:true, order:0, type:"home",    builtin:true  },
  { id:"chi-siamo", title:"Chi Siamo",                subtitle:"Il nostro team di professionisti",                  tagText:"TEAM", headingText:"Chi Siamo", content:"", navLabel:"Chi Siamo",   images:[], visible:true, order:1, type:"content"               },
  { id:"servizi",   title:"Attività e Servizi",       subtitle:"Come possiamo aiutarti nel tuo percorso",           tagText:"SERVIZI", headingText:"Attività e Servizi", content:"", navLabel:"Servizi",     images:[], visible:true, order:2, type:"content"               },
  { id:"prenota",   title:"Prenota un Appuntamento",  subtitle:"Il primo passo verso il cambiamento",               tagText:"PRENOTA", headingText:"Prenota un Appuntamento", content:"", navLabel:"Prenota",     images:[], visible:true, order:3, type:"booking", builtin:true  },
  { id:"contatti",  title:"Contatti",                 subtitle:"Siamo qui per te",                                  tagText:"CONTATTI", headingText:"Contatti", content:"", navLabel:"Contatti",    images:[], visible:true, order:4, type:"contact", builtin:true  },
];

/* ══════════════════════════════════════════════════════════════════
   FIREBASE
══════════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAILW-zM3QMETZRtNsmXr0koKxFM7K7SGE",
  authDomain: "centromenteviva.firebaseapp.com",
  projectId: "centromenteviva",
  storageBucket: "centromenteviva.firebasestorage.app",
  messagingSenderId: "837723421921",
  appId: "1:837723421921:web:022895eeb332099a0ccba0"
};
const _fbApp = initializeApp(FIREBASE_CONFIG);
const _fs    = getFirestore(_fbApp);
const _col   = "centro";

const db = {
  async get(k, d = null) {
    try { const s = await getDoc(doc(_fs, _col, k)); return s.exists() ? JSON.parse(s.data().v) : d; }
    catch { return d; }
  },
  async set(k, v) {
    try { await setDoc(doc(_fs, _col, k), { v: JSON.stringify(v) }); return true; }
    catch { return false; }
  },
  async getSections() {
    try {
      const list = await getDoc(doc(_fs, _col, "__slist"));
      if (!list.exists()) return DEFAULT_SECTIONS;
      const ids  = JSON.parse(list.data().v);
      const snaps = await Promise.all(ids.map(id => getDoc(doc(_fs, _col, `__s_${id}`))));
      return snaps.filter(s => s.exists()).map(s => JSON.parse(s.data().v));
    } catch { return DEFAULT_SECTIONS; }
  },
  async saveSections(sections) {
    try {
      await Promise.all(sections.map(s => setDoc(doc(_fs, _col, `__s_${s.id}`), { v: JSON.stringify(s) })));
      await setDoc(doc(_fs, _col, "__slist"), { v: JSON.stringify(sections.map(s => s.id)) });
      return true;
    } catch { return false; }
  },
  async getHero() {
    try {
      const list = await getDoc(doc(_fs, _col, "__hlist"));
      if (!list.exists()) return [];
      const ids   = JSON.parse(list.data().v);
      const snaps = await Promise.all(ids.map(id => getDoc(doc(_fs, _col, `__h_${id}`))));
      return snaps.filter(s => s.exists()).map(s => JSON.parse(s.data().v));
    } catch { return []; }
  },
  async saveHero(images) {
    try {
      const ids = images.map((_, i) => `img${i}`);
      await Promise.all(images.map((img, i) => setDoc(doc(_fs, _col, `__h_${ids[i]}`), { v: JSON.stringify(img) })));
      await setDoc(doc(_fs, _col, "__hlist"), { v: JSON.stringify(ids) });
      return true;
    } catch { return false; }
  }
};

/* ══════════════════════════════════════════════════════════════════
   EMAIL
══════════════════════════════════════════════════════════════════ */
async function sendBooking(cfg, form) {
  if (!cfg?.svcId || !cfg?.tplId || !cfg?.pubKey || !cfg?.ownerEmail) return false;
  try {
    // Email 1: Notification to ADMIN
    const adminEmail = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: cfg.svcId, template_id: cfg.tplId, user_id: cfg.pubKey,
        template_params: {
          to_email:      cfg.ownerEmail,
          nome:          form.name,
          email:         form.email,
          telefono:      form.phone  || "—",
          servizio:      form.service || "—",
          data:          form.date   || "—",
          ora:           form.time   || "—",
          messaggio:     form.message || "—",
          data_invio:    new Date().toLocaleString("it-IT")
        }
      })
    });

    // Email 2: Confirmation to CUSTOMER
    const customerEmail = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: cfg.svcId, template_id: cfg.tplId, user_id: cfg.pubKey,
        template_params: {
          to_email:      form.email,
          nome:          form.name,
          email:         form.email,
          telefono:      form.phone  || "—",
          servizio:      form.service || "—",
          data:          form.date   || "—",
          ora:           form.time   || "—",
          messaggio:     `Grazie per la prenotazione! Abbiamo ricevuto la tua richiesta.`,
          data_invio:    new Date().toLocaleString("it-IT")
        }
      })
    });

    return adminEmail.ok && customerEmail.ok;
  } catch (e) { 
    console.error("Email send error:", e);
    return false; 
  }
}

/* ══════════════════════════════════════════════════════════════════
   GOOGLE CALENDAR INTEGRATION
══════════════════════════════════════════════════════════════════ */
async function getAvailableSlots(config, selectedDate) {
  try {
    console.log("🔍 Getting slots for date:", selectedDate, "Config:", config);
    
    if (!config) {
      console.warn("⚠️ No config found");
      return [];
    }

    const date = new Date(selectedDate);
    const dayOfWeek = date.getDay();
    
    // Check if it's a working day
    const workDays = config.workDays || [1, 2, 3, 4, 5]; // Default: Mon-Fri
    if (!workDays.includes(dayOfWeek)) {
      console.log("❌ Not a working day:", dayOfWeek);
      return [];
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch events from Firestore
    const eventsSnap = await getDoc(doc(_fs, _col, "__calendar_events"));
    const allEvents = eventsSnap.exists() ? JSON.parse(eventsSnap.data().v) : [];
    
    // Filter events for the selected date
    const dayEvents = allEvents.filter(e => {
      const eStart = new Date(e.start);
      return eStart >= startOfDay && eStart <= endOfDay;
    });

    console.log("📅 Booked events for this day:", dayEvents);

    // Parse config times with fallbacks
    const startStr = config.workingHoursStart || "09:00";
    const endStr = config.workingHoursEnd || "19:00";
    const lunchStartStr = config.lunchBreakStart || "13:00";
    const lunchEndStr = config.lunchBreakEnd || "14:00";

    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);
    const [lunchStartH, lunchStartM] = lunchStartStr.split(":").map(Number);
    const [lunchEndH, lunchEndM] = lunchEndStr.split(":").map(Number);
    const minDuration = config.appointmentDurationMin || 30;

    console.log(`⏰ Working hours: ${startH}:${startM} - ${endH}:${endM}, Lunch: ${lunchStartH}:${lunchStartM} - ${lunchEndH}:${lunchEndM}`);

    // Generate 30-minute slots
    const slots = [];
    for (let h = startH; h < endH; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotStart = new Date(date);
        slotStart.setHours(h, m, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + minDuration);

        // Skip if during lunch
        if (slotStart.getHours() >= lunchStartH && slotStart.getHours() < lunchEndH) continue;
        if (slotEnd.getHours() > lunchEndH && slotStart.getHours() < lunchEndH) continue;

        // Skip if after working hours
        if (slotEnd.getHours() > endH || (slotEnd.getHours() === endH && slotEnd.getMinutes() > endM)) continue;

        // Check if slot overlaps with any event
        const isBooked = dayEvents.some(e => {
          const eStart = new Date(e.start);
          const eEnd = new Date(e.end);
          return (slotStart < eEnd && slotEnd > eStart);
        });

        if (!isBooked) {
          const timeStr = slotStart.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false });
          slots.push({
            time: timeStr,
            isoTime: slotStart.toISOString()
          });
        }
      }
    }

    console.log("✅ Available slots:", slots.length, slots);
    return slots;
  } catch (e) {
    console.error("❌ Error getting available slots:", e);
    return [];
  }
}

async function createCalendarEvent(config, form) {
  try {
    if (!config) return false;

    const startTime = new Date(form.isoDateTime);
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + (config.appointmentDurationMin || 30));

    const event = {
      id: uid(),
      summary: `${form.service || "Appuntamento"} - ${form.name}`,
      description: `Nome: ${form.name}\nEmail: ${form.email}\nTelefono: ${form.phone || "—"}\nNote: ${form.message || "—"}`,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      email: form.email,
      phone: form.phone,
      message: form.message
    };

    // Save to Firestore calendar events
    const eventsSnap = await getDoc(doc(_fs, _col, "__calendar_events"));
    const allEvents = eventsSnap.exists() ? JSON.parse(eventsSnap.data().v) : [];
    allEvents.push(event);
    await setDoc(doc(_fs, _col, "__calendar_events"), { v: JSON.stringify(allEvents) });

    return true;
  } catch (e) {
    console.error("Error creating calendar event:", e);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Outfit:wght@300;400;500;600&display=swap');
@import url('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #F4F1EC; --surface: #FFFFFF; --text: #1E1E1C; --muted: #767068;
  --accent: #4E7B6E; --accent-l: #8FBDB4; --accent2: #C09E8E;
  --border: #DED9D1;
  --serif: 'Cormorant Garamond', Georgia, serif;
  --sans: 'Outfit', -apple-system, sans-serif;
  --ease: cubic-bezier(.4,0,.2,1); --t: .3s;
  --shadow: 0 2px 20px rgba(30,30,28,.06);
  --shadow-lg: 0 12px 48px rgba(30,30,28,.12);
  --max: 1080px;
}
html { scroll-behavior: smooth; }
body { background: var(--bg); color: var(--text); font-family: var(--sans); font-weight: 300; overflow-x: hidden; }
::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: var(--border); }

@keyframes fi  { from{opacity:0}         to{opacity:1} }
@keyframes su  { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
@keyframes si  { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
@keyframes sc  { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:scale(1)} }
@keyframes spin{ from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes shim{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }
.fi{animation:fi .5s ease forwards} .su{animation:su .7s var(--ease) forwards}
.si{animation:si .4s var(--ease) forwards} .sc{animation:sc .4s var(--ease) forwards}

/* ── HEADER ── */
.hdr { position:fixed; top:0; left:0; right:0; z-index:100; transition:all var(--t); }
.hdr-inner { max-width:var(--max); margin:0 auto; display:flex; flex-direction:column; align-items:center; padding:28px 40px 0; }
.hdr.on { background:rgba(255,255,255,.96); backdrop-filter:blur(16px); box-shadow:0 1px 0 var(--border); }
.hdr.on .hdr-inner { padding:14px 40px; }
.logo-w { cursor:pointer; user-select:none; transition:margin var(--t); margin-bottom:18px; }
.hdr.on .logo-w { margin-bottom:10px; }
.nav { display:flex; justify-content:center; width:100%; border-top:1px solid rgba(255,255,255,.18); overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
.nav::-webkit-scrollbar { display:none; }
.hdr.on .nav { border-top-color:var(--border); }
.nav-btn { padding:12px 22px; font-size:14px; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; background:none; border:none; font-family:var(--sans); font-weight:500; color:rgba(255,255,255,.8); transition:color var(--t); white-space:nowrap; border-bottom:2px solid transparent; flex-shrink:0; }
.nav-btn:hover { color:#fff; }
.nav-btn.on { color:#fff; border-bottom-color:rgba(255,255,255,.5); }
.hdr.on .nav-btn { color:var(--muted); }
.hdr.on .nav-btn:hover { color:var(--accent); }
.hdr.on .nav-btn.on { color:var(--accent); border-bottom-color:var(--accent); }

/* ── HERO ── */
.hero { height:100vh; position:relative; overflow:hidden; background:var(--text); }
.hero-img { position:absolute; inset:0; opacity:0; transition:opacity 1.4s ease; }
.hero-img.on { opacity:1; }
.hero-img img { width:100%; height:100%; object-fit:cover; opacity:.65; display:block; }
.hero-grad { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(30,30,28,.15) 0%, rgba(30,30,28,.35) 55%, rgba(30,30,28,.7) 100%); }
.hero-txt { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding:0 24px 90px; text-align:center; color:#fff; }
.hero-dots { position:absolute; bottom:36px; left:0; right:0; display:flex; justify-content:center; gap:8px; }

/* ── SECTION ── */
.sec { padding:96px 40px; }
.sec:nth-child(even) { background:var(--surface); }
.sec-inner { max-width:var(--max); margin:0 auto; }
.sec-tag { font-size:11px; letter-spacing:.15em; text-transform:uppercase; color:var(--accent); font-weight:500; display:block; margin-bottom:16px; }
.sec-h { font-family:var(--serif); font-size:clamp(38px,5vw,64px); font-weight:400; line-height:1.08; margin-bottom:18px; }
.sec-sub { font-size:16px; color:var(--muted); font-weight:300; line-height:1.75; max-width:540px; margin-bottom:48px; }
.sec-body { font-size:15px; color:var(--muted); line-height:1.95; font-weight:300; white-space:pre-wrap; max-width:680px; }
.sec-grid { display:grid; grid-template-columns:1fr 1fr; gap:72px; align-items:center; }

/* ── SECTION IMAGES ── */
.imgs-1 img { width:100%; height:440px; object-fit:cover; border-radius:2px; display:block; }
.imgs-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.imgs-2 img { width:100%; height:320px; object-fit:cover; border-radius:2px; display:block; }
.imgs-3 { display:grid; grid-template-columns:2fr 1fr; grid-template-rows:1fr 1fr; gap:10px; }
.imgs-3 img:first-child { grid-row:1/3; height:440px; }
.imgs-3 img { width:100%; height:210px; object-fit:cover; border-radius:2px; display:block; }

/* ── BOOKING ── */
.book-sec { background:var(--accent) !important; }
.book-sec .sec-tag { color:rgba(255,255,255,.55); }
.book-sec .sec-h { color:#fff; }
.book-sec .sec-sub { color:rgba(255,255,255,.72); }
.b-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
.b-field { width:100%; padding:14px 18px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.22); color:#fff; font-family:var(--sans); font-size:14px; font-weight:300; border-radius:2px; outline:none; transition:border-color var(--t); }
.b-field::placeholder { color:rgba(255,255,255,.45); }
.b-field:focus { border-color:rgba(255,255,255,.55); }
.b-field.b-err { border-color:#ffb3a7; }
.b-field option { color:var(--text); background:#fff; }

/* ── CONTACT ── */
.c-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:28px; margin-top:48px; }
.c-card { padding:32px; background:var(--bg); border-radius:2px; }
.c-icon { width:44px; height:44px; background:var(--surface); border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:18px; font-size:18px; box-shadow:var(--shadow); }
.c-lbl { font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; font-weight:500; }
.c-val { font-size:15px; color:var(--text); line-height:1.65; }
.c-social { display:flex; gap:16px; margin-top:32px; padding-top:32px; border-top:1px solid var(--border); }
.c-social-link { width:44px; height:44px; border-radius:50%; background:var(--surface); display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer; transition:all var(--t); box-shadow:var(--shadow); text-decoration:none; color:var(--text); }
.c-social-link:hover { background:var(--accent); color:#fff; transform:translateY(-2px); box-shadow:var(--shadow-lg); }

/* ── FOOTER ── */
.foot { padding:52px 40px; background:var(--text); color:rgba(255,255,255,.45); text-align:center; font-size:12px; letter-spacing:.06em; line-height:2; }
.foot strong { color:rgba(255,255,255,.8); font-weight:500; }

/* ── DIVIDER ── */
.divider { width:56px; height:1.5px; background:var(--accent); margin-bottom:48px; }

/* ── BUTTONS ── */
.btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:none; cursor:pointer; font-family:var(--sans); letter-spacing:.1em; text-transform:uppercase; transition:all var(--t) var(--ease); font-weight:500; border-radius:2px; }
.btn:disabled { opacity:.45; cursor:not-allowed; }
.btn-w { background:#fff; color:var(--accent); padding:15px 40px; font-size:11px; }
.btn-w:not(:disabled):hover { background:var(--bg); transform:translateY(-1px); }
.btn-d { background:var(--text); color:#fff; padding:15px 32px; font-size:10.5px; }
.btn-d:not(:disabled):hover { background:var(--accent); transform:translateY(-1px); }
.btn-o { background:transparent; color:var(--text); border:1px solid var(--border); padding:14px 28px; font-size:10.5px; }
.btn-o:not(:disabled):hover { border-color:var(--text); background:var(--text); color:#fff; }
.btn-g { background:transparent; color:var(--muted); border:none; padding:8px 10px; font-size:11px; font-family:var(--sans); }
.btn-g:hover { color:var(--text); }

/* ── INPUTS (admin) ── */
.field { width:100%; padding:12px 16px; border:1px solid var(--border); background:var(--bg); font-family:var(--sans); font-size:14px; font-weight:300; color:var(--text); outline:none; border-radius:2px; transition:border-color var(--t); }
.field:focus { border-color:var(--accent); }
.field::placeholder { color:var(--muted); }
.lbl { display:block; font-size:10.5px; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; font-weight:500; }

/* ── MODAL / DRAWER ── */
.overlay { position:fixed; inset:0; background:rgba(30,30,28,.5); backdrop-filter:blur(10px); z-index:200; }
.drawer { position:fixed; bottom:0; left:0; right:0; background:var(--surface); border-radius:22px 22px 0 0; max-height:93vh; overflow-y:auto; z-index:201; animation:si .4s var(--ease); }
.handle { width:38px; height:4px; background:var(--border); border-radius:2px; margin:14px auto 22px; }

/* ── ADMIN ── */
.admin-tabs { display:flex; border-bottom:1px solid var(--border); background:var(--surface); position:sticky; top:0; z-index:10; }
.admin-tab { flex:1; padding:14px 4px; font-size:10px; letter-spacing:.07em; text-align:center; cursor:pointer; border:none; background:transparent; font-family:var(--sans); color:var(--muted); border-bottom:2px solid transparent; transition:all var(--t); text-transform:uppercase; font-weight:500; }
.admin-tab.on { color:var(--text); border-bottom-color:var(--accent); }

/* ── SECTION ANIM ── */
.reveal { opacity:0; transform:translateY(32px); transition:opacity .7s var(--ease), transform .7s var(--ease); }
.reveal.visible { opacity:1; transform:translateY(0); }

/* ── SKEL / MISC ── */
.skel { background:linear-gradient(90deg,var(--border) 25%,#EAE5DC 50%,var(--border) 75%); background-size:200% 100%; animation:shim 1.6s infinite; }

/* ── RESPONSIVE ── */
@media(max-width:900px) {
  .sec-grid { grid-template-columns:1fr; gap:40px; }
  .c-grid { grid-template-columns:1fr; }
  .b-grid { grid-template-columns:1fr; }
}
@media(max-width:600px) {
  .sec { padding:64px 24px; }
  .hdr-inner { padding:20px 20px 0; }
  .hdr.on .hdr-inner { padding:12px 20px; }
  .nav-btn { padding:12px 12px; font-size:12px; }
  .imgs-2,.imgs-3 { grid-template-columns:1fr; }
  .imgs-3 img:first-child { grid-row:auto; height:260px; }
  .imgs-2 img,.imgs-3 img { height:220px; }
  .c-social { flex-wrap:wrap; }
}

/* ── MAP ── */
.map-container { width:100%; height:450px; border-radius:2px; margin-top:48px; box-shadow:var(--shadow); overflow:hidden; }
.leaflet-container { font-family:var(--sans); }
.leaflet-popup-content { font-family:var(--sans); font-size:14px; }
@media(max-width:600px) {
  .map-container { height:300px; }
}
`;

/* ══════════════════════════════════════════════════════════════════
   SMALL SHARED COMPONENTS
══════════════════════════════════════════════════════════════════ */
const Spin = ({ size=18, col="var(--accent)" }) => (
  <div style={{ width:size, height:size, border:`2px solid ${col}33`, borderTopColor:col, borderRadius:"50%", animation:"spin .8s linear infinite" }} />
);

const DragHandle = () => (
  <svg width="12" height="16" viewBox="0 0 12 16" fill="none" style={{ flexShrink:0, cursor:"grab", color:"var(--border)" }}>
    <circle cx="4" cy="3"  r="1.5" fill="currentColor"/>
    <circle cx="8" cy="3"  r="1.5" fill="currentColor"/>
    <circle cx="4" cy="8"  r="1.5" fill="currentColor"/>
    <circle cx="8" cy="8"  r="1.5" fill="currentColor"/>
    <circle cx="4" cy="13" r="1.5" fill="currentColor"/>
    <circle cx="8" cy="13" r="1.5" fill="currentColor"/>
  </svg>
);

const EyeOpen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

/* ══════════════════════════════════════════════════════════════════
   REVEAL WRAPPER
══════════════════════════════════════════════════════════════════ */
function Reveal({ children, delay=0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } }, { threshold: 0.12 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className="reveal" style={{ transitionDelay: `${delay}s` }}>{children}</div>;
}

/* ══════════════════════════════════════════════════════════════════
   HERO SLIDESHOW
══════════════════════════════════════════════════════════════════ */
function Hero({ images, section }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx(i => (i+1) % images.length), 5500);
    return () => clearInterval(t);
  }, [images.length]);

  return (
    <div className="hero" id="home">
      {images.length === 0
        ? <div className="hero-img on" style={{ background:"linear-gradient(135deg, #2A3F38 0%, #4E7B6E 100%)" }} />
        : images.map((src, i) => (
            <div key={i} className={`hero-img${i===idx?" on":""}`}>
              <img src={src} alt="" draggable="false" />
            </div>
          ))
      }
      <div className="hero-grad" />
      <div className="hero-txt">
        <h1 className="su" style={{ fontFamily:"var(--serif)", fontSize:"clamp(44px,6.5vw,88px)", fontWeight:300, color:"#fff", lineHeight:1.05, marginBottom:22, animationDelay:".1s", animationFillMode:"both" }}>
          {section?.title || "Benvenuti"}
        </h1>
        <p className="su" style={{ fontSize:"clamp(14px,1.8vw,19px)", color:"rgba(255,255,255,.78)", fontWeight:300, maxWidth:520, lineHeight:1.7, animationDelay:".3s", animationFillMode:"both" }}>
          {section?.subtitle || "Un luogo di ascolto e crescita"}
        </p>
        {section?.content && (
          <p className="su" style={{ fontSize:14, color:"rgba(255,255,255,.6)", marginTop:16, fontWeight:300, animationDelay:".5s", animationFillMode:"both" }}>
            {section.content}
          </p>
        )}
      </div>
      {images.length > 1 && (
        <div className="hero-dots">
          {images.map((_,i) => <button key={i} onClick={()=>setIdx(i)} style={{ width:i===idx?24:8, height:8, borderRadius:4, background:i===idx?"#fff":"rgba(255,255,255,.4)", border:"none", cursor:"pointer", padding:0, transition:"width .3s ease" }} />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION IMAGES
══════════════════════════════════════════════════════════════════ */
function SectionImgs({ images }) {
  if (!images?.length) return null;
  const cls = images.length===1 ? "imgs-1" : images.length===2 ? "imgs-2" : "imgs-3";
  return (
    <div className={cls}>
      {images.slice(0,3).map((src,i) => <img key={i} src={src} alt="" />)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   INTERACTIVE MAP
══════════════════════════════════════════════════════════════════ */
function InteractiveMap({ address }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Load Leaflet library
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => {
      // Correct coordinates for Via Armando Diaz 62, Casoria, Napoli, Italia
      // 40°54'27.1"N 14°17'40.9"E
      const lat = 40.9075;
      const lng = 14.2947;

      const map = window.L.map(mapRef.current).setView([lat, lng], 16);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      window.L.marker([lat, lng])
        .addTo(map)
        .bindPopup(`<div style="font-weight:500;margin-bottom:4px;">${address}</div><a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" style="color:#4E7B6E;text-decoration:none;">Apri su Google Maps →</a>`)
        .openPopup();

      mapInstance.current = map;
    };

    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [address]);

  return <div ref={mapRef} className="map-container" />;
}

/* ══════════════════════════════════════════════════════════════════
   BOOKING FORM
══════════════════════════════════════════════════════════════════ */
function BookingForm({ config }) {
  const [form, setForm] = useState({ name:"", email:"", phone:"", service:"", date:"", time:"", message:"" });
  const [slots, setSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const upd = k => e => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(e => ({ ...e, [k]: null })); };

  const today = new Date().toISOString().split("T")[0];
  
  // Calculate minimum date based on advance notice requirement
  const getMinDate = () => {
    const d = new Date();
    d.setHours(d.getHours() + (config?.minAdvanceNoticeHours || 2));
    return d.toISOString().split("T")[0];
  };

  const minDate = getMinDate();

  // Fetch available slots when date changes
  useEffect(() => {
    if (!form.date) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setLoadingSlots(true);
      const available = await getAvailableSlots(config, form.date);
      setSlots(available);
      setLoadingSlots(false);
    };

    fetchSlots();
  }, [form.date, config]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Nome obbligatorio";
    if (!form.email.trim()) e.email = "Email obbligatoria";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Inserisci un'email valida";
    if (form.phone && !/^[\+]?[\d\s\-\(\)]{7,15}$/.test(form.phone.trim())) e.phone = "Formato non valido (es. +39 320 0000000)";
    if (!form.date) e.date = "Seleziona una data";
    if (!form.time) e.time = "Seleziona un orario";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setBusy(true);

    // Find the selected slot to get ISO datetime
    const selectedSlot = slots.find(s => s.time === form.time);
    const formWithDateTime = { 
      ...form, 
      isoDateTime: selectedSlot?.isoTime,
      time: form.time 
    };

    // Create calendar event
    const eventCreated = await createCalendarEvent(config, formWithDateTime);
    
    // Send email
    await sendBooking(config, formWithDateTime);
    
    setBusy(false); setDone(true);
    setTimeout(() => { 
      setDone(false); 
      setForm({ name:"", email:"", phone:"", service:"", date:"", time:"", message:"" }); 
      setErrors({}); 
      setSlots([]);
    }, 4000);
  };

  const Err = ({ k }) => errors[k] ? <p style={{ fontSize:11, color:"#ffb3a7", marginTop:5 }}>{errors[k]}</p> : null;

  if (done) return (
    <div style={{ textAlign:"center", padding:"48px 0" }}>
      <div style={{ width:64, height:64, borderRadius:"50%", border:"1.5px solid rgba(255,255,255,.5)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", fontSize:28, color:"#fff" }}>✓</div>
      <p style={{ fontFamily:"var(--serif)", fontSize:28, color:"#fff", fontWeight:400, marginBottom:10 }}>Richiesta inviata!</p>
      <p style={{ color:"rgba(255,255,255,.65)", fontSize:14 }}>Ti contatteremo al più presto.</p>
    </div>
  );

  return (
    <div>
      <div className="b-grid">
        <div>
          <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Nome e Cognome *</label>
          <input className={`b-field${errors.name?" b-err":""}`} value={form.name} onChange={upd("name")} placeholder="Mario Rossi" />
          <Err k="name" />
        </div>
        <div>
          <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Email *</label>
          <input className={`b-field${errors.email?" b-err":""}`} type="email" value={form.email} onChange={upd("email")} placeholder="mario@email.it" />
          <Err k="email" />
        </div>
        <div>
          <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Telefono</label>
          <input className={`b-field${errors.phone?" b-err":""}`} value={form.phone} onChange={upd("phone")} placeholder="+39 320 0000000" />
          <Err k="phone" />
        </div>
        <div>
          <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Servizio di interesse</label>
          <select className="b-field" value={form.service} onChange={upd("service")}>
            <option value="">Seleziona...</option>
            {(config?.services || DEFAULT_SERVICES).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Data preferita *</label>
          <input className={`b-field${errors.date?" b-err":""}`} type="date" value={form.date} onChange={upd("date")} min={minDate} />
          <Err k="date" />
        </div>
        <div>
          <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Orario preferito *</label>
          {loadingSlots ? (
            <div style={{ width:"100%", padding:"14px 18px", background:"rgba(255,255,255,.1)", border:"1px solid rgba(255,255,255,.22)", borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Spin col="#fff" size={14} />
            </div>
          ) : form.date && slots.length === 0 ? (
            <div className="b-field" style={{ cursor:"default", textAlign:"center" }}>
              Nessuno slot disponibile
            </div>
          ) : (
            <select className={`b-field${errors.time?" b-err":""}`} value={form.time} onChange={upd("time")}>
              <option value="">Seleziona un orario...</option>
              {slots.map(s => <option key={s.isoTime} value={s.time}>{s.time}</option>)}
            </select>
          )}
          <Err k="time" />
        </div>
      </div>
      <div style={{ marginBottom:28 }}>
        <label className="lbl" style={{ color:"rgba(255,255,255,.55)" }}>Messaggio (opzionale)</label>
        <textarea className="b-field" value={form.message} onChange={upd("message")} rows={4} style={{ resize:"none", width:"100%" }} placeholder="Descrivi brevemente la tua richiesta..." />
      </div>
      <button className="btn btn-w" onClick={submit} disabled={busy || !form.name || !form.email || !form.date || !form.time}>
        {busy ? <Spin col="var(--accent)" /> : "Invia Richiesta →"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PUBLIC SITE
══════════════════════════════════════════════════════════════════ */
function PublicSite({ sections, heroImages, config, onLogoClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive:true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visible = sections.filter(s => s.visible).sort((a,b) => a.order - b.order);
  const homeSection = visible.find(s => s.id === "home");

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior:"smooth" });
    setActive(id);
  };

  const SocialIcons = () => {
    const social = config?.social || {};
    const icons = [
      { key: "instagram", emoji: "📷", name: "Instagram", url: social.instagram },
      { key: "facebook", emoji: "f", name: "Facebook", url: social.facebook },
      { key: "youtube", emoji: "▶️", name: "YouTube", url: social.youtube },
      { key: "tiktok", emoji: "🎵", name: "TikTok", url: social.tiktok }
    ];
    const active = icons.filter(i => i.url);
    if (!active.length) return null;
    return (
      <div className="c-social">
        {active.map(icon => (
          <a key={icon.key} href={icon.url} target="_blank" rel="noopener noreferrer" className="c-social-link" title={icon.name}>
            {icon.emoji}
          </a>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* ── HEADER ── */}
      <header className={`hdr${scrolled?" on":""}`}>
        <div className="hdr-inner">
          <div className="logo-w" onClick={onLogoClick}>
            <img src={config?.logo || LOGO} alt="Logo" style={{ height: scrolled ? 42 : 58, objectFit:"contain", transition:"height var(--t), filter var(--t)", display:"block", filter: scrolled ? "none" : "brightness(0) invert(1)" }} />
          </div>
          <nav className="nav">
            {visible.map(s => (
              <button key={s.id} className={`nav-btn${active===s.id?" on":""}`} onClick={()=>scrollTo(s.id)}>
                {s.navLabel || s.title}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <Hero images={heroImages} section={homeSection} />

      {/* ── SECTIONS ── */}
      {visible.filter(s => s.id !== "home").map((sec, i) => {
        /* BOOKING */
        if (sec.type === "booking") return (
          <section key={sec.id} id={sec.id} className="sec book-sec">
            <div className="sec-inner">
              <Reveal>
                <span className="sec-tag">{sec.tagText || sec.title}</span>
                <h2 className="sec-h" style={{ color:"#fff" }}>{sec.headingText || sec.title}</h2>
                {sec.subtitle && <p className="sec-sub" style={{ color:"rgba(255,255,255,.7)" }}>{sec.subtitle}</p>}
                <div className="divider" style={{ background:"rgba(255,255,255,.3)" }} />
              </Reveal>
              <Reveal delay={.1}><BookingForm config={config} /></Reveal>
            </div>
          </section>
        );

        /* CONTACT */
        if (sec.type === "contact") return (
          <section key={sec.id} id={sec.id} className="sec">
            <div className="sec-inner">
              <Reveal>
                <span className="sec-tag">{sec.tagText || sec.title}</span>
                <h2 className="sec-h">{sec.headingText || sec.title}</h2>
                {sec.subtitle && <p className="sec-sub">{sec.subtitle}</p>}
                <div className="divider" />
                {sec.content && <p className="sec-body" style={{ marginBottom:40 }}>{sec.content}</p>}
              </Reveal>
              <Reveal delay={.1}>
                <div className="c-grid">
                  {[
                    { icon:"📍", label:"Indirizzo", value: config?.address || "—" },
                    { icon:"📞", label:"Telefono",  value: config?.phone   || "—" },
                    { icon:"✉️", label:"Email",     value: config?.email   || "—" },
                  ].map(c => (
                    <div key={c.label} className="c-card">
                      <div className="c-icon">{c.icon}</div>
                      <div className="c-lbl">{c.label}</div>
                      <div className="c-val">{c.value}</div>
                    </div>
                  ))}
                </div>
                <SocialIcons />
              </Reveal>
              <Reveal delay={.2}>
                <InteractiveMap address={config?.address || "Via Armando Diaz 62, Casoria (Na) NAPOLI ITALIA"} />
              </Reveal>
            </div>
          </section>
        );

        /* CONTENT — alternating layout */
        const hasImgs = sec.images?.length > 0;
        const imgLeft = i % 2 === 0;
        return (
          <section key={sec.id} id={sec.id} className="sec">
            <div className="sec-inner">
              {hasImgs ? (
                <div className="sec-grid" style={{ direction: imgLeft ? "ltr" : "rtl" }}>
                  <Reveal><div style={{ direction:"ltr" }}><SectionImgs images={sec.images} /></div></Reveal>
                  <Reveal delay={.15}>
                    <div style={{ direction:"ltr" }}>
                      <span className="sec-tag">{sec.tagText || sec.title}</span>
                      <h2 className="sec-h">{sec.headingText || sec.title}</h2>
                      {sec.subtitle && <p className="sec-sub">{sec.subtitle}</p>}
                      <div className="divider" />
                      {sec.content && <p className="sec-body">{sec.content}</p>}
                    </div>
                  </Reveal>
                </div>
              ) : (
                <Reveal>
                  <span className="sec-tag">{sec.tagText || sec.title}</span>
                  <h2 className="sec-h">{sec.headingText || sec.title}</h2>
                  {sec.subtitle && <p className="sec-sub">{sec.subtitle}</p>}
                  <div className="divider" />
                  {sec.content && <p className="sec-body">{sec.content}</p>}
                </Reveal>
              )}
            </div>
          </section>
        );
      })}

      {/* ── FOOTER ── */}
      <footer className="foot">
        <p><strong>{config?.name || "Centro di Psicologia"}</strong></p>
        <p>{[config?.address, config?.phone, config?.email].filter(Boolean).join(" · ")}</p>
        <p style={{ marginTop:8, opacity:.6 }}>© {new Date().getFullYear()} · Tutti i diritti riservati</p>
      </footer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN LOGIN
══════════════════════════════════════════════════════════════════ */
function AdminLogin({ password, onAuth, onClose, logo }) {
  const [v, setV] = useState(""); const [err, setErr] = useState(false);
  const go = () => { if (v === password) onAuth(); else { setErr(true); setTimeout(() => setErr(false), 1400); } };
  return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg)" }}>
      <div className="sc" style={{ background:"var(--surface)", padding:44, width:"90%", maxWidth:340, borderRadius:4, boxShadow:"var(--shadow-lg)" }}>
        <p style={{ textAlign:"center", fontSize:11, letterSpacing:".2em", textTransform:"uppercase", color:"var(--muted)", marginBottom:6 }}>Pannello Admin</p>
        <img src={logo || LOGO} alt="Logo" style={{ height:44, objectFit:"contain", display:"block", margin:"0 auto 32px" }} />
        <label className="lbl">Password</label>
        <input className="field" type="password" value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="••••••••" style={{ marginBottom: err?8:20, borderColor: err?"#c0392b":undefined }} autoFocus />
        {err && <p style={{ fontSize:12, color:"#c0392b", marginBottom:16 }}>Password errata.</p>}
        <button onClick={go} className="btn btn-d" style={{ width:"100%", marginBottom:10 }}>Accedi</button>
        <button onClick={onClose} className="btn btn-g" style={{ width:"100%", textAlign:"center" }}>← Torna al sito</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN BUILTIN SECTION FORM (Text only)
══════════════════════════════════════════════════════════════════ */
function AdminBuiltinSectionForm({ section, onSave, onDone }) {
  const [form, setForm] = useState({
    tagText: section?.tagText || "",
    headingText: section?.headingText || "",
    subtitle: section?.subtitle || "",
    content: section?.content || "",
  });
  const [busy, setBusy] = useState(false);
  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    const data = { ...section, ...form };
    await onSave(data);
    setBusy(false);
    onDone();
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "var(--bg)", padding: 12, borderRadius: 4, marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Sezione</p>
          <p style={{ fontSize: 14, fontWeight: 500 }}>{section?.title}</p>
        </div>
        
        <div><label className="lbl">Tag (es: TEAM, SERVIZI, PRENOTA)</label><input className="field" type="text" value={form.tagText} onChange={upd("tagText")} placeholder="Es: IL NOSTRO TEAM" /></div>
        <div><label className="lbl">Heading/Titolo Principale</label><input className="field" type="text" value={form.headingText} onChange={upd("headingText")} placeholder="Es: Chi Siamo" /></div>
        <div><label className="lbl">Sottotitolo</label><input className="field" type="text" value={form.subtitle} onChange={upd("subtitle")} placeholder="Es: Il nostro team di professionisti" /></div>
        <div><label className="lbl">Contenuto/Testo Principale</label><textarea className="field" value={form.content} onChange={upd("content")} rows={8} style={{ resize: "vertical" }} placeholder="Testo della sezione..." /></div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit} disabled={busy} className="btn btn-d" style={{ flex: 1 }}>
            {busy ? <Spin /> : "Salva Modifiche"}
          </button>
          <button onClick={onDone} className="btn btn-g" style={{ padding: "15px 24px" }}>Annulla</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN SECTION FORM  (Instagram-style)
══════════════════════════════════════════════════════════════════ */
function AdminSectionForm({ section, onSave, onDone }) {
  const isNew = !section;
  const [form, setForm] = useState({
    title:    section?.title    || "",
    tagText:  section?.tagText  || "",
    headingText: section?.headingText || "",
    navLabel: section?.navLabel || "",
    subtitle: section?.subtitle || "",
    content:  section?.content  || "",
    type:     section?.type     || "content",
    visible:  section?.visible  ?? true,
  });
  const [previews, setPreviews]   = useState(section?.images || []);
  const [busy, setBusy]           = useState(false);
  const [drag, setDrag]           = useState(false);
  const fRef                      = useRef();
  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const addFiles = async files => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/")).slice(0, 6 - previews.length);
    if (!imgs.length) return;
    const b64s = await Promise.all(imgs.map(f => resizeImg(f)));
    setPreviews(p => [...p, ...b64s]);
  };

  const submit = async () => {
    if (!form.title) return;
    setBusy(true);
    const id   = section?.id || uid();
    const data = { ...(section || {}), id, ...form, images: previews, order: section?.order ?? 99, createdAt: section?.createdAt || Date.now() };
    await onSave(data);
    setBusy(false);
    onDone();
  };

  const TYPES = ["content","booking","contact"];

  return (
    <div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div><label className="lbl">Titolo Sezione *</label><input className="field" type="text" value={form.title} onChange={upd("title")} placeholder="Es: Chi Siamo" /></div>
        <div><label className="lbl">Tag (solo per le sezioni)</label><input className="field" type="text" value={form.tagText} onChange={upd("tagText")} placeholder="Es: IL NOSTRO TEAM" /></div>
        <div><label className="lbl">Heading/Titolo Principale</label><input className="field" type="text" value={form.headingText} onChange={upd("headingText")} placeholder="Es: Chi Siamo" /></div>
        <div><label className="lbl">Label nella barra di navigazione</label><input className="field" type="text" value={form.navLabel} onChange={upd("navLabel")} placeholder="Es: Chi Siamo" /></div>
        <div><label className="lbl">Sottotitolo</label><input className="field" type="text" value={form.subtitle} onChange={upd("subtitle")} placeholder="Es: Il nostro team di professionisti" /></div>
        <div><label className="lbl">Tipo di Sezione</label><select className="field" value={form.type} onChange={upd("type")}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className="lbl">Contenuto</label><textarea className="field" value={form.content} onChange={upd("content")} rows={6} style={{ resize:"vertical" }} placeholder="Testo della sezione..." /></div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <input type="checkbox" checked={form.visible} onChange={e => setForm(f => ({ ...f, visible: e.target.checked }))} id="vis" />
          <label htmlFor="vis" className="lbl" style={{ margin:0 }}>Visibile</label>
        </div>

        {/* Image Upload */}
        <div
          onDragEnter={() => setDrag(true)}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          onDragOver={e => e.preventDefault()}
          style={{
            border: `2px dashed ${drag ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 6,
            padding: 24,
            textAlign: "center",
            cursor: "pointer",
            background: drag ? "rgba(78,123,110,.05)" : "transparent",
            transition: "all var(--t)"
          }}
          onClick={() => fRef.current?.click()}
        >
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Trascina immagini qui o clicca</p>
          <input ref={fRef} type="file" multiple accept="image/*" onChange={e => addFiles(e.target.files)} style={{ display: "none" }} />
        </div>

        {previews.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4 }} />
                <button
                  onClick={() => setPreviews(p => p.filter((_, j) => j !== i))}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(255,0,0,.7)",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: "bold"
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button onClick={submit} disabled={busy || !form.title} className="btn btn-d" style={{ width: "100%" }}>
          {busy ? <Spin /> : isNew ? "Crea Sezione" : "Aggiorna Sezione"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN SECTIONS LIST
══════════════════════════════════════════════════════════════════ */
function AdminSections({ sections, onSave, onNew, onEdit }) {
  const customSections = sections.filter(s => !s.builtin);
  const builtinSections = sections.filter(s => s.builtin && s.id !== "home");
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <button onClick={onNew} className="btn btn-d" style={{ width: "100%" }}>+ Nuova Sezione</button>
      
      {builtinSections.length > 0 && (
        <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Sezioni Built-in</p>
          {builtinSections.map(sec => (
            <div key={sec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bg)", borderRadius: 4, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>{sec.title}</p>
                <p style={{ fontSize: 11, color: "var(--muted)" }}>{sec.visible ? "✓ Visibile" : "✕ Nascosta"}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onEdit(sec)} className="btn btn-o" style={{ fontSize: 11 }}>Modifica Testi</button>
                <button
                  onClick={() => onSave(sections.map(s => s.id === sec.id ? { ...s, visible: !s.visible } : s))}
                  className="btn btn-g"
                  style={{ fontSize: 11 }}
                >
                  {sec.visible ? "Nascondi" : "Mostra"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {customSections.length > 0 && (
        <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12 }}>Sezioni Personalizzate</p>
          {customSections.map(sec => (
            <div key={sec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "var(--bg)", borderRadius: 4, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 500, marginBottom: 4 }}>{sec.title}</p>
                <p style={{ fontSize: 11, color: "var(--muted)" }}>{sec.visible ? "✓ Visibile" : "✕ Nascosta"}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onEdit(sec)} className="btn btn-o" style={{ fontSize: 11 }}>Modifica</button>
                <button
                  onClick={() => onSave(sections.map(s => s.id === sec.id ? { ...s, visible: !s.visible } : s))}
                  className="btn btn-g"
                  style={{ fontSize: 11 }}
                >
                  {sec.visible ? "Nascondi" : "Mostra"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN SLIDESHOW
══════════════════════════════════════════════════════════════════ */
function AdminSlideshow({ images, onSave }) {
  const [previews, setPreviews] = useState(images);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fRef = useRef();

  const addFiles = async files => {
    const imgs = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const b64s = await Promise.all(imgs.map(f => resizeImg(f)));
    setPreviews(p => [...p, ...b64s]);
  };

  const save = async () => {
    setBusy(true);
    await onSave(previews);
    setBusy(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Hero Slideshow</p>
      <div
        onDragEnter={() => setDrag(true)}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onDragOver={e => e.preventDefault()}
        style={{
          border: `2px dashed ${drag ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 6,
          padding: 24,
          textAlign: "center",
          cursor: "pointer",
          background: drag ? "rgba(78,123,110,.05)" : "transparent",
          transition: "all var(--t)"
        }}
        onClick={() => fRef.current?.click()}
      >
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Trascina immagini qui o clicca per aggiungere</p>
        <input ref={fRef} type="file" multiple accept="image/*" onChange={e => addFiles(e.target.files)} style={{ display: "none" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        {previews.map((src, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={src} alt="" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 4 }} />
            <button
              onClick={() => setPreviews(p => p.filter((_, j) => j !== i))}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "rgba(255,0,0,.7)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: "bold"
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={busy} className="btn btn-d" style={{ width: "100%" }}>
        {busy ? <Spin /> : "Salva Slideshow"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN SETTINGS
══════════════════════════════════════════════════════════════════ */
function AdminSettings({ config, onSave }) {
  const defaultDoctors = [
    { name: "Dr. Maria Rossi", email: "maria.rossi@centro.it" },
    { name: "Dr. Marco Bianchi", email: "marco.bianchi@centro.it" },
    { name: "Dr. Giulia Verdi", email: "giulia.verdi@centro.it" }
  ];

  const [f, setF] = useState({ name:"", address:"", phone:"", email:"", adminPassword:"", ownerEmail:"", svcId:"", tplId:"", pubKey:"", services: DEFAULT_SERVICES, social: {}, logo: "", loadingImage: "", googleCalendarId: "", googleCalendarEmail: "", workingHoursStart: "09:00", workingHoursEnd: "19:00", lunchBreakStart: "13:00", lunchBreakEnd: "14:00", appointmentDurationMin: 30, timeZone: "Europe/Rome", minAdvanceNoticeHours: 2, workDays: [1,2,3,4,5], doctors: defaultDoctors, ...config, services: (config?.services || DEFAULT_SERVICES) });
  const [servicesText, setServicesText] = useState((config?.services || DEFAULT_SERVICES).join("\n"));
  const [ok, setOk] = useState(false);
  const [logoPreview, setLogoPreview] = useState(config?.logo || "");
  const [loadingPreview, setLoadingPreview] = useState(config?.loadingImage || "");
  const upd = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const updSocial = k => e => setF(p => ({ ...p, social: { ...p.social, [k]: e.target.value } }));

  const handleImageUpload = async (file, type) => {
    if (!file || !file.type.startsWith("image/")) return;
    const b64 = await resizeImg(file, 2000);
    if (type === "logo") {
      setLogoPreview(b64);
      setF(p => ({ ...p, logo: b64 }));
    } else if (type === "loading") {
      setLoadingPreview(b64);
      setF(p => ({ ...p, loadingImage: b64 }));
    }
  };

  const toggleWorkDay = day => {
    setF(p => ({
      ...p,
      workDays: p.workDays.includes(day) 
        ? p.workDays.filter(d => d !== day)
        : [...p.workDays, day].sort()
    }));
  };

  const save = async () => {
    const processed = servicesText.split("\n").map(s => s.trim()).filter(Boolean);
    await onSave({ ...f, services: processed });
    setOk(true); setTimeout(()=>setOk(false),2200);
  };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <p style={{ fontSize:12, fontWeight:600, letterSpacing:".07em", textTransform:"uppercase", color:"var(--muted)", marginBottom:4 }}>Impostazioni</p>
      <div><label className="lbl">Nome Centro</label><input className="field" type="text" value={f.name} onChange={upd("name")} placeholder="Centro di Psicologia XYZ" /></div>
      <div><label className="lbl">Indirizzo</label><input className="field" type="text" value={f.address} onChange={upd("address")} placeholder="Via Roma 1, 20121 Milano" /></div>
      <div><label className="lbl">Telefono</label><input className="field" type="text" value={f.phone} onChange={upd("phone")} placeholder="+39 02 0000000" /></div>
      <div><label className="lbl">Email pubblica</label><input className="field" type="email" value={f.email} onChange={upd("email")} placeholder="info@centroXYZ.it" /></div>
      <div><label className="lbl">Password Admin</label><input className="field" type="password" value={f.adminPassword} onChange={upd("adminPassword")} placeholder="Nuova password..." /></div>
      
      {/* LOGO UPLOAD */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Logo Navbar</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, marginBottom:14 }}>
          Carica il logo da visualizzare nella barra di navigazione.
        </p>
        {logoPreview && (
          <div style={{ marginBottom:16, padding:16, background:"var(--bg)", borderRadius:4, textAlign:"center" }}>
            <img src={logoPreview} alt="Logo preview" style={{ maxWidth:"100%", maxHeight:80, objectFit:"contain" }} />
            <button onClick={() => { setLogoPreview(""); setF(p => ({ ...p, logo: "" })); }} className="btn btn-g" style={{ fontSize:11, marginTop:8 }}>Rimuovi Logo</button>
          </div>
        )}
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], "logo")}
            style={{ width:"100%", padding:"12px 16px", border:"1px solid var(--border)", borderRadius:2, cursor:"pointer" }}
          />
        </div>
      </div>

      {/* LOADING IMAGE UPLOAD */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Immagine Loading</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, marginBottom:14 }}>
          Carica l'immagine da visualizzare durante il caricamento del sito.
        </p>
        {loadingPreview && (
          <div style={{ marginBottom:16, padding:16, background:"var(--bg)", borderRadius:4, textAlign:"center" }}>
            <img src={loadingPreview} alt="Loading preview" style={{ maxWidth:"100%", maxHeight:120, objectFit:"contain" }} />
            <button onClick={() => { setLoadingPreview(""); setF(p => ({ ...p, loadingImage: "" })); }} className="btn btn-g" style={{ fontSize:11, marginTop:8 }}>Rimuovi Immagine</button>
          </div>
        )}
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0], "loading")}
            style={{ width:"100%", padding:"12px 16px", border:"1px solid var(--border)", borderRadius:2, cursor:"pointer" }}
          />
        </div>
      </div>

      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <label className="lbl">Servizi Prenotazione</label>
        <p style={{ fontSize:11, color:"var(--muted)", marginBottom:8, lineHeight:1.6 }}>Un servizio per riga — appaiono nel menu a tendina del form di prenotazione.</p>
        <textarea className="field" value={servicesText} onChange={e => setServicesText(e.target.value)} rows={6} style={{ resize:"vertical" }} />
      </div>

      {/* GOOGLE CALENDAR SECTION */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Disponibilità & Prenotazioni (Google Calendar)</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, marginBottom:14 }}>
          Configura la disponibilità per il sistema di prenotazione automatico.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div><label className="lbl">Google Calendar ID (Email)</label><input className="field" type="email" value={f.googleCalendarId} onChange={upd("googleCalendarId")} placeholder="centromentevivahelp@gmail.com" /></div>
          
          <div style={{ background:"var(--bg)", padding:12, borderRadius:4 }}>
            <p style={{ fontSize:11, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", color:"var(--muted)", marginBottom:10 }}>Giorni di Lavoro</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
              {[{d:1,l:"Lunedì"},{d:2,l:"Martedì"},{d:3,l:"Mercoledì"},{d:4,l:"Giovedì"},{d:5,l:"Venerdì"},{d:6,l:"Sabato"},{d:0,l:"Domenica"}].map(({d,l}) => (
                <label key={d} style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:12 }}>
                  <input type="checkbox" checked={f.workDays.includes(d)} onChange={() => toggleWorkDay(d)} />
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label className="lbl">Orario Inizio</label><input className="field" type="time" value={f.workingHoursStart} onChange={upd("workingHoursStart")} /></div>
            <div><label className="lbl">Orario Fine</label><input className="field" type="time" value={f.workingHoursEnd} onChange={upd("workingHoursEnd")} /></div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div><label className="lbl">Pausa Pranzo Inizio</label><input className="field" type="time" value={f.lunchBreakStart} onChange={upd("lunchBreakStart")} /></div>
            <div><label className="lbl">Pausa Pranzo Fine</label><input className="field" type="time" value={f.lunchBreakEnd} onChange={upd("lunchBreakEnd")} /></div>
          </div>

          <div><label className="lbl">Durata Minima Appuntamento (minuti)</label><input className="field" type="number" value={f.appointmentDurationMin} onChange={upd("appointmentDurationMin")} min="15" step="15" /></div>
          
          <div><label className="lbl">Preavviso Minimo (ore)</label><input className="field" type="number" value={f.minAdvanceNoticeHours} onChange={upd("minAdvanceNoticeHours")} min="0" step="1" /></div>

          <div><label className="lbl">Fuso Orario</label><select className="field" value={f.timeZone} onChange={upd("timeZone")}>
            <option value="Europe/Rome">Europe/Rome (Napoli)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Chicago">America/Chicago</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Australia/Sydney">Australia/Sydney</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
          </select></div>
        </div>
      </div>

      {/* SOCIAL SECTION */}
      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Social Media</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, marginBottom:14 }}>
          Inserisci i link ai tuoi profili social. Verranno visualizzati nella sezione contatti solo se compilati.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div><label className="lbl">Link Instagram</label><input className="field" type="text" value={f.social?.instagram || ""} onChange={updSocial("instagram")} placeholder="https://instagram.com/tuoprofilo" /></div>
          <div><label className="lbl">Link Facebook</label><input className="field" type="text" value={f.social?.facebook || ""} onChange={updSocial("facebook")} placeholder="https://facebook.com/tuopagina" /></div>
          <div><label className="lbl">Link YouTube</label><input className="field" type="text" value={f.social?.youtube || ""} onChange={updSocial("youtube")} placeholder="https://youtube.com/tucanale" /></div>
          <div><label className="lbl">Link TikTok</label><input className="field" type="text" value={f.social?.tiktok || ""} onChange={updSocial("tiktok")} placeholder="https://tiktok.com/@tuoprofilo" /></div>
        </div>
      </div>

      <div style={{ borderTop:"1px solid var(--border)", paddingTop:16 }}>
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Email Prenotazioni (EmailJS)</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, marginBottom:14 }}>
          Configura <a href="https://emailjs.com" target="_blank" rel="noopener noreferrer" style={{ color:"var(--accent)" }}>emailjs.com</a> per ricevere le richieste di appuntamento via email.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div><label className="lbl">Email ricezione prenotazioni</label><input className="field" type="email" value={f.ownerEmail} onChange={upd("ownerEmail")} placeholder="info@centroXYZ.it" /></div>
          <div><label className="lbl">EmailJS Service ID</label><input className="field" type="text" value={f.svcId} onChange={upd("svcId")} placeholder="service_xxxxxxx" /></div>
          <div><label className="lbl">EmailJS Template ID</label><input className="field" type="text" value={f.tplId} onChange={upd("tplId")} placeholder="template_xxxxxxx" /></div>
          <div><label className="lbl">EmailJS Public Key</label><input className="field" type="text" value={f.pubKey} onChange={upd("pubKey")} placeholder="xxxxxxxxxxxxxxxxxxxx" /></div>
        </div>
      </div>

      <div style={{ background:"var(--surface)", padding:14, borderRadius:8, marginBottom:16 }}>
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:8 }}>Dottori del Centro</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7, marginBottom:14 }}>
          Aggiungi i dottori che riceveranno le notifiche quando gli appuntamenti vengono assegnati.
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {(f.doctors || defaultDoctors).map((doc, idx) => (
            <div key={idx} style={{ border:"1px solid var(--border)", borderRadius:6, padding:12, display:"flex", gap:10 }}>
              <input 
                type="text" 
                placeholder="Nome Dottore" 
                value={doc.name} 
                onChange={(e) => { const newDocs = [...(f.doctors || defaultDoctors)]; newDocs[idx].name = e.target.value; setF(p => ({ ...p, doctors: newDocs })); }}
                style={{ flex:1, padding:8, border:"1px solid var(--border)", borderRadius:4, fontFamily:"Outfit, sans-serif" }}
              />
              <input 
                type="email" 
                placeholder="email@centro.it" 
                value={doc.email} 
                onChange={(e) => { const newDocs = [...(f.doctors || defaultDoctors)]; newDocs[idx].email = e.target.value; setF(p => ({ ...p, doctors: newDocs })); }}
                style={{ flex:1, padding:8, border:"1px solid var(--border)", borderRadius:4, fontFamily:"Outfit, sans-serif" }}
              />
              {(f.doctors || defaultDoctors).length > 1 && (
                <button 
                  onClick={() => { const newDocs = (f.doctors || defaultDoctors).filter((_, i) => i !== idx); setF(p => ({ ...p, doctors: newDocs })); }}
                  style={{ padding:"8px 12px", backgroundColor:"#D1505A", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontWeight:600 }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {(f.doctors || defaultDoctors).length < 10 && (
            <button 
              onClick={() => { setF(p => ({ ...p, doctors: [...(p.doctors || defaultDoctors), { name: "", email: "" }] })); }}
              style={{ padding:10, backgroundColor:"#4E7B6E", color:"white", border:"none", borderRadius:6, cursor:"pointer", fontWeight:600 }}
            >
              + Aggiungi Dottore
            </button>
          )}
        </div>
      </div>

      <button onClick={save} className="btn btn-d" style={{ width:"100%" }}>{ok?"✓ Salvato!":"Salva Impostazioni"}</button>
      <div style={{ background:"var(--bg)", padding:"14px 16px", borderRadius:4 }}>
        <p style={{ fontSize:11, fontWeight:600, letterSpacing:".08em", textTransform:"uppercase", marginBottom:6, color:"var(--muted)" }}>🔑 Accesso Admin</p>
        <p style={{ fontSize:12, color:"var(--muted)", lineHeight:1.7 }}>Clicca <strong>5 volte rapide</strong> sul logo per aprire il pannello admin.</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN VIEW
══════════════════════════════════════════════════════════════════ */
// Calendar Management Component
function CalendarManagement({ fs, col, config, onBack }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const snap = await getDoc(doc(fs, col, "__calendar_events"));
      if (snap.exists() && snap.data().v) {
        setAppointments(JSON.parse(snap.data().v));
      }
    } catch (e) {
      console.error("Error loading appointments:", e);
    }
  };

  const saveAppointments = async (newAppointments) => {
    try {
      await setDoc(doc(fs, col, "__calendar_events"), { v: JSON.stringify(newAppointments) });
      setAppointments(newAppointments);
    } catch (e) {
      console.error("Error saving appointments:", e);
    }
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const getAppointmentsForDay = (day) => {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return appointments.filter(apt => {
      const aptDate = new Date(apt.start);
      return aptDate.getFullYear() === targetDate.getFullYear() && aptDate.getMonth() === targetDate.getMonth() && aptDate.getDate() === targetDate.getDate();
    });
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    setLoading(true);
    try {
      if (config?.svcId && config?.tplId && config?.pubKey) {
        await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: config.svcId, template_id: config.tplId, user_id: config.pubKey,
            template_params: {
              to_email: selectedAppointment.email,
              nome: selectedAppointment.name,
              messaggio: `Purtroppo l'appuntamento del ${new Date(selectedAppointment.start).toLocaleDateString("it-IT")} è stato cancellato. Contattaci per riprogrammare.`
            }
          })
        });
      }
      const newAppointments = appointments.filter(apt => apt.id !== selectedAppointment.id);
      await saveAppointments(newAppointments);
      setModal(null);
      setSelectedAppointment(null);
      setSelectedDay(null);
    } catch (e) {
      console.error("Error deleting appointment:", e);
    }
    setLoading(false);
  };

  const handleReschedule = async (newDateTime) => {
    if (!selectedAppointment) return;
    setLoading(true);
    try {
      const updatedAppointments = appointments.map(apt => {
        if (apt.id === selectedAppointment.id) {
          const newEnd = new Date(newDateTime);
          newEnd.setMinutes(newEnd.getMinutes() + (config?.appointmentDurationMin || 30));
          return { ...apt, start: newDateTime, end: newEnd.toISOString() };
        }
        return apt;
      });

      if (config?.svcId && config?.tplId && config?.pubKey) {
        await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: config.svcId, template_id: config.tplId, user_id: config.pubKey,
            template_params: {
              to_email: selectedAppointment.email,
              nome: selectedAppointment.name,
              data: new Date(newDateTime).toLocaleDateString("it-IT"),
              ora: new Date(newDateTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
              messaggio: `Il tuo appuntamento è stato riprogrammato.`
            }
          })
        });
      }
      await saveAppointments(updatedAppointments);
      setModal(null);
      setSelectedAppointment(null);
    } catch (e) {
      console.error("Error rescheduling:", e);
    }
    setLoading(false);
  };

  const handleAssignDoctor = async (doctorName, doctorEmail) => {
    if (!selectedAppointment) return;
    setLoading(true);
    try {
      const updatedAppointments = appointments.map(apt => {
        if (apt.id === selectedAppointment.id) {
          return { ...apt, assignedDoctor: doctorName, assignedDoctorEmail: doctorEmail };
        }
        return apt;
      });

      if (config?.svcId && config?.tplId && config?.pubKey) {
        await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: config.svcId, template_id: config.tplId, user_id: config.pubKey,
            template_params: {
              to_email: doctorEmail,
              nome: doctorName,
              servizio: selectedAppointment.service,
              data: new Date(selectedAppointment.start).toLocaleDateString("it-IT"),
              ora: new Date(selectedAppointment.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
              messaggio: `Un nuovo appuntamento è stato assegnato a te.`
            }
          })
        });
      }
      await saveAppointments(updatedAppointments);
      setModal(null);
      setSelectedAppointment(null);
    } catch (e) {
      console.error("Error assigning doctor:", e);
    }
    setLoading(false);
  };

  const handleEditDuration = async (newDurationMinutes) => {
    if (!selectedAppointment) return;
    setLoading(true);
    try {
      const newEnd = new Date(selectedAppointment.start);
      newEnd.setMinutes(newEnd.getMinutes() + newDurationMinutes);

      const updatedAppointments = appointments.map(apt => {
        if (apt.id === selectedAppointment.id) {
          return { ...apt, end: newEnd.toISOString() };
        }
        return apt;
      });

      await saveAppointments(updatedAppointments);
      setModal(null);
      setSelectedAppointment(null);
    } catch (e) {
      console.error("Error editing duration:", e);
    }
    setLoading(false);
  };

  const monthName = currentDate.toLocaleString("it-IT", { month: "long", year: "numeric" });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const doctors = config?.doctors || [
    { name: "Dr. Maria Rossi", email: "maria.rossi@centro.it" },
    { name: "Dr. Marco Bianchi", email: "marco.bianchi@centro.it" },
    { name: "Dr. Giulia Verdi", email: "giulia.verdi@centro.it" }
  ];

  return (
    <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto", fontFamily: "Outfit, sans-serif", color: "#1E1E1C" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "30px" }}>
        <button onClick={onBack} style={{ padding: "10px 20px", backgroundColor: "#4E7B6E", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>← Admin</button>
        <h1 style={{ fontSize: "32px", margin: "0", color: "#4E7B6E" }}>Gestione Appuntamenti</h1>
      </div>

      {!selectedDay ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="btn" style={{ padding: "10px 15px" }}>← Precedente</button>
            <h2 style={{ fontSize: "24px", margin: "0" }}>{monthName}</h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="btn" style={{ padding: "10px 15px" }}>Prossimo →</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", backgroundColor: "#F4F1EC", padding: "20px", borderRadius: "12px" }}>
            {["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"].map(d => <div key={d} style={{ fontWeight: "700", textAlign: "center", padding: "10px", color: "#4E7B6E", fontSize: "14px" }}>{d}</div>)}
            {days.map((day, idx) => (
              <div key={idx} onClick={() => day !== null && setSelectedDay({ date: day })} style={{ aspectRatio: "1", backgroundColor: day === null ? "transparent" : "white", border: day === null ? "none" : "1px solid #E0DDD8", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px", minHeight: "80px", cursor: day !== null ? "pointer" : "default" }}>
                {day !== null && (
                  <>
                    <div style={{ fontWeight: "700", fontSize: "16px" }}>{day}</div>
                    {getAppointmentsForDay(day).length > 0 && <div style={{ fontSize: "12px", backgroundColor: "#4E7B6E", color: "white", padding: "4px 8px", borderRadius: "4px", width: "fit-content" }}>{getAppointmentsForDay(day).length} app.</div>}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <button onClick={() => setSelectedDay(null)} className="btn" style={{ marginBottom: "20px", padding: "10px 20px" }}>← Torna al Mese</button>
          <h2 style={{ color: "#4E7B6E" }}>{new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay.date).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {getAppointmentsForDay(selectedDay.date).length === 0 ? (
              <p style={{ textAlign: "center", color: "#999", padding: "40px", fontSize: "16px" }}>Nessun appuntamento per questo giorno</p>
            ) : (
              getAppointmentsForDay(selectedDay.date)
                .sort((a, b) => new Date(a.start) - new Date(b.start))
                .map(apt => (
                  <div key={apt.id} onClick={() => setSelectedAppointment(apt)} style={{ backgroundColor: "white", border: "2px solid #E0DDD8", borderRadius: "8px", padding: "15px", cursor: "pointer", display: "flex", alignItems: "center", gap: "20px" }}>
                    <div style={{ fontWeight: "700", fontSize: "18px", color: "#4E7B6E", minWidth: "80px" }}>
                      {new Date(apt.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>
                        {Math.round((new Date(apt.end) - new Date(apt.start)) / 60000)} min
                      </div>
                    </div>
                    <div style={{ flex: 1, fontSize: "16px", fontWeight: "600" }}>{apt.service}</div>
                    <div style={{ backgroundColor: "#F4F1EC", padding: "6px 12px", borderRadius: "6px", fontSize: "14px", fontWeight: "600" }}>{apt.assignedDoctor || "⚠️ Non Assegnato"}</div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {selectedAppointment && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", maxWidth: "500px", width: "90%" }}>
            <h3>Dettagli Appuntamento</h3>
            <p><strong>Servizio:</strong> {selectedAppointment.service}</p>
            <p><strong>Data:</strong> {new Date(selectedAppointment.start).toLocaleDateString("it-IT")}</p>
            <p><strong>Ora Inizio:</strong> {new Date(selectedAppointment.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
            <p><strong>Ora Fine:</strong> {new Date(selectedAppointment.end).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>
            <p><strong>Durata:</strong> {Math.round((new Date(selectedAppointment.end) - new Date(selectedAppointment.start)) / 60000)} minuti</p>
            <p><strong>Dottore:</strong> {selectedAppointment.assignedDoctor || "Non assegnato"}</p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "20px" }}>
              <button onClick={() => setModal("duration")} className="btn" style={{ backgroundColor: "#7A6C5D", color: "white", padding: "10px 20px" }}>Cambia Durata</button>
              <button onClick={() => setModal("assign")} className="btn" style={{ backgroundColor: "#4E7B6E", color: "white", padding: "10px 20px" }}>{selectedAppointment.assignedDoctor ? "Riassegna" : "Assegna"}</button>
              <button onClick={() => setModal("reschedule")} className="btn" style={{ backgroundColor: "#9B7E3A", color: "white", padding: "10px 20px" }}>Riprogramma</button>
              <button onClick={() => setModal("delete")} className="btn" style={{ backgroundColor: "#D1505A", color: "white", padding: "10px 20px" }}>Elimina</button>
              <button onClick={() => setSelectedAppointment(null)} className="btn" style={{ backgroundColor: "#999", color: "white", padding: "10px 20px" }}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {modal === "delete" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", maxWidth: "500px", width: "90%" }}>
            <h3>Elimina Appuntamento?</h3>
            <p>Questa azione non può essere annullata.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleDeleteAppointment} disabled={loading} className="btn" style={{ backgroundColor: "#D1505A", color: "white", padding: "10px 20px" }}>{loading ? "Eliminando..." : "Conferma"}</button>
              <button onClick={() => setModal(null)} className="btn" style={{ backgroundColor: "#999", color: "white", padding: "10px 20px" }}>Annulla</button>
            </div>
          </div>
        </div>
      )}

      {modal === "reschedule" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <RescheduleModal appointment={selectedAppointment} config={config} onConfirm={handleReschedule} onCancel={() => setModal(null)} loading={loading} />
        </div>
      )}

      {modal === "assign" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <AssignDoctorModal doctors={doctors} onConfirm={handleAssignDoctor} onCancel={() => setModal(null)} loading={loading} />
        </div>
      )}

      {modal === "duration" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <EditDurationModal appointment={selectedAppointment} onConfirm={handleEditDuration} onCancel={() => setModal(null)} loading={loading} />
        </div>
      )}
    </div>
  );
}

function RescheduleModal({ appointment, config, onConfirm, onCancel, loading }) {
  const [newDate, setNewDate] = useState(new Date(appointment.start).toISOString().split("T")[0]);
  const [newTime, setNewTime] = useState(new Date(appointment.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));

  const handleConfirm = () => {
    const [h, m] = newTime.split(":").map(Number);
    const dateTime = new Date(newDate);
    dateTime.setHours(h, m, 0, 0);
    onConfirm(dateTime.toISOString());
  };

  return (
    <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", maxWidth: "500px", width: "90%" }}>
      <h3>Riprogramma Appuntamento</h3>
      <div style={{ marginBottom: "15px" }}>
        <label>Nuova Data:</label>
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #E0DDD8", borderRadius: "6px", marginTop: "5px" }} />
      </div>
      <div style={{ marginBottom: "15px" }}>
        <label>Nuovo Orario:</label>
        <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: "100%", padding: "10px", border: "1px solid #E0DDD8", borderRadius: "6px", marginTop: "5px" }} />
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={handleConfirm} disabled={loading} className="btn" style={{ backgroundColor: "#9B7E3A", color: "white", padding: "10px 20px" }}>{loading ? "Salvando..." : "Conferma"}</button>
        <button onClick={onCancel} className="btn" style={{ backgroundColor: "#999", color: "white", padding: "10px 20px" }}>Annulla</button>
      </div>
    </div>
  );
}

function AssignDoctorModal({ doctors, onConfirm, onCancel, loading }) {
  return (
    <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", maxWidth: "500px", width: "90%" }}>
      <h3>Assegna Dottore</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        {doctors.map((doctor) => (
          <button key={doctor.email} onClick={() => onConfirm(doctor.name, doctor.email)} disabled={loading} style={{ padding: "15px", backgroundColor: "#4E7B6E", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>
            {doctor.name}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="btn" style={{ backgroundColor: "#999", color: "white", padding: "10px 20px" }}>Annulla</button>
    </div>
  );
}

function EditDurationModal({ appointment, onConfirm, onCancel, loading }) {
  const currentDuration = Math.round((new Date(appointment.end) - new Date(appointment.start)) / 60000);
  const [duration, setDuration] = useState(currentDuration);

  const quickOptions = [15, 20, 30, 45, 60, 90, 120];

  return (
    <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", maxWidth: "500px", width: "90%" }}>
      <h3>Cambia Durata Appuntamento</h3>
      <p style={{ marginTop: "10px", marginBottom: "20px" }}>
        <strong>Ora Inizio:</strong> {new Date(appointment.start).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}<br />
        <strong>Durata Attuale:</strong> {currentDuration} minuti
      </p>
      
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "10px", fontWeight: "600" }}>Durata (minuti):</label>
        <input 
          type="number" 
          value={duration} 
          onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 5))}
          min="5"
          step="5"
          style={{ width: "100%", padding: "10px", border: "1px solid #E0DDD8", borderRadius: "6px", fontSize: "16px" }}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <p style={{ fontSize: "12px", fontWeight: "600", color: "#999", marginBottom: "10px" }}>Opzioni rapide:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
          {quickOptions.map(opt => (
            <button
              key={opt}
              onClick={() => setDuration(opt)}
              style={{
                padding: "8px",
                backgroundColor: duration === opt ? "#4E7B6E" : "#F4F1EC",
                color: duration === opt ? "white" : "#1E1E1C",
                border: "1px solid " + (duration === opt ? "#4E7B6E" : "#E0DDD8"),
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              {opt}m
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: "12px", color: "#999", marginBottom: "20px" }}>
        <strong>Nuova ora fine:</strong> {new Date(new Date(appointment.start).getTime() + duration * 60000).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
      </p>

      <div style={{ display: "flex", gap: "10px" }}>
        <button 
          onClick={() => onConfirm(duration)} 
          disabled={loading} 
          className="btn" 
          style={{ flex: 1, backgroundColor: "#7A6C5D", color: "white", padding: "10px 20px" }}
        >
          {loading ? "Salvando..." : "Salva Durata"}
        </button>
        <button 
          onClick={onCancel} 
          className="btn" 
          style={{ flex: 1, backgroundColor: "#999", color: "white", padding: "10px 20px" }}
        >
          Annulla
        </button>
      </div>
    </div>
  );
}

function AdminView({ authed, onAuth, sections, heroImages, config, tab, setTab, onSaveSections, onSaveHero, onSaveConfig, onClose, editing, setEditing }) {
  if (!authed) return <AdminLogin password={config?.adminPassword || DEF_PWD} onAuth={onAuth} onClose={onClose} logo={config?.logo} />;

  const handleSaveSection = async (data) => {
    const exists = sections.find(s => s.id === data.id);
    const updated = exists ? sections.map(s => s.id===data.id ? data : s) : [...sections, data];
    await onSaveSections(updated);
  };

  const [showCalendar, setShowCalendar] = useState(false);

  const tabs = [
    { id:"sections", label:"Sezioni"    },
    { id:"form",     label: editing ? (editing?.builtin ? "Modifica Testi" : "Modifica") : "Nuova" },
    { id:"hero",     label:"Slideshow"  },
    { id:"settings", label:"Config"     },
    { id:"calendar", label:"Calendario" },
  ];

  if (showCalendar) {
    return <CalendarManagement fs={_fs} col={_col} config={config} onBack={() => setShowCalendar(false)} />;
  }

  return (
    <div style={{ background:"var(--bg)", minHeight:"100vh" }}>
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <img src={config?.logo || LOGO} alt="Logo" style={{ height:32, objectFit:"contain" }} />
        <span style={{ fontFamily:"var(--serif)", fontSize:16, fontWeight:300, letterSpacing:".18em", color:"var(--muted)" }}>ADMIN</span>
        <button onClick={onClose} className="btn btn-g" style={{ fontSize:11 }}>← Sito</button>
      </div>
      <div className="admin-tabs">
        {tabs.map(t => <button key={t.id} className={`admin-tab${tab===t.id?" on":""}`} onClick={() => { if (t.id === "calendar") { setShowCalendar(true); } else { setTab(t.id); if (t.id!=="form") setEditing(null); } }}>{t.label}</button>)}
      </div>
      <div style={{ padding:20, maxWidth:600, margin:"0 auto" }}>
        {tab==="sections" && <AdminSections sections={sections} onSave={onSaveSections} onNew={()=>{setEditing(null);setTab("form");}} onEdit={s=>{setEditing(s);setTab("form");}} />}
        {tab==="form"     && editing?.builtin && <AdminBuiltinSectionForm key={editing?.id} section={editing} onSave={handleSaveSection} onDone={()=>{setTab("sections");setEditing(null);}} />}
        {tab==="form"     && !editing?.builtin && <AdminSectionForm key={editing?.id||"new"} section={editing} onSave={handleSaveSection} onDone={()=>{setTab("sections");setEditing(null);}} />}
        {tab==="hero"     && <AdminSlideshow images={heroImages} onSave={onSaveHero} />}
        {tab==="settings" && <AdminSettings config={config} onSave={onSaveConfig} />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════════ */
export default function App() {
  const [view,       setView]       = useState("site"); // "site" | "admin"
  const [sections,   setSections]   = useState(DEFAULT_SECTIONS);
  const [heroImages, setHeroImages] = useState([]);
  const [config,     setConfig]     = useState({});
  const [loading,    setLoading]    = useState(true);
  const [authed,     setAuthed]     = useState(false);
  const [tab,        setTab]        = useState("sections");
  const [editing,    setEditing]    = useState(null);
  const logoClicks = useRef(0);
  const logoTimer  = useRef(null);

  useEffect(() => {
    (async () => {
      const [secs, hero, cfg] = await Promise.all([
        db.getSections(),
        db.getHero(),
        db.get("config", {})
      ]);
      setSections(secs); setHeroImages(hero); setConfig(cfg);
      setLoading(false);
    })();
  }, []);

  const handleLogo = () => {
    logoClicks.current++;
    clearTimeout(logoTimer.current);
    logoTimer.current = setTimeout(() => { logoClicks.current = 0; }, 2000);
    if (logoClicks.current >= 5) { logoClicks.current = 0; setView("admin"); }
  };

  const saveSections = async secs => { setSections(secs); await db.saveSections(secs); };
  const saveHero     = async imgs => { setHeroImages(imgs); await db.saveHero(imgs); };
  const saveConfig   = async cfg  => { setConfig(cfg); await db.set("config", cfg); };

  if (loading) return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ height:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:24, background:"var(--bg)" }}>
        <img src={config?.loadingImage || LOGO} alt="Loading" style={{ height: config?.loadingImage ? 120 : 52, objectFit:"contain" }} />
        <Spin size={22} />
      </div>
    </>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {view === "site" && (
        <PublicSite sections={sections} heroImages={heroImages} config={config} onLogoClick={handleLogo} />
      )}
      {view === "admin" && (
        <AdminView
          authed={authed} onAuth={() => setAuthed(true)}
          sections={sections} heroImages={heroImages} config={config}
          tab={tab} setTab={setTab}
          onSaveSections={saveSections} onSaveHero={saveHero} onSaveConfig={saveConfig}
          onClose={() => setView("site")}
          editing={editing} setEditing={setEditing}
        />
      )}
    </>
  );
}
