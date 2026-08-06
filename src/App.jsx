import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIN_TYPES = {
  worked:  { label: "Worked Here",      shape: "pin",     legend: "▼" },
  layover: { label: "Layover / Transit", shape: "circle",  legend: "●" },
  remote:  { label: "Remote Customer",  shape: "diamond", legend: "◆" },
};

const TEAM_COLORS = [
  "#f97316","#22c55e","#a855f7","#ec4899","#06b6d4","#eab308","#ef4444","#14b8a6",
];
const COLOR_NAMES = ["Orange","Green","Purple","Pink","Cyan","Yellow","Red","Teal"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normPin = (row) => ({ ...row, userId: row.user_id });

// Turns a Nominatim search result into a short, readable label like
// "Elkins, WV" or "Banff, Canada" for prefilling the city field.
function shortLabel(r) {
  const a = r.address || {};
  const place = a.city || a.town || a.village || a.hamlet || a.municipality || a.county
    || (r.display_name ? r.display_name.split(",")[0] : "Unnamed spot");
  const region = a.state || a.province || "";
  const cc = a.country_code ? a.country_code.toUpperCase() : "";
  if (region && (cc === "US" || cc === "CA")) return `${place}, ${region}`;
  if (a.country) return `${place}, ${a.country}`;
  return place;
}

// ─── Pin Shapes ───────────────────────────────────────────────────────────────

function PinShape({ shape, color, size = 20 }) {
  if (shape === "pin") return (
    <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={{ filter:`drop-shadow(0 2px 5px ${color}99)`, display:"block" }}>
      <circle cx="10" cy="10" r="8" fill={color} opacity="0.15" />
      <path d="M10 0C6.13 0 3 3.13 3 7c0 5.25 7 14 7 14s7-8.75 7-14c0-3.87-3.13-7-7-7z" fill={color} />
      <circle cx="10" cy="7.5" r="2.8" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
  if (shape === "circle") return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ filter:`drop-shadow(0 2px 5px ${color}99)`, display:"block" }}>
      <circle cx="10" cy="10" r="8" fill={color} opacity="0.15" />
      <circle cx="10" cy="10" r="6" fill={color} />
      <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
  if (shape === "diamond") return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ filter:`drop-shadow(0 2px 5px ${color}99)`, display:"block" }}>
      <polygon points="10,1 19,10 10,19 1,10" fill={color} opacity="0.15" />
      <polygon points="10,3 17,10 10,17 3,10" fill={color} />
      <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
  return null;
}

// Plain-HTML-string equivalents of PinShape, for Leaflet's native L.divIcon
// (which renders raw HTML, not React) — used for actual map markers so
// Leaflet handles their positioning natively instead of us recalculating
// pixel coordinates by hand on every pan/zoom.
function pinShapeHTML(shape, color, size = 20) {
  const shadow = `filter:drop-shadow(0 2px 5px ${color}99);display:block;`;
  if (shape === "pin") return `
    <svg width="${size}" height="${size * 1.4}" viewBox="0 0 20 28" style="${shadow}">
      <circle cx="10" cy="10" r="8" fill="${color}" opacity="0.15" />
      <path d="M10 0C6.13 0 3 3.13 3 7c0 5.25 7 14 7 14s7-8.75 7-14c0-3.87-3.13-7-7-7z" fill="${color}" />
      <circle cx="10" cy="7.5" r="2.8" fill="rgba(255,255,255,0.85)" />
    </svg>`;
  if (shape === "circle") return `
    <svg width="${size}" height="${size}" viewBox="0 0 20 20" style="${shadow}">
      <circle cx="10" cy="10" r="8" fill="${color}" opacity="0.15" />
      <circle cx="10" cy="10" r="6" fill="${color}" />
      <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.85)" />
    </svg>`;
  if (shape === "diamond") return `
    <svg width="${size}" height="${size}" viewBox="0 0 20 20" style="${shadow}">
      <polygon points="10,1 19,10 10,19 1,10" fill="${color}" opacity="0.15" />
      <polygon points="10,3 17,10 10,17 3,10" fill="${color}" />
      <circle cx="10" cy="10" r="2.5" fill="rgba(255,255,255,0.85)" />
    </svg>`;
  return "";
}

function pinHeight(shape, size) {
  return shape === "pin" ? size * 1.4 : size;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function pinTooltipHTML(pin, color, teamView, ownerName) {
  return `
    <div style="background:var(--panel);border:1px solid ${color};border-radius:6px;padding:8px 12px;white-space:nowrap;font-size:11px;box-shadow:0 4px 20px ${color}44;font-family:'DM Mono',monospace;">
      <div style="color:${color};font-weight:500;margin-bottom:3px;">${escapeHtml(pin.city)}</div>
      <div style="color:var(--text-muted);font-size:9px;letter-spacing:1px;">${(PIN_TYPES[pin.type]?.label || "").toUpperCase()} · ${escapeHtml(pin.date)}</div>
      ${teamView ? `<div style="color:${color}aa;font-size:9px;margin-top:2px;">${escapeHtml(ownerName)}</div>` : ""}
      ${pin.note ? `<div style="color:var(--text-body);margin-top:4px;font-size:10px;max-width:180px;white-space:normal;">${escapeHtml(pin.note)}</div>` : ""}
    </div>`;
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────

function AuthScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]         = useState("login");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [msg, setMsg]           = useState("");

  const submit = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true); setError(""); setMsg("");
    try {
      const { error } = mode === "login"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({ email: email.trim(), password });
      if (error) setError(error.message);
      else if (mode === "signup") setMsg("Check your email to confirm, then sign in.");
    } finally {
      setLoading(false);
    }
  };

  const ready = email.trim() && password.trim() && !loading;

  return (
    <div style={{ minHeight:"100vh", background:"#eef1f6", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ width:360, padding:40 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:44, letterSpacing:6, color:"#0a1424", lineHeight:1, marginBottom:4 }}>CREW MAP</div>
        <div style={{ fontSize:10, color:"#9facc2", letterSpacing:3, marginBottom:40 }}>APOS JOB TRACKER</div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#7686a0", letterSpacing:2, marginBottom:8 }}>EMAIL</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="you@example.com" autoFocus
            onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{ width:"100%", background:"#f5f7fa", border:"1px solid #dce3ec", color:"#16233d", borderRadius:6, padding:"12px 14px", fontFamily:"'DM Mono'", fontSize:13, outline:"none" }} />
        </div>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"#7686a0", letterSpacing:2, marginBottom:8 }}>PASSWORD</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="••••••••"
            style={{ width:"100%", background:"#f5f7fa", border:"1px solid #dce3ec", color:"#16233d", borderRadius:6, padding:"12px 14px", fontFamily:"'DM Mono'", fontSize:13, outline:"none" }} />
        </div>

        {error && <div style={{ marginBottom:16, fontSize:11, color:"#ef4444", padding:"8px 10px", background:"#ef444411", borderRadius:5, border:"1px solid #ef444430" }}>{error}</div>}
        {msg   && <div style={{ marginBottom:16, fontSize:11, color:"#22c55e", padding:"8px 10px", background:"#22c55e11", borderRadius:5, border:"1px solid #22c55e30" }}>{msg}</div>}

        <button onClick={submit}
          style={{ width:"100%", padding:"14px", background:ready?"#f97316":"#f5f7fa", color:ready?"#fff":"#9facc2", border:"none", borderRadius:6, fontFamily:"'Bebas Neue'", fontSize:18, letterSpacing:4, cursor:"pointer", transition:"all 0.2s", boxShadow:ready?"0 0 24px #f9731655":"none", marginBottom:16 }}>
          {loading ? "..." : mode==="login" ? "SIGN IN" : "CREATE ACCOUNT"}
        </button>

        <div style={{ textAlign:"center" }}>
          <button onClick={()=>{ setMode(m=>m==="login"?"signup":"login"); setError(""); setMsg(""); }}
            style={{ background:"none", border:"none", color:"#9facc2", cursor:"pointer", fontSize:10, fontFamily:"'DM Mono'", letterSpacing:1 }}>
            {mode==="login" ? "No account? Sign up →" : "Have an account? Sign in →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onComplete }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [pos, setPos]     = useState("toast");

  return (
    <div style={{ minHeight:"100vh", background:"#eef1f6", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ width:360, padding:40 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:44, letterSpacing:6, color:"#0a1424", lineHeight:1, marginBottom:4 }}>CREW MAP</div>
        <div style={{ fontSize:10, color:"#9facc2", letterSpacing:3, marginBottom:40 }}>APOS JOB TRACKER</div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:"#7686a0", letterSpacing:2, marginBottom:8 }}>YOUR NAME</div>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onComplete({name:name.trim(),color,pos})}
            placeholder="First name or nickname"
            style={{ width:"100%", background:"#f5f7fa", border:"1px solid #dce3ec", color:"#16233d", borderRadius:6, padding:"12px 14px", fontFamily:"'DM Mono'", fontSize:13, outline:"none" }}
            autoFocus />
        </div>

        <div style={{ marginBottom:36 }}>
          <div style={{ fontSize:10, color:"#7686a0", letterSpacing:2, marginBottom:12 }}>YOUR COLOR</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
            {TEAM_COLORS.map((c,i) => (
              <div key={c} onClick={()=>setColor(c)} title={COLOR_NAMES[i]} style={{
                width:28, height:28, borderRadius:"50%", background:c, cursor:"pointer",
                border: color===c ? "3px solid white" : "3px solid transparent",
                boxShadow: color===c ? `0 0 12px ${c}` : "none",
                transition:"all 0.15s", flexShrink:0,
              }} />
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              <div onClick={()=>document.getElementById("colorpicker-setup").click()}
                style={{ width:36, height:36, borderRadius:"50%", background:color, boxShadow:`0 0 14px ${color}88`, border:"2px solid rgba(255,255,255,0.15)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:14, opacity:0.7 }}>🎨</span>
              </div>
              <input id="colorpicker-setup" type="color" value={color.length===7?color:"#f97316"} onChange={e=>setColor(e.target.value)}
                style={{ position:"absolute", opacity:0, width:1, height:1, pointerEvents:"none", top:0, left:0 }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:9, color:"#9facc2", letterSpacing:1, marginBottom:5 }}>CUSTOM HEX</div>
              <input
                value={color}
                onChange={e=>{ const v=e.target.value; if(/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v); }}
                placeholder="#f97316" maxLength={7}
                style={{ background:"#f0f2f6", border:`1px solid ${color.length===7?color+"55":"#dce3ec"}`, color:color.length===7?color:"#7686a0", borderRadius:4, padding:"6px 10px", fontFamily:"'DM Mono'", fontSize:12, width:"100%", outline:"none", letterSpacing:2 }} />
            </div>
          </div>
          <div style={{ fontSize:10, color:color.length===7?color:"#9facc2", marginTop:8, letterSpacing:1 }}>
            {color.length===7 ? "● color preview" : "enter a valid hex code"}
          </div>
        </div>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"#7686a0", letterSpacing:2, marginBottom:12 }}>POS PARTNER</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["toast","Toast","#ff6c2f"],["square","Square","#16233d"]].map(([key,label,accent])=>(
              <button key={key} onClick={()=>setPos(key)}
                style={{ flex:1, padding:"12px 8px", background:pos===key?accent+"18":"#f0f2f6", border:`2px solid ${pos===key?accent:"#dce3ec"}`, borderRadius:8, cursor:"pointer", fontFamily:"'Bebas Neue'", fontSize:16, letterSpacing:3, color:pos===key?accent:"#9facc2", transition:"all 0.2s", boxShadow:pos===key?`0 0 16px ${accent}33`:"none" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={()=>name.trim()&&onComplete({name:name.trim(),color,pos})} disabled={!name.trim()}
          style={{ width:"100%", padding:"14px", background:name.trim()?color:"#f5f7fa", color:name.trim()?"#fff":"#9facc2", border:"none", borderRadius:6, fontFamily:"'Bebas Neue'", fontSize:18, letterSpacing:4, cursor:name.trim()?"pointer":"not-allowed", transition:"all 0.2s", boxShadow:name.trim()?`0 0 24px ${color}55`:"none" }}>
          PLANT YOUR FLAG
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]       = useState(undefined); // undefined = checking auth
  const [me, setMe]                 = useState(null);
  const [pins, setPins]             = useState([]);
  const [users, setUsers]           = useState({});
  const [teamView, setTeamView]     = useState(false);
  const [dropping, setDropping]     = useState(null);
  const [form, setForm]             = useState({ type:"worked", city:"", note:"" });
  const [panel, setPanel]           = useState("list");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch]         = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [mapReady, setMapReady]     = useState(false); // flips true once leaflet actually exists — lets other effects know it's safe to use it
  const [theme, setTheme]           = useState(() => {
    try { return localStorage.getItem("crewmap-theme") || "light"; } catch { return "light"; }
  });
  const leafletRef   = useRef(null); // leaflet Map instance
  const tileLayerRef = useRef(null); // leaflet TileLayer instance, so we can swap its URL when the theme toggles
  const cleanupRef   = useRef(null); // teardown for the current map instance
  const markersRef   = useRef(new Map()); // pin.id -> native leaflet marker
  const dropMarkerRef = useRef(null);      // native leaflet marker for the drop cursor
  const searchTimer  = useRef(null);

  // ── Auth listener ─────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load data + real-time subscriptions ───────────────────────────────────

  useEffect(() => {
    if (!session) { setMe(null); setPins([]); setUsers({}); return; }

    const uid = session.user.id;

    supabase.from("profiles").select("*").eq("id", uid).maybeSingle()
      .then(({ data }) => { if (data) setMe({ id:uid, name:data.name, color:data.color, pos:data.pos }); });

    supabase.from("pins").select("*")
      .then(({ data }) => { if (data) setPins(data.map(normPin)); });

    supabase.from("profiles").select("*")
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(u => { map[u.id] = { name:u.name, color:u.color, pos:u.pos }; });
          setUsers(map);
        }
      });

    const pinsSub = supabase.channel("pins-rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"pins" }, ({ new: row }) => {
        setPins(prev => prev.some(p => p.id === row.id) ? prev : [...prev, normPin(row)]);
      })
      .on("postgres_changes", { event:"DELETE", schema:"public", table:"pins" }, ({ old: row }) => {
        setPins(prev => prev.filter(p => p.id !== row.id));
      })
      .subscribe();

    const profilesSub = supabase.channel("profiles-rt")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"profiles" }, ({ new: row }) => {
        setUsers(prev => ({ ...prev, [row.id]: { name:row.name, color:row.color, pos:row.pos } }));
      })
      .on("postgres_changes", { event:"UPDATE", schema:"public", table:"profiles" }, ({ new: row }) => {
        setUsers(prev => ({ ...prev, [row.id]: { name:row.name, color:row.color, pos:row.pos } }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(pinsSub);
      supabase.removeChannel(profilesSub);
    };
  }, [session]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSetup = async ({ name, color, pos }) => {
    const uid = session.user.id;
    await supabase.from("profiles").upsert({ id:uid, name, color, pos });
    setMe({ id:uid, name, color, pos });
    setUsers(prev => ({ ...prev, [uid]: { name, color, pos } }));
  };

  // ── Leaflet map init (real tiles: every city, town, and back road, all the
  //    way down to street level — no more blank vector states) ──────────────
  //
  // This is a callback ref, not a useEffect — it fires the instant the map's
  // <div> is actually attached to the page. A plain effect with an empty
  // dependency array only runs once, right after the very FIRST paint —
  // which for a logged-in user is still the "checking session..." loading
  // screen, before the map div exists at all. That was the original bug:
  // the map was never created because its container wasn't there yet on
  // the one render this ran on.
  const initMapNode = useCallback((node) => {
    if (!node) {
      // Element is being removed from the page — tear down cleanly.
      cleanupRef.current?.();
      cleanupRef.current = null;
      leafletRef.current?.remove();
      leafletRef.current = null;
      setMapReady(false);
      return;
    }
    if (leafletRef.current) return; // already initialized

    const map = L.map(node, {
      center: [39, -98],
      zoom: 4,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false,
      worldCopyJump: true,
    });

    tileLayerRef.current = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    map.on("click", (e) => {
      setDropping({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPanel("add");
      setForm({ type: "worked", city: "", note: "" });
      setSearch(""); setSearchResults([]);
    });

    leafletRef.current = map;
    setMapReady(true);

    // Belt-and-suspenders: re-measure shortly after mount and on any
    // container resize, in case layout hadn't fully settled yet.
    map.invalidateSize();
    const settleTimer = setTimeout(() => map.invalidateSize(), 150);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(node);

    cleanupRef.current = () => {
      clearTimeout(settleTimer);
      resizeObserver.disconnect();
    };
  }, []);

  // ── Location search (OpenStreetMap Nominatim — free, no API key, and it
  //    knows small towns, not just the ~30 major metros the old map showed) ─
  const runSearch = async (q) => {
    if (!q || q.trim().length < 3) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (v) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(v), 450);
  };

  const pickSearchResult = (r) => {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    setDropping({ lat, lng });
    setForm(f => ({ ...f, city: shortLabel(r) }));
    setSearch(""); setSearchResults([]);
    leafletRef.current?.flyTo([lat, lng], 12, { duration: 0.8 });
  };

  const handleAddPin = async () => {
    if (!dropping || !form.city.trim() || !me) return;
    const pin = {
      user_id: me.id,
      lat: dropping.lat, lng: dropping.lng,
      type: form.type, city: form.city.trim(), note: form.note.trim(),
      date: new Date().toLocaleDateString("en-US", { month:"short", year:"numeric" }),
    };
    setDropping(null);
    setForm({ type:"worked", city:"", note:"" });
    setPanel("list");
    const { data, error } = await supabase.from("pins").insert(pin).select().single();
    if (error) {
      console.error("Failed to save pin:", error.message);
      return;
    }
    // Draw it immediately from this response — don't wait on the realtime
    // subscription to echo it back, since that channel can silently miss
    // events (e.g. right after the database wakes from being paused).
    // The realtime handler below already dedupes by id, so if the
    // broadcast does arrive too, nothing is added twice.
    setPins(prev => prev.some(p => p.id === data.id) ? prev : [...prev, normPin(data)]);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("pins").delete().eq("id", id);
    if (error) { console.error("Failed to delete pin:", error.message); return; }
    setPins(prev => prev.filter(p => p.id !== id));
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const visiblePins  = teamView ? pins : pins.filter(p => p.userId === me?.id);
  const filteredPins = filterType === "all" ? visiblePins : visiblePins.filter(p => p.type === filterType);
  const myPins       = pins.filter(p => p.userId === me?.id);

  const leaderboard = [...new Set(pins.map(p => p.userId))].map(uid => {
    const uPins = pins.filter(p => p.userId === uid);
    const u = users[uid] || { name:uid, color:"#47597a" };
    return { ...u, uid, total:uPins.length, worked:uPins.filter(p=>p.type==="worked").length, layover:uPins.filter(p=>p.type==="layover").length, remote:uPins.filter(p=>p.type==="remote").length };
  }).sort((a,b) => b.worked - a.worked);

  // Sync one native Leaflet marker per visible pin. Leaflet positions these
  // itself on every pan/zoom — no manual pixel math, so this can't drift out
  // of sync with the map the way a hand-tracked overlay position could.
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    const seen = new Set();

    filteredPins.forEach(pin => {
      seen.add(pin.id);
      const owner = users[pin.userId] || me;
      const color = owner?.color || "#47597a";
      const isMe  = pin.userId === me?.id;
      const shape = PIN_TYPES[pin.type]?.shape || "pin";
      const size  = isMe ? 20 : 16;
      const height = pinHeight(shape, size);
      const icon = L.divIcon({
        html: pinShapeHTML(shape, color, size),
        className: "crew-pin-icon",
        iconSize: [size, height],
        iconAnchor: [size / 2, height],
      });

      let marker = markersRef.current.get(pin.id);
      if (!marker) {
        marker = L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindTooltip("", { direction: "top", offset: [0, -height], opacity: 1, className: "crew-pin-tooltip" });
        markersRef.current.set(pin.id, marker);
      } else {
        marker.setLatLng([pin.lat, pin.lng]);
        marker.setIcon(icon);
      }
      marker.setOpacity(teamView && !isMe ? 0.7 : 1);
      marker.setTooltipContent(pinTooltipHTML(pin, color, teamView, owner?.name));
    });

    // Remove markers for any pin no longer in the visible set (deleted, or
    // filtered out by the category/team-view toggles).
    markersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });
  }, [mapReady, filteredPins, teamView, users, me]);

  // Same idea for the pulsing "you're about to drop a pin here" cursor.
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    if (dropping && me) {
      const icon = L.divIcon({
        html: `<div class="pulse" style="width:13px;height:13px;border-radius:50%;background:${me.color};border:2px solid white;"></div>`,
        className: "",
        iconSize: [13, 13],
        iconAnchor: [6.5, 6.5],
      });
      if (!dropMarkerRef.current) {
        dropMarkerRef.current = L.marker([dropping.lat, dropping.lng], { icon, interactive: false }).addTo(map);
      } else {
        dropMarkerRef.current.setLatLng([dropping.lat, dropping.lng]);
        dropMarkerRef.current.setIcon(icon);
      }
    } else if (dropMarkerRef.current) {
      map.removeLayer(dropMarkerRef.current);
      dropMarkerRef.current = null;
    }
  }, [mapReady, dropping, me]);

  // Keep the tile layer and localStorage in sync with the theme toggle.
  useEffect(() => {
    try { localStorage.setItem("crewmap-theme", theme); } catch { /* ignore */ }
    tileLayerRef.current?.setUrl(
      theme === "dark"
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    );
  }, [theme, mapReady]);

  // ── Render gates ──────────────────────────────────────────────────────────

  if (session === undefined) return (
    <div style={{ minHeight:"100vh", background:"#eef1f6", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:28, letterSpacing:6, color:"#e7edf5" }}>CREW MAP</div>
    </div>
  );

  if (!session) return <AuthScreen />;
  if (!me)      return <SetupScreen onComplete={handleSetup} />;

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div data-theme={theme} className="cm-root" style={{ fontFamily:"'DM Mono', monospace", background:"var(--bg)", color:"var(--text-primary)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        :root {
          --bg:#dde2e9; --panel:#ebedf1; --hover:#d7dee8; --input:#e3e7ec;
          --border:#ced6e1; --border-muted:#a7b4ca; --label-dim:#9daac0;
          --text-muted:#5f7089; --text-body:#4c5b76; --text-prominent:#4b5c7d;
          --text-primary:#1d2a44; --text-bright:#121c2d; --text-subtitle:#7e8fa7;
          --ghost-border:#b8c1d1; --bg-very-dim:#dfe2e9; --bg-disabled:#d7dce4;
          --divider:#d4dae3; --chip-bg:#ebedf1cc; --badge-bg:#ced6e122; --badge-border:#9daac033;
        }
        [data-theme="dark"] {
          --bg:#191f2b; --panel:#1a2332; --hover:#1f2c3f; --input:#1f283c;
          --border:#2c384a; --border-muted:#2c4669; --label-dim:#38465a;
          --text-muted:#8291a6; --text-body:#96a4b8; --text-prominent:#92a1b6;
          --text-primary:#dbe1ea; --text-bright:#e9eef3; --text-subtitle:#c5d0dc;
          --ghost-border:#1e2b3d; --bg-very-dim:#1b212f; --bg-disabled:#1b2333;
          --divider:#1c2433; --chip-bg:#1a2332cc; --badge-bg:#2c384a22; --badge-border:#38465a33;
        }
        * { box-sizing:border-box; margin:0; padding:0; }
        .cm-root { height:100vh; height:100dvh; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
        .pulse { animation:pulse 1.8s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(1.4); } }
        input, textarea { background:var(--input); border:1px solid var(--border); color:var(--text-primary); border-radius:5px; padding:8px 10px; font-family:'DM Mono',monospace; font-size:12px; width:100%; outline:none; }
        input:focus, textarea:focus { border-color:var(--label-dim); }
        textarea { resize:none; height:56px; }
        .del-btn { opacity:0; transition:opacity 0.15s; }
        .pin-row:hover .del-btn { opacity:1; }
        .cat-btn { transition:all 0.15s; }
        .cat-btn:hover { opacity:0.85; }

        /* Leaflet chrome, restyled to match the dark crew-map theme */
        .leaflet-container { background:var(--panel); font-family:'DM Mono', monospace; cursor:crosshair; }
        .leaflet-control-zoom { border:1px solid var(--border) !important; box-shadow:none !important; }
        .leaflet-control-zoom a { background:var(--panel) !important; color:var(--text-muted) !important; border-color:var(--border) !important; }
        .leaflet-control-zoom a:hover { background:var(--hover) !important; color:var(--text-prominent) !important; }
        .leaflet-control-attribution { background:var(--chip-bg) !important; color:var(--label-dim) !important; font-size:9px !important; }
        .leaflet-control-attribution a { color:var(--text-muted) !important; }
        .leaflet-tile-pane { filter:brightness(0.97) saturate(0.92); }
        [data-theme="dark"] .leaflet-tile-pane { filter:brightness(1.35) contrast(0.85) saturate(0.85); }

        /* ── Responsive: phones and narrow windows ──────────────────────── */
        @media (max-width: 760px) {
          .cm-header { flex-wrap:wrap; row-gap:8px; padding:8px 12px; }
          .cm-header-spacer { display:none; }
          .cm-body { flex-direction:column; }
          .cm-map { flex:none; width:100%; height:44vh; }
          .cm-sidebar { width:100% !important; flex:1; border-left:none !important; border-top:1px solid var(--hover); }
        }
        @media (max-width: 460px) {
          .cm-wordmark { font-size:16px !important; letter-spacing:2px !important; }
          .cm-subtitle { display:none; }
          .cm-pincount, .cm-pincount-dot { display:none; }
        }

        /* Native pin markers — hover/pop effects go on the inner SVG, not the
           marker div itself, since leaflet uses that div's own transform for
           positioning and overriding it here would break placement. */
        .crew-pin-icon { background:transparent; border:none; cursor:pointer; }
        .crew-pin-icon svg { transition:transform 0.15s ease; transform-origin:50% 100%; animation:pinPop 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        .crew-pin-icon:hover svg { transform:scale(1.3); }
        @keyframes pinPop { from { transform:scale(0); opacity:0; } to { transform:scale(1); opacity:1; } }
        .crew-pin-tooltip.leaflet-tooltip { background:transparent !important; border:none !important; box-shadow:none !important; padding:0 !important; border-radius:0 !important; }
        .crew-pin-tooltip.leaflet-tooltip::before { display:none !important; }
      `}</style>

      {/* ── Header ── */}
      <div className="cm-header" style={{ background:"var(--panel)", borderBottom:"1px solid var(--hover)", padding:"9px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <div>
          <div className="cm-wordmark" style={{ fontFamily:"'Bebas Neue'", fontSize:20, letterSpacing:4, color:"var(--text-bright)" }}>CREW MAP</div>
          <div className="cm-subtitle" style={{ fontSize:9, color:"var(--border-muted)", letterSpacing:2 }}>APOS JOB TRACKER</div>
        </div>

        <div onClick={()=>setTeamView(v=>!v)} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", background:teamView?"var(--hover)":"transparent", border:`1px solid ${teamView?"var(--border-muted)":"var(--hover)"}`, borderRadius:20, padding:"5px 12px", marginLeft:4, transition:"all 0.2s" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:teamView?"#22c55e":"var(--border)", boxShadow:teamView?"0 0 7px #22c55e":"none", transition:"all 0.2s" }} />
          <span style={{ fontSize:9, color:teamView?"var(--text-body)":"var(--label-dim)", letterSpacing:1 }}>{teamView?"TEAM VIEW ON":"MY VIEW"}</span>
        </div>

        <div className="cm-header-spacer" style={{ flex:1 }} />

        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", rowGap:6 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:me.color, boxShadow:`0 0 8px ${me.color}` }} />
          <span style={{ fontSize:11, color:"var(--text-prominent)" }}>{me.name}</span>
          <span style={{ fontSize:9, color:me.pos==="toast"?"#ff6c2f":"var(--text-prominent)", background:me.pos==="toast"?"#ff6c2f18":"var(--border)", border:`1px solid ${me.pos==="toast"?"#ff6c2f44":"var(--label-dim)"}`, borderRadius:4, padding:"1px 6px", letterSpacing:1 }}>{me.pos==="toast"?"TOAST":"SQUARE"}</span>
          <span className="cm-pincount-dot" style={{ fontSize:10, color:"var(--border)" }}>·</span>
          <span className="cm-pincount" style={{ fontSize:10, color:"var(--text-muted)" }}>
            {myPins.filter(p=>p.type==="worked").length}▼ {myPins.filter(p=>p.type==="layover").length}● {myPins.filter(p=>p.type==="remote").length}◆
          </span>
          <button onClick={()=>setTheme(t => t === "dark" ? "light" : "dark")} title={theme==="dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ marginLeft:4, background:"none", border:"1px solid var(--hover)", color:"var(--text-muted)", cursor:"pointer", fontSize:9, fontFamily:"'DM Mono'", letterSpacing:1, borderRadius:4, padding:"3px 8px", display:"flex", alignItems:"center", gap:5 }}>
            {theme==="dark" ? "☀ LIGHT" : "☾ DARK"}
          </button>
          <button onClick={()=>supabase.auth.signOut()}
            style={{ marginLeft:0, background:"none", border:"1px solid var(--hover)", color:"var(--text-muted)", cursor:"pointer", fontSize:9, fontFamily:"'DM Mono'", letterSpacing:1, borderRadius:4, padding:"3px 8px" }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="cm-body" style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── Map ── */}
        <div className="cm-map" style={{ flex:1, position:"relative", overflow:"hidden" }}>

          {/* Leaflet mounts here — real tiles, every town and back road, native pan/zoom.
              Pins and the drop cursor are added as native leaflet markers (see the two
              effects above), not rendered here — that's what lets leaflet keep them
              correctly positioned through every pan and zoom on its own. */}
          <div ref={initMapNode} style={{ position:"absolute", inset:0 }} />

          <div style={{ position:"absolute", left:0, right:0, bottom:8, textAlign:"center", zIndex:15, pointerEvents:"none" }}>
            <span style={{ color:"var(--text-muted)", fontSize:8, fontFamily:"'DM Mono', monospace", letterSpacing:3, background:"var(--chip-bg)", padding:"3px 8px", borderRadius:3 }}>SEARCH A PLACE OR CLICK THE MAP TO DROP A PIN</span>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="cm-sidebar" style={{ width:268, background:"var(--panel)", borderLeft:"1px solid var(--hover)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid var(--hover)", flexShrink:0 }}>
            {[["list","LOG"],["add","+ PIN"],["board","CREW"]].map(([key,lbl])=>(
              <button key={key} onClick={()=>{ setPanel(key); if(key!=="add") setDropping(null); }}
                style={{ flex:1, padding:"10px 4px", background:panel===key?"var(--hover)":"transparent", color:panel===key?"var(--text-primary)":"var(--border-muted)", border:"none", cursor:"pointer", fontSize:9, letterSpacing:2, fontFamily:"'DM Mono'", borderBottom:panel===key?`2px solid ${me.color}`:"2px solid transparent", transition:"color 0.15s" }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* LOG */}
          {panel==="list" && (
            <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
              <div style={{ display:"flex", gap:5, padding:"9px 10px 5px", flexWrap:"wrap" }}>
                {[["all","ALL"],...Object.entries(PIN_TYPES).map(([k,v])=>[k,v.legend])].map(([key,lbl])=>(
                  <button key={key} className="cat-btn" onClick={()=>setFilterType(key)}
                    style={{ padding:"3px 9px", borderRadius:10, background:filterType===key?"var(--hover)":"transparent", border:`1px solid ${filterType===key?"var(--border-muted)":"var(--hover)"}`, color:filterType===key?"var(--text-prominent)":"var(--border-muted)", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono'" }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {filteredPins.length===0 ? (
                <div style={{ padding:"30px 20px", textAlign:"center", color:"var(--text-muted)", fontSize:11 }}>
                  {teamView?"No team pins yet.":"No pins yet."}<br/><span style={{ fontSize:10 }}>Click the map to start.</span>
                </div>
              ) : filteredPins.slice().reverse().map(pin => {
                const owner = users[pin.userId] || me;
                const color = owner?.color || "var(--text-prominent)";
                const t     = PIN_TYPES[pin.type];
                const isMe  = pin.userId === me?.id;
                return (
                  <div key={pin.id} className="pin-row" style={{ padding:"9px 10px", borderBottom:"1px solid var(--divider)", display:"flex", gap:8, alignItems:"flex-start" }}>
                    <div style={{ marginTop:2, flexShrink:0 }}>
                      <PinShape shape={t.shape} color={color} size={12} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:"var(--text-prominent)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.city}</div>
                      <div style={{ fontSize:9, color:"var(--text-body)", letterSpacing:1 }}>
                        {t.label.toUpperCase()} · {pin.date}
                        {teamView&&!isMe&&<span style={{ color:color+"cc", marginLeft:4 }}>· {owner.name}</span>}
                      </div>
                      {pin.note&&<div style={{ fontSize:10, color:"var(--text-body)", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.note}</div>}
                    </div>
                    {isMe && (
                      <button className="del-btn" onClick={()=>handleDelete(pin.id)}
                        style={{ background:"none", border:"none", color:"var(--border-muted)", cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1 }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ADD PIN */}
          {panel==="add" && (
            <div style={{ padding:14, display:"flex", flexDirection:"column", gap:13, overflowY:"auto" }}>
              <div style={{ fontSize:9, color:dropping?"var(--text-muted)":"var(--border)", letterSpacing:1 }}>
                {dropping?`📍 ${dropping.lat.toFixed(3)}°, ${dropping.lng.toFixed(3)}°`:"search a place or click the map"}
              </div>
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:9, color:"var(--label-dim)", letterSpacing:2, marginBottom:6 }}>SEARCH LOCATION</div>
                <input placeholder="Any city, town, or address..." value={search} onChange={e=>handleSearchChange(e.target.value)} />
                {(searching || searchResults.length > 0) && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"var(--input)", border:"1px solid var(--border)", borderRadius:6, zIndex:60, maxHeight:220, overflowY:"auto", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
                    {searching && <div style={{ padding:"8px 10px", fontSize:10, color:"var(--text-muted)" }}>searching...</div>}
                    {!searching && searchResults.length === 0 && search.trim().length >= 3 && (
                      <div style={{ padding:"8px 10px", fontSize:10, color:"var(--text-muted)" }}>no matches</div>
                    )}
                    {!searching && searchResults.map((r, i) => (
                      <button key={i} onClick={()=>pickSearchResult(r)}
                        style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", background:"transparent", border:"none", borderBottom:i<searchResults.length-1?"1px solid var(--hover)":"none", cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--hover)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{ fontSize:11, color:"var(--text-primary)" }}>{shortLabel(r)}</div>
                        <div style={{ fontSize:9, color:"var(--text-muted)", marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.display_name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize:9, color:"var(--label-dim)", letterSpacing:2, marginBottom:7 }}>CATEGORY</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {Object.entries(PIN_TYPES).map(([key,val])=>(
                    <button key={key} className="cat-btn" onClick={()=>setForm(f=>({...f,type:key}))}
                      style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", background:form.type===key?"var(--hover)":"transparent", border:`1px solid ${form.type===key?"var(--border-muted)":"var(--ghost-border)"}`, borderRadius:5, cursor:"pointer", textAlign:"left", fontFamily:"'DM Mono'" }}>
                      <PinShape shape={val.shape} color={form.type===key?me.color:"var(--border-muted)"} size={13} />
                      <span style={{ fontSize:11, color:form.type===key?"var(--text-primary)":"var(--label-dim)" }}>{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:9, color:"var(--label-dim)", letterSpacing:2, marginBottom:6 }}>CITY / LOCATION LABEL</div>
                <input placeholder="Austin, TX" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAddPin()} />
              </div>
              <div>
                <div style={{ fontSize:9, color:"var(--label-dim)", letterSpacing:2, marginBottom:6 }}>NOTE (OPTIONAL)</div>
                <textarea placeholder="Brewery install, day 2..." value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} />
              </div>
              <button onClick={handleAddPin} disabled={!dropping||!form.city.trim()}
                style={{ padding:"11px", background:dropping&&form.city.trim()?me.color:"var(--bg-disabled)", color:dropping&&form.city.trim()?"#fff":"var(--border)", border:"none", borderRadius:5, fontFamily:"'Bebas Neue'", fontSize:15, letterSpacing:3, cursor:dropping&&form.city.trim()?"pointer":"not-allowed", transition:"all 0.2s", boxShadow:dropping&&form.city.trim()?`0 0 18px ${me.color}55`:"none" }}>
                DROP PIN
              </button>
              {!dropping&&<div style={{ fontSize:9, color:"var(--text-muted)", textAlign:"center" }}>search a place or click the map first</div>}
            </div>
          )}

          {/* CREW BOARD */}
          {panel==="board" && (
            <div style={{ flex:1, overflowY:"auto", padding:"10px 0" }}>
              <div style={{ padding:"0 12px 8px", fontSize:9, color:"var(--border-muted)", letterSpacing:2 }}>LEADERBOARD</div>
              {leaderboard.length===0 ? (
                <div style={{ padding:20, textAlign:"center", color:"var(--text-muted)", fontSize:11 }}>No crew data yet.</div>
              ) : leaderboard.map((u,i) => (
                <div key={u.uid} style={{ padding:"10px 12px", borderBottom:"1px solid var(--divider)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                    <div style={{ fontFamily:"'Bebas Neue'", fontSize:15, color:i===0?"#f59e0b":"var(--border-muted)", width:16, flexShrink:0 }}>{i+1}</div>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:u.color, boxShadow:`0 0 7px ${u.color}`, flexShrink:0 }} />
                    <div style={{ fontSize:12, color:u.uid===me.id?u.color:"var(--text-prominent)" }}>{u.name}{u.uid===me.id&&" (you)"}</div>
                    <span style={{ fontSize:8, color:u.pos==="toast"?"#ff6c2f":"var(--text-prominent)", background:u.pos==="toast"?"#ff6c2f18":"var(--badge-bg)", border:`1px solid ${u.pos==="toast"?"#ff6c2f33":"var(--badge-border)"}`, borderRadius:3, padding:"1px 5px", letterSpacing:1 }}>{u.pos==="square"?"SQ":"🍞"}</span>
                    <div style={{ flex:1 }} />
                    <div style={{ fontSize:10, color:"var(--text-body)" }}>{u.total} pins</div>
                  </div>
                  <div style={{ display:"flex", gap:12, paddingLeft:23 }}>
                    {[["worked","▼"],["layover","●"],["remote","◆"]].map(([k,sym])=>(
                      <div key={k} style={{ fontSize:10, color:"var(--text-body)" }}>
                        <span style={{ color:u.color, marginRight:3 }}>{sym}</span>{u[k]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ padding:"14px 12px 0", borderTop:"1px solid var(--divider)", marginTop:6 }}>
                <div style={{ fontSize:9, color:"var(--border-muted)", letterSpacing:2, marginBottom:10 }}>SHAPE KEY</div>
                {Object.entries(PIN_TYPES).map(([key,val])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <PinShape shape={val.shape} color="var(--label-dim)" size={12} />
                    <span style={{ fontSize:10, color:"var(--text-body)" }}>{val.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
