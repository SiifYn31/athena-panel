import React,{useEffect,useState}from"react";
import{createRoot}from"react-dom/client";
import axios from"axios";
import{io}from"socket.io-client";
import{Shield,Users,Ban,Activity,KeyRound,Search,Terminal,Map,Settings,Download,LogOut,Save,ShieldCheck,Camera,Radio,FileDown,Power,Eye,Play,Square,RotateCw}from"lucide-react";
import{AreaChart,Area,XAxis,YAxis,Tooltip,ResponsiveContainer,PieChart,Pie,Cell}from"recharts";
import logo from"./assets/athena-logo.png";
import gtaMap from "./assets/map.jpg";
import"./style.css";

const API=import.meta.env.VITE_API_URL||"http://localhost:4010";
const api=t=>axios.create({baseURL:API,headers:{Authorization:`Bearer ${t}`}});
const empty={stats:{},players:[],detections:[],bans:[],logs:[],resources:[],streams:[],screenshots:[],whitelist:[],admins:[],hwid:[],risk:[],sessions:[],config:{detections:{}}};

function fixImage(img){
  if(!img) return "https://placehold.co/1280x720/06101f/16d8ff?text=NO+SCREEN";
  if(typeof img !== "string") return "https://placehold.co/1280x720/06101f/16d8ff?text=BAD+SCREEN";
  let s = img.trim();

  try{
    if(s.startsWith("{")){
      const j = JSON.parse(s);
      s = j.data || j.url || j.image || j.files?.[0]?.url || s;
    }
  }catch(e){}

  if(s.startsWith("http://") || s.startsWith("https://") || s.startsWith("blob:")) return s;
  if(s.startsWith("data:image/")) return s;
  if(s.startsWith("/9j/")) return "data:image/jpeg;base64," + s;
  if(s.startsWith("iVBOR")) return "data:image/png;base64," + s;
  if(s.startsWith("UklGR")) return "data:image/webp;base64," + s;

  return "data:image/jpeg;base64," + s;
}

function WebRTCViewer(){
  return <Page title="WebRTC Live Video">
    <Panel title="Live Player Video">
      <video id="athena-video" autoPlay playsInline controls style={{width:"100%",borderRadius:"18px",background:"#000"}} />
      <p>Waiting for player stream...</p>
    </Panel>
  </Page>
}

function SafeImage({src, alt="", className=""}){
  return <img
    src={fixImage(src)}
    alt={alt}
    className={className}
    loading="lazy"
    onError={(e)=>{
      console.log("ATHENA IMAGE ERROR", String(src||"").slice(0,120));
      e.currentTarget.src="https://placehold.co/1280x720/06101f/16d8ff?text=SCREEN+FAILED";
    }}
  />
}


function Login({onLogin}){const[e,setE]=useState("admin@athena.local"),[p,setP]=useState("admin123"),[err,setErr]=useState("");async function sub(x){x.preventDefault();try{let{data}=await axios.post(`${API}/api/auth/login`,{email:e,password:p});localStorage.setItem("athena_token",data.token);onLogin(data.token)}catch{setErr("Login failed")}}return <div className="login"><div className="loginBox"><img src={logo}/><h1>ATHENA SHIELD</h1><p>REAL OPERATIONS CENTER</p><form onSubmit={sub}><input value={e}onChange={x=>setE(x.target.value)}/><input type="password"value={p}onChange={x=>setP(x.target.value)}/>{err&&<b>{err}</b>}<button>ENTER PANEL</button></form></div></div>}
function Side({page,setPage,logout}){let items=[["Dashboard",Shield],["Live Ops",Activity],["Streams",Radio],["Players",Users],["Map",Map],["Bans",Ban],["Whitelist",ShieldCheck],["Configuration",Settings],["Lookup",Search],["Admins",KeyRound],["Logs",Activity],["Console",Terminal],["HWID/IP",Eye],["Screenshots",Camera],["Risk",Activity],["Resources",Power],["Download",FileDown]];return <aside><div className="brand"><img src={logo}/><div><b>ATHENA PVP</b><small>Final Real Ops</small></div></div>{items.map(([n,I])=><button key={n}className={page===n?"active":""}onClick={()=>setPage(n)}><I size={16}/>{n}</button>)}<button onClick={logout}><LogOut size={16}/>Logout</button></aside>}
function Page({title,children,right}){return <main><div className="top"><h2>{title}</h2><div className="right">{right}</div></div>{children}</main>}
function Panel({title,children,cls=""}){return <section className={"panel "+cls}><h3>{title}</h3>{children}</section>}
function Stat({t,v,cls=""}){return <div className={"stat "+cls}><small>{t}</small><b>{v}</b></div>}
function Card({title,sub,children,cls=""}){return <div className={"card "+cls}><b>{title}</b><small>{sub}</small>{children}</div>}
function Feed({rows=[]}){return <div className="list">{rows.slice(0,70).map(x=><Card key={x.id||JSON.stringify(x)} title={x.reason||x.type||x.name||x.banId||x.value||"Item"} sub={`${x.playerName||x.by||""} ${x.details||x.note||JSON.stringify(x.payload||{}).slice(0,130)}`} cls={x.reason?"threat":""}/>)}</div>}

function Dashboard({d}){let s=d.stats||{};let chart=[...Array(24)].map((_,i)=>({time:`${i}:00`,detections:d.detections?.filter(x=>new Date(x.createdAt).getHours()==i).length||0,players:s.onlineNow||0}));let pie=[{name:"Detections",value:s.totalDetections||0},{name:"Bans",value:s.totalBans||0},{name:"Online",value:s.onlineNow||0}];return <Page title="Server Analytics"><div className="hero"><img src={logo}/><div><h1>ATHENA REAL OPS</h1><p>Dashboard real from FiveM bridge. No fake/demo counters.</p></div></div><div className="stats"><Stat t="Online Now"v={s.onlineNow||0}cls="green"/><Stat t="Active Bans"v={s.totalBans||0}cls="red"/><Stat t="Detections 24h"v={s.detections24||0}/><Stat t="Resources"v={s.resources||0}/><Stat t="Streams"v={s.streams||0}/></div><div className="grid2"><Panel title="Realtime Server Analytics"><ResponsiveContainer height={300}><AreaChart data={chart}><XAxis dataKey="time"/><YAxis/><Tooltip/><Area dataKey="detections"stroke="#16d8ff"fill="#16d8ff33"/><Area dataKey="players"stroke="#ff2f55"fill="#ff2f5533"/></AreaChart></ResponsiveContainer></Panel><Panel title="Threat Breakdown"><ResponsiveContainer height={300}><PieChart><Pie data={pie}dataKey="value"innerRadius={75}outerRadius={110}>{pie.map((x,i)=><Cell key={i}fill={["#16d8ff","#ff2f55","#10d984"][i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></Panel></div></Page>}
function LiveOps({d,token,refresh}){async function act(id,a){await api(token).post(`/api/actions/player/${id}/${a}`,{});refresh()}return <Page title="Live Operations"right={<button onClick={refresh}>Refresh</button>}><div className="ops"><Panel title="Live Players">{d.players.map(p=><Card key={p.id}title={p.name}sub={`ID ${p.id} | Ping ${p.ping||"-"} | ${p.coords?`${Math.round(p.coords.x)}, ${Math.round(p.coords.y)}, ${Math.round(p.coords.z)}`:"no coords"}`}><div className="row"><button onClick={()=>act(p.id,"screenshot")}>Screenshot</button><button onClick={()=>act(p.id,"freeze")}>Freeze</button><button onClick={async()=>{
  await act(p.id,"screenshot")
  setTimeout(()=>setPage("Streams"),700)
}}>Spectate</button><button onClick={()=>act(p.id,"kick")}>Kick</button><button onClick={()=>act(p.id,"ban")}>Ban</button></div></Card>)}</Panel><Panel title="Threat Feed / History">
  <div className="history">
    {[
      ...(d.detections || []).map(x => ({
        type: "Detection",
        title: x.reason,
        player: x.playerName,
        detail: x.details,
        time: x.createdAt
      })),
      ...(d.logs || []).map(x => ({
        type: "Log",
        title: x.type,
        player: x.by,
        detail: JSON.stringify(x.payload || {}),
        time: x.createdAt
      })),
      ...(d.actions || []).map(x => ({
        type: "Action",
        title: x.type,
        player: x.by,
        detail: `Target: ${x.playerId || x.resource || "-"}`,
        time: x.createdAt
      }))
    ]
    .sort((a,b)=>(b.time||0)-(a.time||0))
    .slice(0,50)
    .map((h,i)=>(
      <div className="historyItem" key={i}>
        <b>{h.type}: {h.title}</b>
        <small>{h.player || "system"} • {h.time ? new Date(h.time).toLocaleTimeString() : ""}</small>
        <p>{h.detail}</p>
      </div>
    ))}
  </div>
</Panel><Panel title="Resource Status">{d.resources.slice(0,100).map(r=><Card key={r.name}title={r.name}sub={r.state}/>)}</Panel></div></Page>}
function Streams({token}){let[rows,setRows]=useState([]),[watch,setWatch]=useState(null);async function load(){setRows((await api(token).get("/api/streams")).data)}async function mock(){await api(token).post("/api/streams/mock",{});load()}async function act(id,a){await api(token).post(`/api/actions/player/${id}/${a}`,{});setTimeout(load,700)}useEffect(()=>{load();let t=setInterval(load,3000);return()=>clearInterval(t)},[]);return <Page title="Multi Stream / Spectate"right={<><button onClick={mock}>Test Stream</button><button onClick={load}>Refresh</button></>}><div className="streams">{rows.map(s=><div className={"stream "+(watch===s.playerId?"watching":"")}key={s.id}><SafeImage src={s.image} alt={s.playerName||"stream"}/><div className="streamTop"><b>{s.playerName}</b><span>ID {s.playerId}</span></div><div className="streamMeta"><span>HP {s.health??"-"}</span><span>AR {s.armor??"-"}</span><span>{s.weapon||"-"}</span></div><div className="row streamBtns"><button onClick={()=>setWatch(s.playerId)}>Watch</button><button onClick={()=>act(s.playerId,"screenshot")}>Screenshot</button><button onClick={()=>act(s.playerId,"ban")}>Ban</button></div></div>)}</div></Page>}
function Players({d,token,refresh}){let[selected,setSelected]=useState(null);async function act(id,a){await api(token).post(`/api/actions/player/${id}/${a}`,{});refresh()}return <Page title="Players"><div className="grid2"><Panel title="Online Players">{d.players.map(p=><Card key={p.id}title={p.name}sub={`ID ${p.id} | ${p.identifiers?.[0]||"no identifier"}`}><div className="row"><button onClick={()=>setSelected(p)}>Info</button><button onClick={()=>act(p.id,"screenshot")}>Screen</button><button onClick={()=>act(p.id,"freeze")}>Freeze</button><button onClick={()=>act(p.id,"kick")}>Kick</button><button onClick={()=>act(p.id,"ban")}>Ban</button></div></Card>)}</Panel><Panel title="Player Info">{selected?<pre>{JSON.stringify(selected,null,2)}</pre>:<p>Select player</p>}</Panel></div></Page>}
function MapPage({d}){

  return (
    <Page title="ATHENA Tactical Map">

      <div className="mapWrap">

<img
  src={gtaMap}
  className="gtaMap"
/>

        {(d.players || []).map((p,i)=>{

          const x = ((p.coords?.x || 0) + 4000) / 8000 * 100
          const y = (1 - ((p.coords?.y || 0) + 4000) / 8000) * 100

          return (
            <div
              key={i}
              className="mapPlayer"
              style={{
                left:`${x}%`,
                top:`${y}%`
              }}
            >
              <div className="dot"/>
              <span>{p.name}</span>
            </div>
          )

        })}

      </div>

    </Page>
  )
}
function Bans({d,token,refresh}){
  async function unban(id){
    await api(token).post(`/api/bans/${id}/unban`);
    await refresh();
  }

  const bans = (d.bans || []).filter(b => b.active !== false);

  return <Page title="Ban Center">
    <div className="banGrid">
      {bans.map(b=>
        <div className="banCard" key={b.id}>
          <div>
            <h3>{b.banId}</h3>
            <b>{b.playerName}</b>
            <p><strong>Reason:</strong> {b.reason}</p>
            <p><strong>By:</strong> {b.by || "ATHENA"}</p>
            <p><strong>Date:</strong> {b.createdAt ? new Date(b.createdAt).toLocaleString() : "-"}</p>
            {b.screen && <SafeImage src={b.screen} alt={b.banId || "ban evidence"}/>}
          </div>

          <button onClick={()=>unban(b.banId)}>
            Revoke Ban
          </button>
        </div>
      )}
    </div>
  </Page>
}
function Whitelist({d,token,refresh}){
  let[v,setV]=useState(""),[type,setType]=useState("license"),[note,setNote]=useState("");

  async function add(){
    if(!v.trim()) return;
    await api(token).post("/api/whitelist",{type,value:v.trim(),note});
    setV(""); setNote("");
    refresh();
  }

  async function del(id){
    await api(token).delete(`/api/whitelist/${id}`);
    refresh();
  }

  return <Page title="Whitelist Center">
    <div className="whiteHero">
      <h1>ATHENA WHITELIST</h1>
      <p>Protected identifiers list. Add, review, and remove trusted players.</p>
    </div>

    <div className="whiteForm">
      <select value={type} onChange={e=>setType(e.target.value)}>
        <option>license</option>
        <option>license2</option>
        <option>discord</option>
        <option>fivem</option>
        <option>ip</option>
      </select>

      <input value={v} onChange={e=>setV(e.target.value)} placeholder="identifier / discord / ip"/>
      <input value={note} onChange={e=>setNote(e.target.value)} placeholder="note"/>
      <button onClick={add}>Add Whitelist</button>
    </div>

    <div className="whiteList">
      {(d.whitelist||[]).map(w=>
        <div className="whiteCard" key={w.id}>
          <div>
            <b>{w.type}</b>
            <code>{w.value}</code>
            <small>{w.note || "No note"} • {w.by || "ATHENA"}</small>
          </div>
          <button onClick={()=>del(w.id)}>Remove</button>
        </div>
      )}
    </div>
  </Page>
}

function Config({d,token,refresh}){
  let[c,setC]=useState(d.config||{detections:{},punishments:{},blacklists:{}});
  let[tab,setTab]=useState("Combat");
  let[search,setSearch]=useState("");
  let[inputs,setInputs]=useState({weapons:"",vehicles:"",peds:"",objects:""});

  async function save(){
    useEffect(()=>{
  setC(d.config||{detections:{},punishments:{},blacklists:{}});
},[d.config]);
  await api(token).put("/api/config",c);
  refresh();
}

async function addBlack(type){
  const value=(inputs[type]||"").trim();
  if(!value)return;

  const old=c.blacklists?.[type]||[];
  if(old.includes(value)) return;

  const newConfig={
    ...c,
    blacklists:{
      ...(c.blacklists||{}),
      [type]:[...old,value]
    }
  };

  setC(newConfig);
  setInputs({...inputs,[type]:""});

  await api(token).put("/api/config",newConfig);
  refresh();
}

async function removeBlack(type,value){
  const newConfig={
    ...c,
    blacklists:{
      ...(c.blacklists||{}),
      [type]:(c.blacklists?.[type]||[]).filter(x=>x!==value)
    }
  };

  setC(newConfig);

  await api(token).put("/api/config",newConfig);
  refresh();
}

  const categories={
    Combat:["weapon_spawn","blacklisted_weapon","infinite_ammo","no_reload","rapid_fire","damage_multiplier","spoofed_damage_multiplier","magic_bullet","silent_aim","aimbot","triggerbot","no_recoil","no_spread","thick_bullet","piercing","explosive_ammo","incendiary_ammo","one_shot_kill"],
    Player:["godmode","semi_god","anti_headshot","anti_ragdoll","no_collision","super_jump","beast_jump","fast_run","swim_speed","infinite_stamina","noclip","fly_mode","invisibility","freecam","spectate_player","thermal_vision","night_vision","teleport","lag_switch","force_desync","vehicle_desync","never_wanted"],
    Vehicle:["vehicle_spawner","vehicle_boost","vehicle_godmode","power_multiplier","max_vehicle","auto_repair","bulletproof_tires","vehicle_jump","keep_on_ground","plate_change","vehicle_color_abuse","engine_force","tesla_mode","fly_vehicle"],
    World:["object_spawner","ped_spawner","explosions","projectile_abuse","particle_fx_abuse","trigger_spam","resource_stop","executor_injection","fake_chat","cage_player","money_drop","weather_time_abuse"],
    Evidence:["auto_screenshot","evidence_before_ban","auto_stream","webhook_alert","risk_score","ban_evidence_pack"],
    Blacklist:["blacklisted_weapons","blacklisted_vehicles","blacklisted_peds","blacklisted_objects"]
  };

  const det=c.detections||{};
  const punish=c.punishments||{};
  const list=(categories[tab]||[]).filter(x=>x.toLowerCase().includes(search.toLowerCase()));

  function toggle(k,val){
    setC({...c,detections:{...det,[k]:val}});
  }

  function setPunish(k,val){
    setC({...c,punishments:{...punish,[k]:val}});
  }

  return <Page title="ATHENA Configuration" right={<button onClick={save}><Save size={14}/> Save Config</button>}>
    <div className="configHero">
      <h1>ATHENA DETECTION MATRIX</h1>
      <p>Combat, Player, Vehicle, World and Evidence controls. Real config, saved to API.</p>
      <div className="configStats">
        <span>{Object.values(det).filter(Boolean).length} Enabled</span>
        <span>{Object.keys(det).length} Total Rules</span>
        <span>Mode: {c.mode || "strict"}</span>
      </div>
    </div>

    <div className="configCore">
      <div className="coreCard">
        <b>Auto Ban</b>
        <input type="checkbox" checked={c.autoBan!==false} onChange={e=>setC({...c,autoBan:e.target.checked})}/>
      </div>
      <div className="coreCard">
        <b>Evidence Before Ban</b>
        <input type="checkbox" checked={c.evidenceBeforeBan!==false} onChange={e=>setC({...c,evidenceBeforeBan:e.target.checked})}/>
      </div>
      <div className="coreCard">
        <b>Webhook</b>
        <input type="checkbox" checked={c.webhookEnabled||false} onChange={e=>setC({...c,webhookEnabled:e.target.checked})}/>
      </div>
      <div className="coreCard">
        <b>Confidence</b>
        <input type="number" value={c.detectionConfidence||70} onChange={e=>setC({...c,detectionConfidence:Number(e.target.value)})}/>
      </div>
    </div>

    <input className="configSearch" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search detection..."/>

    <div className="configTabs">
      {Object.keys(categories).map(x=>
        <button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}>{x}</button>
      )}
    </div>

{tab==="Blacklist" && (
  <div className="blackListGrid">
    {[
      ["weapons","Weapons","WEAPON_RPG"],
      ["vehicles","Vehicles","rhino"],
      ["peds","Peds","u_m_y_juggernaut_01"],
      ["objects","Objects","prop_money_bag_01"]
    ].map(([type,title,placeholder])=>(
      <div className="blackListCard" key={type}>
        <div className="blackTop">
          <h3>{title}</h3>
          <b>{(c.blacklists?.[type]||[]).length}</b>
        </div>

        <div className="blackAdd">
          <input
            value={inputs[type]||""}
            onChange={e=>setInputs({...inputs,[type]:e.target.value})}
            placeholder={placeholder}
          />
          <button onClick={()=>addBlack(type)}>Add</button>
        </div>

        <div className="blackItems">
          {(c.blacklists?.[type]||[]).map(item=>(
            <div className="blackItem" key={item}>
              <code>{item}</code>
              <button onClick={()=>removeBlack(type,item)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
)}

    {tab!=="Blacklist" && <div className="detectGrid">
      {list.map(k=>
        <div className={"detectCard "+(det[k]!==false?"on":"off")} key={k}>
          <div>
            <b>{k.replaceAll("_"," ").toUpperCase()}</b>
            <small>{tab} detection module</small>
          </div>

          <label className="switch">
            <input type="checkbox" checked={det[k]!==false} onChange={e=>toggle(k,e.target.checked)}/>
            <span></span>
          </label>

          <select value={punish[k]||"ban"} onChange={e=>setPunish(k,e.target.value)}>
            <option value="log">Log</option>
            <option value="screenshot">Screenshot</option>
            <option value="freeze">Freeze</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
        </div>
      )}
    </div>}
  </Page>
}
function Lookup({token}){let[q,setQ]=useState(""),[r,setR]=useState(null);async function search(){setR((await api(token).get(`/api/lookup?q=${encodeURIComponent(q)}`)).data)}return <Page title="Real Lookup"right={<><input className="search"value={q}onChange={e=>setQ(e.target.value)}placeholder="license / discord / ban / ip / name"/><button onClick={search}>Search</button></>}><div className="lookup">{r&&Object.keys(r).filter(k=>k!=="query").map(k=><Panel key={k}title={`${k} (${r[k].length})`}><Feed rows={r[k].map(x=>({id:x.id||JSON.stringify(x),reason:x.name||x.playerName||x.banId||x.value||x.type,playerName:x.reason||x.details||x.note||JSON.stringify(x).slice(0,120)}))}/></Panel>)}</div></Page>}
function Admins({d,token,refresh}){let[f,setF]=useState({name:"",email:"",password:"",role:"admin"});async function add(){await api(token).post("/api/admins",f);refresh()}async function del(id){await api(token).delete(`/api/admins/${id}`);refresh()}return <Page title="Admins"><div className="form"><input placeholder="name"value={f.name}onChange={e=>setF({...f,name:e.target.value})}/><input placeholder="email"value={f.email}onChange={e=>setF({...f,email:e.target.value})}/><input placeholder="password"value={f.password}onChange={e=>setF({...f,password:e.target.value})}/><select value={f.role}onChange={e=>setF({...f,role:e.target.value})}><option>owner</option><option>superadmin</option><option>admin</option><option>moderator</option></select><button onClick={add}>Add Admin</button></div><div className="grid3">{d.admins.map(a=><Card key={a.id}title={a.email}sub={a.role}><button onClick={()=>del(a.id)}>Delete</button></Card>)}</div></Page>}
function Console({d,token}){let[cmd,setCmd]=useState("");async function send(){await api(token).post("/api/actions/player/server/console",{cmd});setCmd("")}return <Page title="Console"><Panel title="Live Console / Logs"><div className="console">{d.logs.map(l=><p key={l.id}><span>{new Date(l.createdAt).toLocaleTimeString()}</span> {l.type} {JSON.stringify(l.payload)}</p>)}</div><div className="form"><input value={cmd}onChange={e=>setCmd(e.target.value)}placeholder="command"/><button onClick={send}>Send</button></div></Panel></Page>}
function Resources({d,token,refresh}){async function act(n,a){await api(token).post(`/api/resources/${encodeURIComponent(n)}/${a}`);refresh()}return <Page title="Resources Control"><div className="grid3">{d.resources.map(r=><Card key={r.name}title={r.name}sub={r.state}><div className="row"><button onClick={()=>act(r.name,"start")}><Play size={12}/>Start</button><button onClick={()=>act(r.name,"stop")}><Square size={12}/>Stop</button><button onClick={()=>act(r.name,"restart")}><RotateCw size={12}/>Restart</button></div></Card>)}</div></Page>}
function Generic({title,rows=[]}){return <Page title={title}><div className="grid3">{rows.map((r,i)=><Card key={r.id||i}title={r.name||r.playerName||r.id||r.banId||"Item"}sub={JSON.stringify(r).slice(0,220)}/>)}</div></Page>}
function Screenshots({d,token,refresh}){async function mock(){await api(token).post("/api/screenshots/mock",{playerName:"Manual Test",reason:"Manual evidence"});refresh()}return <Page title="Screenshots"right={<button onClick={mock}>Test Screenshot</button>}><div className="streams">{d.screenshots.map(s=><div className="stream"key={s.id}><SafeImage src={s.image} alt={s.playerName||"stream"}/><div className="streamTop"><b>{s.playerName}</b><span>{s.reason}</span></div></div>)}</div></Page>}
function DownloadPage({token}){let[code,setCode]=useState("20060331");function dl(){window.open(`${API}/api/download/bridge?code=${code}`)}return <Page title="Download Center"><Panel title="Protected Files"><input value={code}onChange={e=>setCode(e.target.value)}placeholder="code"/><button onClick={dl}><Download size={14}/>Download</button><p>Code: 20060331</p></Panel></Page>}
function App(){let[token,setToken]=useState(localStorage.getItem("athena_token")),[page,setPage]=useState("Dashboard"),[d,setD]=useState(empty);async function load(){if(!token)return;setD((await api(token).get("/api/dashboard")).data)}useEffect(()=>{load()},[token]);useEffect(()=>{if(!token)return;let s=io(API);["snapshot:update","detection:new","ban:new","stream:update","screenshot:new","log:new","config:update"].forEach(e=>s.on(e,load));return()=>s.close()},[token]);if(!token)return <Login onLogin={setToken}/>;let props={d,token,refresh:load};return <div className="app"><Side page={page}setPage={setPage}logout={()=>{localStorage.removeItem("athena_token");setToken(null)}}/>{page==="Dashboard"&&<Dashboard d={d}/>} {page==="Live Ops"&&<LiveOps {...props}/>} {page==="Streams"&&<Streams token={token}/>} {page==="Players"&&<Players {...props}/>} {page==="Map"&&<MapPage d={d}/>} {page==="Bans"&&<Bans {...props}/>} {page==="Whitelist"&&<Whitelist {...props}/>} {page==="Configuration"&&<Config {...props}/>} {page==="Lookup"&&<Lookup token={token}/>} {page==="Admins"&&<Admins {...props}/>} {page==="Logs"&&<Generic title="Logs"rows={d.logs}/>} {page==="Console"&&<Console {...props}/>} {page==="HWID/IP"&&<Generic title="HWID/IP"rows={d.hwid}/>} {page==="Screenshots"&&<Screenshots {...props}/>} {page==="Risk"&&<Generic title="Risk"rows={d.risk}/>} {page==="Resources"&&<Resources {...props}/>} {page==="Download"&&<DownloadPage token={token}/>}</div>}
createRoot(document.getElementById("root")).render(<App/>);
