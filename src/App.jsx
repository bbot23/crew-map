import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

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

function latLngToXY(lat, lng, W, H) {
  const x = ((lng + 180) / 360) * W;
  const r = (lat * Math.PI) / 180;
  const m = Math.log(Math.tan(Math.PI / 4 + r / 2));
  const y = H / 2 - (W * m) / (2 * Math.PI);
  return { x, y };
}

function xyToLatLng(x, y, W, H) {
  const lng = (x / W) * 360 - 180;
  const m   = ((H / 2 - y) * 2 * Math.PI) / W;
  const lat = ((2 * Math.atan(Math.exp(m))) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}

const normPin = (row) => ({ ...row, userId: row.user_id });

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
    const { error } = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({ email: email.trim(), password });
    if (error) setError(error.message);
    else if (mode === "signup") setMsg("Check your email to confirm, then sign in.");
    setLoading(false);
  };

  const ready = email.trim() && password.trim() && !loading;

  return (
    <div style={{ minHeight:"100vh", background:"#080c16", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ width:360, padding:40 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:44, letterSpacing:6, color:"#f1f5f9", lineHeight:1, marginBottom:4 }}>CREW MAP</div>
        <div style={{ fontSize:10, color:"#334155", letterSpacing:3, marginBottom:40 }}>APOS JOB TRACKER</div>

        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:2, marginBottom:8 }}>EMAIL</div>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="you@example.com" autoFocus
            onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{ width:"100%", background:"#0f172a", border:"1px solid #1e293b", color:"#e2e8f0", borderRadius:6, padding:"12px 14px", fontFamily:"'DM Mono'", fontSize:13, outline:"none" }} />
        </div>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:2, marginBottom:8 }}>PASSWORD</div>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="••••••••"
            style={{ width:"100%", background:"#0f172a", border:"1px solid #1e293b", color:"#e2e8f0", borderRadius:6, padding:"12px 14px", fontFamily:"'DM Mono'", fontSize:13, outline:"none" }} />
        </div>

        {error && <div style={{ marginBottom:16, fontSize:11, color:"#ef4444", padding:"8px 10px", background:"#ef444411", borderRadius:5, border:"1px solid #ef444430" }}>{error}</div>}
        {msg   && <div style={{ marginBottom:16, fontSize:11, color:"#22c55e", padding:"8px 10px", background:"#22c55e11", borderRadius:5, border:"1px solid #22c55e30" }}>{msg}</div>}

        <button onClick={submit} disabled={!ready}
          style={{ width:"100%", padding:"14px", background:ready?"#f97316":"#0f172a", color:ready?"#fff":"#334155", border:"none", borderRadius:6, fontFamily:"'Bebas Neue'", fontSize:18, letterSpacing:4, cursor:ready?"pointer":"not-allowed", transition:"all 0.2s", boxShadow:ready?"0 0 24px #f9731655":"none", marginBottom:16 }}>
          {loading ? "..." : mode==="login" ? "SIGN IN" : "CREATE ACCOUNT"}
        </button>

        <div style={{ textAlign:"center" }}>
          <button onClick={()=>{ setMode(m=>m==="login"?"signup":"login"); setError(""); setMsg(""); }}
            style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:10, fontFamily:"'DM Mono'", letterSpacing:1 }}>
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
    <div style={{ minHeight:"100vh", background:"#080c16", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono', monospace" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');`}</style>
      <div style={{ width:360, padding:40 }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:44, letterSpacing:6, color:"#f1f5f9", lineHeight:1, marginBottom:4 }}>CREW MAP</div>
        <div style={{ fontSize:10, color:"#334155", letterSpacing:3, marginBottom:40 }}>APOS JOB TRACKER</div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:2, marginBottom:8 }}>YOUR NAME</div>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onComplete({name:name.trim(),color,pos})}
            placeholder="First name or nickname"
            style={{ width:"100%", background:"#0f172a", border:"1px solid #1e293b", color:"#e2e8f0", borderRadius:6, padding:"12px 14px", fontFamily:"'DM Mono'", fontSize:13, outline:"none" }}
            autoFocus />
        </div>

        <div style={{ marginBottom:36 }}>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:2, marginBottom:12 }}>YOUR COLOR</div>
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
              <div style={{ fontSize:9, color:"#334155", letterSpacing:1, marginBottom:5 }}>CUSTOM HEX</div>
              <input
                value={color}
                onChange={e=>{ const v=e.target.value; if(/^#[0-9a-fA-F]{0,6}$/.test(v)) setColor(v); }}
                placeholder="#f97316" maxLength={7}
                style={{ background:"#0a0e1b", border:`1px solid ${color.length===7?color+"55":"#1e293b"}`, color:color.length===7?color:"#475569", borderRadius:4, padding:"6px 10px", fontFamily:"'DM Mono'", fontSize:12, width:"100%", outline:"none", letterSpacing:2 }} />
            </div>
          </div>
          <div style={{ fontSize:10, color:color.length===7?color:"#334155", marginTop:8, letterSpacing:1 }}>
            {color.length===7 ? "● color preview" : "enter a valid hex code"}
          </div>
        </div>

        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:10, color:"#475569", letterSpacing:2, marginBottom:12 }}>POS PARTNER</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["toast","Toast","#ff6c2f"],["square","Square","#e2e8f0"]].map(([key,label,accent])=>(
              <button key={key} onClick={()=>setPos(key)}
                style={{ flex:1, padding:"12px 8px", background:pos===key?accent+"18":"#0a0e1b", border:`2px solid ${pos===key?accent:"#1e293b"}`, borderRadius:8, cursor:"pointer", fontFamily:"'Bebas Neue'", fontSize:16, letterSpacing:3, color:pos===key?accent:"#334155", transition:"all 0.2s", boxShadow:pos===key?`0 0 16px ${accent}33`:"none" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={()=>name.trim()&&onComplete({name:name.trim(),color,pos})} disabled={!name.trim()}
          style={{ width:"100%", padding:"14px", background:name.trim()?color:"#0f172a", color:name.trim()?"#fff":"#334155", border:"none", borderRadius:6, fontFamily:"'Bebas Neue'", fontSize:18, letterSpacing:4, cursor:name.trim()?"pointer":"not-allowed", transition:"all 0.2s", boxShadow:name.trim()?`0 0 24px ${color}55`:"none" }}>
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
  const mapRef = useRef(null);

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

  const handleMapClick = (e) => {
    if (!me || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (1000 / rect.width);
    const sy = (e.clientY - rect.top)  * (500  / rect.height);
    const { lat, lng } = xyToLatLng(sx, sy, 1000, 500);
    setDropping({ x:e.clientX - rect.left, y:e.clientY - rect.top, lat, lng });
    setPanel("add");
    setForm({ type:"worked", city:"", note:"" });
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
    await supabase.from("pins").insert(pin);
  };

  const handleDelete = async (id) => {
    await supabase.from("pins").delete().eq("id", id);
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const visiblePins  = teamView ? pins : pins.filter(p => p.userId === me?.id);
  const filteredPins = filterType === "all" ? visiblePins : visiblePins.filter(p => p.type === filterType);
  const myPins       = pins.filter(p => p.userId === me?.id);

  const leaderboard = [...new Set(pins.map(p => p.userId))].map(uid => {
    const uPins = pins.filter(p => p.userId === uid);
    const u = users[uid] || { name:uid, color:"#94a3b8" };
    return { ...u, uid, total:uPins.length, worked:uPins.filter(p=>p.type==="worked").length, layover:uPins.filter(p=>p.type==="layover").length, remote:uPins.filter(p=>p.type==="remote").length };
  }).sort((a,b) => b.worked - a.worked);

  // ── Render gates ──────────────────────────────────────────────────────────

  if (session === undefined) return (
    <div style={{ minHeight:"100vh", background:"#080c16", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:28, letterSpacing:6, color:"#0f1c2e" }}>CREW MAP</div>
    </div>
  );

  if (!session) return <AuthScreen />;
  if (!me)      return <SetupScreen onComplete={handleSetup} />;

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily:"'DM Mono', monospace", background:"#080c16", color:"#e2e8f0", height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:#1e293b; border-radius:2px; }
        .map-pin { transition:transform 0.15s ease; cursor:pointer; }
        .map-pin:hover { transform:scale(1.4) translateY(-2px); }
        .pin-pop { animation:popIn 0.3s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes popIn { from { transform:scale(0) translateY(8px); opacity:0; } to { transform:scale(1); opacity:1; } }
        .pulse { animation:pulse 1.8s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; transform:translate(-50%,-50%) scale(1); } 50% { opacity:0.4; transform:translate(-50%,-50%) scale(1.4); } }
        input, textarea { background:#0f172a; border:1px solid #1e293b; color:#e2e8f0; border-radius:5px; padding:8px 10px; font-family:'DM Mono',monospace; font-size:12px; width:100%; outline:none; }
        input:focus, textarea:focus { border-color:#334155; }
        textarea { resize:none; height:56px; }
        .del-btn { opacity:0; transition:opacity 0.15s; }
        .pin-row:hover .del-btn { opacity:1; }
        .cat-btn { transition:all 0.15s; }
        .cat-btn:hover { opacity:0.85; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background:"#09111f", borderBottom:"1px solid #0f1c2e", padding:"9px 16px", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue'", fontSize:20, letterSpacing:4, color:"#f1f5f9" }}>CREW MAP</div>
          <div style={{ fontSize:9, color:"#1e3a5f", letterSpacing:2 }}>APOS JOB TRACKER</div>
        </div>

        <div onClick={()=>setTeamView(v=>!v)} style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", background:teamView?"#0f1c2e":"transparent", border:`1px solid ${teamView?"#1e3a5f":"#0f1c2e"}`, borderRadius:20, padding:"5px 12px", marginLeft:4, transition:"all 0.2s" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:teamView?"#22c55e":"#1e293b", boxShadow:teamView?"0 0 7px #22c55e":"none", transition:"all 0.2s" }} />
          <span style={{ fontSize:9, color:teamView?"#64748b":"#334155", letterSpacing:1 }}>{teamView?"TEAM VIEW ON":"MY VIEW"}</span>
        </div>

        <div style={{ flex:1 }} />

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:me.color, boxShadow:`0 0 8px ${me.color}` }} />
          <span style={{ fontSize:11, color:"#94a3b8" }}>{me.name}</span>
          <span style={{ fontSize:9, color:me.pos==="toast"?"#ff6c2f":"#94a3b8", background:me.pos==="toast"?"#ff6c2f18":"#1e293b", border:`1px solid ${me.pos==="toast"?"#ff6c2f44":"#334155"}`, borderRadius:4, padding:"1px 6px", letterSpacing:1 }}>{me.pos==="toast"?"TOAST":"SQUARE"}</span>
          <span style={{ fontSize:10, color:"#1e293b" }}>·</span>
          <span style={{ fontSize:10, color:"#334155" }}>
            {myPins.filter(p=>p.type==="worked").length}▼ {myPins.filter(p=>p.type==="layover").length}● {myPins.filter(p=>p.type==="remote").length}◆
          </span>
          <button onClick={()=>supabase.auth.signOut()}
            style={{ marginLeft:8, background:"none", border:"1px solid #0f1c2e", color:"#1e3a5f", cursor:"pointer", fontSize:9, fontFamily:"'DM Mono'", letterSpacing:1, borderRadius:4, padding:"3px 8px" }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* ── Map ── */}
        <div ref={mapRef} onClick={handleMapClick} style={{ flex:1, position:"relative", overflow:"hidden", cursor:"crosshair" }}>
          <svg viewBox="0 0 1000 500" style={{ width:"100%", height:"100%", display:"block" }} preserveAspectRatio="xMidYMid meet">
            <rect width="1000" height="500" fill="#09111f" />
            {[...Array(9)].map((_,i)=><line key={`v${i}`} x1={(i+1)*100} y1="0" x2={(i+1)*100} y2="500" stroke="#0d1a2b" strokeWidth="0.7"/>)}
            {[...Array(5)].map((_,i)=><line key={`h${i}`} x1="0" y1={(i+1)*83} x2="1000" y2={(i+1)*83} stroke="#0d1a2b" strokeWidth="0.7"/>)}
            <line x1="0" y1="250" x2="1000" y2="250" stroke="#111f33" strokeWidth="1"/>
            <path d="M 95,60 L 175,55 L 200,70 L 210,100 L 195,115 L 220,130 L 235,155 L 215,175 L 200,185 L 175,190 L 160,210 L 145,230 L 130,245 L 115,240 L 105,220 L 90,200 L 85,175 L 75,155 L 70,130 L 80,105 L 85,80 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 145,230 L 160,210 L 175,215 L 170,235 L 158,248 L 150,255 L 145,245 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 155,255 L 175,250 L 205,255 L 225,275 L 235,310 L 240,350 L 225,390 L 200,415 L 175,420 L 155,400 L 140,370 L 135,335 L 140,295 L 150,270 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 440,70 L 465,65 L 490,68 L 505,80 L 510,95 L 495,105 L 480,110 L 460,108 L 445,100 L 435,88 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 455,50 L 470,45 L 480,55 L 472,70 L 460,68 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 448,75 L 455,72 L 458,80 L 453,85 L 448,82 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 445,145 L 475,138 L 510,142 L 530,165 L 535,205 L 530,250 L 515,295 L 495,335 L 475,350 L 455,345 L 435,310 L 425,265 L 420,220 L 425,175 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 510,95 L 545,90 L 565,105 L 570,125 L 555,140 L 530,142 L 510,130 L 505,112 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 490,50 L 560,40 L 650,38 L 730,45 L 790,55 L 820,70 L 800,90 L 760,100 L 720,108 L 680,112 L 640,115 L 600,120 L 570,125 L 545,118 L 520,110 L 505,95 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 600,120 L 640,115 L 660,130 L 665,155 L 650,175 L 630,180 L 610,165 L 600,145 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 700,130 L 730,125 L 755,135 L 760,155 L 745,168 L 720,165 L 705,150 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 660,95 L 710,88 L 740,95 L 755,115 L 750,135 L 720,138 L 690,135 L 665,125 L 655,108 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 775,100 L 785,95 L 792,105 L 786,115 L 778,112 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 720,300 L 770,290 L 820,300 L 845,325 L 840,360 L 815,380 L 775,385 L 740,370 L 718,345 L 715,315 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <path d="M 195,25 L 225,20 L 245,30 L 240,50 L 218,58 L 198,48 Z" fill="#0f1e33" stroke="#1a3a5c" strokeWidth="0.8"/>
            <text x="500" y="493" textAnchor="middle" fill="#0d1a2b" fontSize="8" fontFamily="'DM Mono', monospace" letterSpacing="4">CLICK TO DROP A PIN</text>
          </svg>

          {/* Pins */}
          {filteredPins.map(pin => {
            const rect = mapRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const pos   = latLngToXY(pin.lat, pin.lng, 1000, 500);
            const px    = (pos.x / 1000) * rect.width;
            const py    = (pos.y / 500)  * rect.height;
            const owner = users[pin.userId] || me;
            const color = owner?.color || "#94a3b8";
            const isMe  = pin.userId === me?.id;
            const shape = PIN_TYPES[pin.type]?.shape || "pin";
            const isHov = hovered === pin.id;
            return (
              <div key={pin.id} className="map-pin pin-pop"
                style={{ position:"absolute", left:px, top:py, transform:"translate(-50%,-100%)", zIndex:isHov?30:isMe?15:10, opacity:teamView&&!isMe?0.7:1 }}
                onMouseEnter={()=>setHovered(pin.id)} onMouseLeave={()=>setHovered(null)}>
                <PinShape shape={shape} color={color} size={isMe?20:16} />
                {isHov && (
                  <div style={{ position:"absolute", bottom:"115%", left:"50%", transform:"translateX(-50%)", background:"#09111f", border:`1px solid ${color}`, borderRadius:6, padding:"8px 12px", whiteSpace:"nowrap", fontSize:11, zIndex:50, pointerEvents:"none", boxShadow:`0 4px 20px ${color}44` }}>
                    <div style={{ color, fontWeight:500, marginBottom:3 }}>{pin.city}</div>
                    <div style={{ color:"#475569", fontSize:9, letterSpacing:1 }}>{PIN_TYPES[pin.type]?.label?.toUpperCase()} · {pin.date}</div>
                    {teamView && <div style={{ color:color+"aa", fontSize:9, marginTop:2 }}>{owner?.name}</div>}
                    {pin.note && <div style={{ color:"#64748b", marginTop:4, fontSize:10, maxWidth:180 }}>{pin.note}</div>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Drop cursor */}
          {dropping && (
            <div className="pulse" style={{ position:"absolute", left:dropping.x, top:dropping.y, width:13, height:13, borderRadius:"50%", background:me.color, border:"2px solid white", transform:"translate(-50%,-50%)", pointerEvents:"none", zIndex:40 }} />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ width:268, background:"#09111f", borderLeft:"1px solid #0f1c2e", display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:"1px solid #0f1c2e", flexShrink:0 }}>
            {[["list","LOG"],["add","+ PIN"],["board","CREW"]].map(([key,lbl])=>(
              <button key={key} onClick={()=>{ setPanel(key); if(key!=="add") setDropping(null); }}
                style={{ flex:1, padding:"10px 4px", background:panel===key?"#0f1c2e":"transparent", color:panel===key?"#e2e8f0":"#1e3a5f", border:"none", cursor:"pointer", fontSize:9, letterSpacing:2, fontFamily:"'DM Mono'", borderBottom:panel===key?`2px solid ${me.color}`:"2px solid transparent", transition:"color 0.15s" }}>
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
                    style={{ padding:"3px 9px", borderRadius:10, background:filterType===key?"#0f1c2e":"transparent", border:`1px solid ${filterType===key?"#1e3a5f":"#0f1c2e"}`, color:filterType===key?"#94a3b8":"#1e3a5f", fontSize:10, cursor:"pointer", fontFamily:"'DM Mono'" }}>
                    {lbl}
                  </button>
                ))}
              </div>
              {filteredPins.length===0 ? (
                <div style={{ padding:"30px 20px", textAlign:"center", color:"#0f1c2e", fontSize:11 }}>
                  {teamView?"No team pins yet.":"No pins yet."}<br/><span style={{ fontSize:10 }}>Click the map to start.</span>
                </div>
              ) : filteredPins.slice().reverse().map(pin => {
                const owner = users[pin.userId] || me;
                const color = owner?.color || "#94a3b8";
                const t     = PIN_TYPES[pin.type];
                const isMe  = pin.userId === me?.id;
                return (
                  <div key={pin.id} className="pin-row" style={{ padding:"9px 10px", borderBottom:"1px solid #0b1220", display:"flex", gap:8, alignItems:"flex-start" }}
                    onMouseEnter={()=>setHovered(pin.id)} onMouseLeave={()=>setHovered(null)}>
                    <div style={{ marginTop:2, flexShrink:0 }}>
                      <PinShape shape={t.shape} color={color} size={12} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.city}</div>
                      <div style={{ fontSize:9, color:"#1e3a5f", letterSpacing:1 }}>
                        {t.label.toUpperCase()} · {pin.date}
                        {teamView&&!isMe&&<span style={{ color:color+"cc", marginLeft:4 }}>· {owner.name}</span>}
                      </div>
                      {pin.note&&<div style={{ fontSize:10, color:"#334155", marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pin.note}</div>}
                    </div>
                    {isMe && (
                      <button className="del-btn" onClick={()=>handleDelete(pin.id)}
                        style={{ background:"none", border:"none", color:"#1e3a5f", cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1 }}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ADD PIN */}
          {panel==="add" && (
            <div style={{ padding:14, display:"flex", flexDirection:"column", gap:13, overflowY:"auto" }}>
              <div style={{ fontSize:9, color:dropping?"#475569":"#1e293b", letterSpacing:1 }}>
                {dropping?`📍 ${dropping.lat.toFixed(1)}°, ${dropping.lng.toFixed(1)}°`:"← CLICK MAP TO SELECT SPOT"}
              </div>
              <div>
                <div style={{ fontSize:9, color:"#334155", letterSpacing:2, marginBottom:7 }}>CATEGORY</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  {Object.entries(PIN_TYPES).map(([key,val])=>(
                    <button key={key} className="cat-btn" onClick={()=>setForm(f=>({...f,type:key}))}
                      style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 10px", background:form.type===key?"#0f1c2e":"transparent", border:`1px solid ${form.type===key?"#1e3a5f":"#0d1a2b"}`, borderRadius:5, cursor:"pointer", textAlign:"left", fontFamily:"'DM Mono'" }}>
                      <PinShape shape={val.shape} color={form.type===key?me.color:"#1e3a5f"} size={13} />
                      <span style={{ fontSize:11, color:form.type===key?"#e2e8f0":"#334155" }}>{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:9, color:"#334155", letterSpacing:2, marginBottom:6 }}>CITY / LOCATION</div>
                <input placeholder="Austin, TX" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleAddPin()} />
              </div>
              <div>
                <div style={{ fontSize:9, color:"#334155", letterSpacing:2, marginBottom:6 }}>NOTE (OPTIONAL)</div>
                <textarea placeholder="Brewery install, day 2..." value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} />
              </div>
              <button onClick={handleAddPin} disabled={!dropping||!form.city.trim()}
                style={{ padding:"11px", background:dropping&&form.city.trim()?me.color:"#0a1120", color:dropping&&form.city.trim()?"#fff":"#1e293b", border:"none", borderRadius:5, fontFamily:"'Bebas Neue'", fontSize:15, letterSpacing:3, cursor:dropping&&form.city.trim()?"pointer":"not-allowed", transition:"all 0.2s", boxShadow:dropping&&form.city.trim()?`0 0 18px ${me.color}55`:"none" }}>
                DROP PIN
              </button>
              {!dropping&&<div style={{ fontSize:9, color:"#1e293b", textAlign:"center" }}>click the map first</div>}
            </div>
          )}

          {/* CREW BOARD */}
          {panel==="board" && (
            <div style={{ flex:1, overflowY:"auto", padding:"10px 0" }}>
              <div style={{ padding:"0 12px 8px", fontSize:9, color:"#1e3a5f", letterSpacing:2 }}>LEADERBOARD</div>
              {leaderboard.length===0 ? (
                <div style={{ padding:20, textAlign:"center", color:"#0f1c2e", fontSize:11 }}>No crew data yet.</div>
              ) : leaderboard.map((u,i) => (
                <div key={u.uid} style={{ padding:"10px 12px", borderBottom:"1px solid #0b1220" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                    <div style={{ fontFamily:"'Bebas Neue'", fontSize:15, color:i===0?"#f59e0b":"#1e3a5f", width:16, flexShrink:0 }}>{i+1}</div>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:u.color, boxShadow:`0 0 7px ${u.color}`, flexShrink:0 }} />
                    <div style={{ fontSize:12, color:u.uid===me.id?u.color:"#94a3b8" }}>{u.name}{u.uid===me.id&&" (you)"}</div>
                    <span style={{ fontSize:8, color:u.pos==="toast"?"#ff6c2f":"#94a3b8", background:u.pos==="toast"?"#ff6c2f18":"#1e293b22", border:`1px solid ${u.pos==="toast"?"#ff6c2f33":"#33415533"}`, borderRadius:3, padding:"1px 5px", letterSpacing:1 }}>{u.pos==="square"?"SQ":"🍞"}</span>
                    <div style={{ flex:1 }} />
                    <div style={{ fontSize:10, color:"#334155" }}>{u.total} pins</div>
                  </div>
                  <div style={{ display:"flex", gap:12, paddingLeft:23 }}>
                    {[["worked","▼"],["layover","●"],["remote","◆"]].map(([k,sym])=>(
                      <div key={k} style={{ fontSize:10, color:"#334155" }}>
                        <span style={{ color:u.color, marginRight:3 }}>{sym}</span>{u[k]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ padding:"14px 12px 0", borderTop:"1px solid #0b1220", marginTop:6 }}>
                <div style={{ fontSize:9, color:"#1e3a5f", letterSpacing:2, marginBottom:10 }}>SHAPE KEY</div>
                {Object.entries(PIN_TYPES).map(([key,val])=>(
                  <div key={key} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <PinShape shape={val.shape} color="#334155" size={12} />
                    <span style={{ fontSize:10, color:"#334155" }}>{val.label}</span>
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
