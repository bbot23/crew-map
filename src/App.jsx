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
  const [hovered, setHovered]       = useState(null);
  const [panel, setPanel]           = useState("list");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch]         = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [renderTick, setRenderTick] = useState(0); // bumped on leaflet pan/zoom to reposition pin overlay
  const [positions, setPositions]   = useState({}); // pin id -> {x,y} in container pixels, plus __dropping
  const leafletRef   = useRef(null); // leaflet Map instance
  const cleanupRef   = useRef(null); // teardown for the current map instance
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

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const bump = () => setRenderTick(t => t + 1);
    map.on("move zoom", bump);
    map.on("click", (e) => {
      setDropping({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPanel("add");
      setForm({ type: "worked", city: "", note: "" });
      setSearch(""); setSearchResults([]);
    });

    leafletRef.current = map;
    bump();

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

  // Recompute on-screen pixel positions whenever the map pans/zooms
  // (renderTick) or the visible pin set changes. Reading the leaflet ref
  // here, inside an effect, keeps ref access out of the render path.
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;
    const next = {};
    filteredPins.forEach(p => {
      const pt = map.latLngToContainerPoint([p.lat, p.lng]);
      next[p.id] = { x: pt.x, y: pt.y };
    });
    if (dropping) {
      const pt = map.latLngToContainerPoint([dropping.lat, dropping.lng]);
      next.__dropping = { x: pt.x, y: pt.y };
    }
    setPositions(next);
  }, [renderTick, dropping, filteredPins]);

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
    <div style={{ fontFamily:"'DM Mono', monospace", background:"#eef1f6", color:"#16233d", height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:#dce3ec; border-radius:2px; }
        .map-pin { transition:transform 0.15s ease; cursor:pointer; }
        .map-pin:hover { transform:scale(1.4) translateY(-2px); }
        .pin-pop { animation:popIn 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes popIn { from { transform:scale(0) translateY(8px); opacity:0; } to { transform:scale(1); opacity:1; } }
        .pulse { animation:pulse 1.8s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; transform:translate(-50%,-50%) scale(1); } 50% { opacity:0.4; transform:translate(-50%,-50%) scale(1.4); } }
        input, textarea { background:#f5f7fa; border:1px solid #dce3ec; color:#16233d; border-radius:5px; padding:8px 10px; font-family:'DM Mono',monospace; font-size:12px; width:100%; outline:none; }
        input:focus, textarea:focus { border-color:#9facc2; }
        textarea { resize:none; height:56px; }
        .del-btn { opacity:0; transition:opacity 0.15s; }
        .pin-row:hover .del-btn { opacity:1; }
        .cat-btn { transition:all 0.15s; }
        .cat-btn:hover { opacity:0.85; }

        /* Leaflet chrome, restyled to match the dark crew-map theme */
        .leaflet-container { background:#ffffff; font-family:'DM Mono', monospace; cursor:crosshair; }
        .leaflet-control-zoom { border:1px solid #dce3ec !important; box-shadow:none !important; }
        .leaflet-control-zoom a { background:#ffffff !important; color:#7686a0 !important; border-color:#dce3ec !important; }
        .leaflet-control-zoom a:hover { background:#e7edf5 !important; color:#47597a !important; }
        .leaflet-control-attribution { background:#eef1f6cc !important; color:#9facc2 !important; font-size:9px !important; }
        .leaflet-control-attribution a { color:#7686a0 !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:"#ffffff", borderBottom:"1px solid #e7edf5", padding:"9px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue'", fontSize:20, letterSpacing:4, color:"#0a1424" }}>CREW MAP</div>
          <div style={{ fontSize:9, color:"#afbcd1", letterSpacing:2 }}>APOS JOB TRACKER</div>
        </div>

        <div onClick={()=>setTeamView(v=>!v)} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", background:teamView?"#e7edf5":"transparent", border:`1px solid ${teamView?"#afbcd1":"#e7edf5"}`, borderRadius:20, padding:"5px 12px", marginLeft:4, transition:"all 0.2s" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:teamView?"#22c55e":"#dce3ec", boxShadow:teamView?"0 0 7px #22c55e":"none", transition:"all 0.2s" }} />
          <span style={{ fontSize:9, color:teamView?"#5b6b84":"#9facc2", letterSpacing:1 }}>{teamView?"TEAM VIEW ON":"MY VIEW"}</span>
        </div>

        <div style={{ flex:1 }} />

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:me.color, boxShadow:`0 0 8px ${me.color}` }} />
          <span style={{ fontSize:11, color:"#47597a" }}>{me.name}</span>
          <span style={{ fontSize:9, color:me.pos==="toast"?"#ff6c2f":"#47597a", background:me.pos==="toast"?"#ff6c2f18":"#dce3ec", border:`1px solid ${me.pos==="toast"?"#ff6c2f44":"#9facc2"}`, borderRadius:4, padding:"1px 6px", letterSpacing:1 }}>{me.pos==="toast"?"TOAST":"SQUARE"}</span>
          <span style={{ fontSize:10, color:"#dce3ec" }}>·</span>
          <span style={{ fontSize:10, color:"#9facc2" }}>
            {myPins.filter(p=>p.type==="worked").length}▼ {myPins.filter(p=>p.type==="layover").length}● {myPins.filter(p=>p.type==="remote").length}◆
          </span>
          <button onClick={()=>supabase.auth.signOut()}
            style={{ marginLeft:8, background:"none", border:"1px solid #e7edf5", color:"#afbcd1", cursor:"pointer", fontSize:9, fontFamily:"'DM Mono'", letterSpacing:1, borderRadius:4, padding:"3px 8px" }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── Map ── */}
        <div style={{ flex:1, position:"relative", overflow:"hidden" }}>

          {/* Leaflet mounts here — real tiles, every town and back road, native pan/zoom */}
          <div ref={initMapNode} style={{ position:"absolute", inset:0 }} />

          {/* Overlay layer: our own pins, hover cards, drop cursor — positioned via leaflet's projection */}
          <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:15 }}>
            {filteredPins.map(pin => {
              const { x:px, y:py } = positions[pin.id] || { x:-9999, y:-9999 };
              const owner = users[pin.userId] || me;
              const color = owner?.color || "#47597a";
              const isMe  = pin.userId === me?.id;
              const shape = PIN_TYPES[pin.type]?.shape || "pin";
              const isHov = hovered === pin.id;
              return (
                <div key={pin.id} className="map-pin pin-pop"
                  style={{ position:"absolute", left:px, top:py, transform:"translate(-50%,-100%)", zIndex:isHov?30:isMe?15:10, opacity:teamView&&!isMe?0.7:1, pointerEvents:"auto" }}
                  onMouseEnter={()=>setHovered(pin.id)} onMouseLeave={()=>setHovered(null)}>
                  <PinShape shape={shape} color={color} size={isMe?20:16} />
                  {isHov && (
                    <div style={{ position:"absolute", bottom:"115%", left:"50%", transform:"translateX(-50%)", background:"#ffffff", border:`1px solid ${color}`, borderRadius:6, padding:"8px 12px", whiteSpace:"nowrap", fontSize:11, zIndex:50, pointerEvents:"none", boxShadow:`0 4px 20px ${color}44` }}>
                      <div style={{ color, fontWeight:500, marginBottom:3 }}>{pin.city}</div>
                      <div style={{ color:"#7686a0", fontSize:9, letterSpacing:1 }}>{PIN_TYPES[pin.type]?.label?.toUpperCase()} · {pin.date}</div>
                      {teamView && <div style={{ color:color+"aa", fontSize:9, marginTop:2 }}>{owner?.name}</div>}
                      {pin.note && <div style={{ color:"#5b6b84", marginTop:4, fontSize:10, maxWidth:180 }}>{pin.note}</div>}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Drop cursor */}
            {dropping && positions.__dropping && (
              <div className="pulse" style={{ position:"absolute", left:positions.__dropping.x, top:positions.__dropping.y, width:13, height:13, borderRadius:"50%", background:me.color, border:"2px solid white", transform:"translate(-50%,-50%)", zIndex:40 }} />
            )}
          </div>

          <div style={{ position:"absolute", left:0, right:0, bottom:8, textAlign:"center", zIndex:15, pointerEvents:"none" }}>
            <span style={{ color:"#7686a0", fontSize:8, fontFamily:"'DM Mono', monospace", letterSpacing:3, background:"#ffffffcc", padding:"3px 8px", borderRadius:3 }}>SEARCH A PLACE OR CLICK THE MAP TO DROP A PIN</span>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ width:268, background:"#ffffff", borderLeft:"1px solid #e7edf5", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid #e7edf5", flexShrink:0 }}>
            {[["list","LOG"],["add","+ PIN"],["board","CREW"]].map(([key,lbl])=>(
              <button key={key} onClick={()=>{ setPanel(key); if(key!=="add") setDropping(null); }}
                style={{ flex:1, padding:"10px 4px", background:panel===key?"#e7edf5":"transparent", color:panel===key?"#16233d":"#afbcd1", border:"none", cursor:"pointer", fontSize:9, letterSpacing:2, fontFamily:"'DM Mono'", borderBottom:panel===key?`2px solid ${me.color}`:"2px solid transparent", transition:"color 0.15s" }}>
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
                    style={{ padding:"3px 9px", borderRadius:10, background:filterType===key?"#e7edf5":"transparent", border:`1px solid ${filterType===key?"#afbcd1":"#e7edf5"}`, color:filterType===key?"#47597a":"#afbcd1", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono'" }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {filteredPins.length===0 ? (
                <div style={{ padding:"30px 20px", textAlign:"center", color:"#7686a0", fontSize:11 }}>
                  {teamView?"No team pins yet.":"No pins yet."}<br/><span style={{ fontSize:10 }}>Click the map to start.</span>
                </div>
              ) : filteredPins.slice().reverse().map(pin => {
                const owner = users[pin.userId] || me;
                const color = owner?.color || "#47597a";
                const t     = PIN_TYPES[pin.type];
                const isMe  = pin.userId === me?.id;
                return (
                  <div key={pin.id} className="pin-row" style={{ padding:"9px 10px", borderBottom:"1px solid #e3e8ef", display:"flex", gap:8, alignItems:"flex-start" }}
                    onMouseEnter={()=>setHovered(pin.id)} onMouseLeave={()=>setHovered(null)}>
                    <div style={{ marginTop:2, flexShrink:0 }}>
                      <PinShape shape={t.shape} color={color} size={12} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:"#7e8fa8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.city}</div>
                      <div style={{ fontSize:9, color:"#afbcd1", letterSpacing:1 }}>
                        {t.label.toUpperCase()} · {pin.date}
                        {teamView&&!isMe&&<span style={{ color:color+"cc", marginLeft:4 }}>· {owner.name}</span>}
                      </div>
                      {pin.note&&<div style={{ fontSize:10, color:"#9facc2", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.note}</div>}
                    </div>
                    {isMe && (
                      <button className="del-btn" onClick={()=>handleDelete(pin.id)}
                        style={{ background:"none", border:"none", color:"#afbcd1", cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1 }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ADD PIN */}
          {panel==="add" && (
            <div style={{ padding:14, display:"flex", flexDirection:"column", gap:13, overflowY:"auto" }}>
              <div style={{ fontSize:9, color:dropping?"#7686a0":"#dce3ec", letterSpacing:1 }}>
                {dropping?`📍 ${dropping.lat.toFixed(3)}°, ${dropping.lng.toFixed(3)}°`:"search a place or click the map"}
              </div>
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:9, color:"#9facc2", letterSpacing:2, marginBottom:6 }}>SEARCH LOCATION</div>
                <input placeholder="Any city, town, or address..." value={search} onChange={e=>handleSearchChange(e.target.value)} />
                {(searching || searchResults.length > 0) && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, marginTop:4, background:"#f5f7fa", border:"1px solid #dce3ec", borderRadius:6, zIndex:60, maxHeight:220, overflowY:"auto", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
                    {searching && <div style={{ padding:"8px 10px", fontSize:10, color:"#9facc2" }}>searching...</div>}
                    {!searching && searchResults.length === 0 && search.trim().length >= 3 && (
                      <div style={{ padding:"8px 10px", fontSize:10, color:"#9facc2" }}>no matches</div>
                    )}
                    {!searching && searchResults.map((r, i) => (
                      <button key={i} onClick={()=>pickSearchResult(r)}
                        style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", background:"transparent", border:"none", borderBottom:i<searchResults.length-1?"1px solid #e7edf5":"none", cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#e7edf5"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{ fontSize:11, color:"#16233d" }}>{shortLabel(r)}</div>
                        <div style={{ fontSize:9, color:"#9facc2", marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{r.display_name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize:9, color:"#9facc2", letterSpacing:2, marginBottom:7 }}>CATEGORY</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {Object.entries(PIN_TYPES).map(([key,val])=>(
                    <button key={key} className="cat-btn" onClick={()=>setForm(f=>({...f,type:key}))}
                      style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", background:form.type===key?"#e7edf5":"transparent", border:`1px solid ${form.type===key?"#afbcd1":"#c2cbda"}`, borderRadius:5, cursor:"pointer", textAlign:"left", fontFamily:"'DM Mono'" }}>
                      <PinShape shape={val.shape} color={form.type===key?me.color:"#afbcd1"} size={13} />
                      <span style={{ fontSize:11, color:form.type===key?"#16233d":"#9facc2" }}>{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:9, color:"#9facc2", letterSpacing:2, marginBottom:6 }}>CITY / LOCATION LABEL</div>
                <input placeholder="Austin, TX" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAddPin()} />
              </div>
              <div>
                <div style={{ fontSize:9, color:"#9facc2", letterSpacing:2, marginBottom:6 }}>NOTE (OPTIONAL)</div>
                <textarea placeholder="Brewery install, day 2..." value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} />
              </div>
              <button onClick={handleAddPin} disabled={!dropping||!form.city.trim()}
                style={{ padding:"11px", background:dropping&&form.city.trim()?me.color:"#e7eaf0", color:dropping&&form.city.trim()?"#fff":"#dce3ec", border:"none", borderRadius:5, fontFamily:"'Bebas Neue'", fontSize:15, letterSpacing:3, cursor:dropping&&form.city.trim()?"pointer":"not-allowed", transition:"all 0.2s", boxShadow:dropping&&form.city.trim()?`0 0 18px ${me.color}55`:"none" }}>
                DROP PIN
              </button>
              {!dropping&&<div style={{ fontSize:9, color:"#9facc2", textAlign:"center" }}>search a place or click the map first</div>}
            </div>
          )}

          {/* CREW BOARD */}
          {panel==="board" && (
            <div style={{ flex:1, overflowY:"auto", padding:"10px 0" }}>
              <div style={{ padding:"0 12px 8px", fontSize:9, color:"#afbcd1", letterSpacing:2 }}>LEADERBOARD</div>
              {leaderboard.length===0 ? (
                <div style={{ padding:20, textAlign:"center", color:"#7686a0", fontSize:11 }}>No crew data yet.</div>
              ) : leaderboard.map((u,i) => (
                <div key={u.uid} style={{ padding:"10px 12px", borderBottom:"1px solid #e3e8ef" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                    <div style={{ fontFamily:"'Bebas Neue'", fontSize:15, color:i===0?"#f59e0b":"#afbcd1", width:16, flexShrink:0 }}>{i+1}</div>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:u.color, boxShadow:`0 0 7px ${u.color}`, flexShrink:0 }} />
                    <div style={{ fontSize:12, color:u.uid===me.id?u.color:"#47597a" }}>{u.name}{u.uid===me.id&&" (you)"}</div>
                    <span style={{ fontSize:8, color:u.pos==="toast"?"#ff6c2f":"#47597a", background:u.pos==="toast"?"#ff6c2f18":"#dce3ec22", border:`1px solid ${u.pos==="toast"?"#ff6c2f33":"#9facc233"}`, borderRadius:3, padding:"1px 5px", letterSpacing:1 }}>{u.pos==="square"?"SQ":"🍞"}</span>
                    <div style={{ flex:1 }} />
                    <div style={{ fontSize:10, color:"#9facc2" }}>{u.total} pins</div>
                  </div>
                  <div style={{ display:"flex", gap:12, paddingLeft:23 }}>
                    {[["worked","▼"],["layover","●"],["remote","◆"]].map(([k,sym])=>(
                      <div key={k} style={{ fontSize:10, color:"#9facc2" }}>
                        <span style={{ color:u.color, marginRight:3 }}>{sym}</span>{u[k]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ padding:"14px 12px 0", borderTop:"1px solid #e3e8ef", marginTop:6 }}>
                <div style={{ fontSize:9, color:"#afbcd1", letterSpacing:2, marginBottom:10 }}>SHAPE KEY</div>
                {Object.entries(PIN_TYPES).map(([key,val])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <PinShape shape={val.shape} color="#9facc2" size={12} />
                    <span style={{ fontSize:10, color:"#9facc2" }}>{val.label}</span>
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
