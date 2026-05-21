"use client";
import { useState, useEffect, useRef } from "react";
import styles from "./manage.module.css";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

type Screen = { id: string; name: string; default_duration: number };
type MediaItem = {
  id: string; name: string; type: "image" | "video" | "dynamic";
  dynamic_type?: string; blob_url?: string; mime_type?: string;
  duration_seconds: number; priority: string;
  start_date?: string; end_date?: string; days_of_week: string;
  group_id?: string; screens: string[];
};
type Group = {
  id: string; name: string; priority: string;
  start_date?: string; end_date?: string; days_of_week: string;
  screens: string[]; members: MediaItem[];
};

const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function apiHeaders() {
  return { "x-admin-password": ADMIN_PW, "Content-Type": "application/json" };
}

export default function ManagePage() {
  const [page, setPage] = useState<"library"|"schedule"|"dynamic"|"screens">("library");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [config, setConfig] = useState<Record<string,string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    setLoading(true);
    const [mRes, sRes, cRes] = await Promise.all([
      fetch("/api/media"),
      fetch("/api/schedule"),
      fetch("/api/config"),
    ]);
    const mData = await mRes.json();
    const sData = await sRes.json();
    const cData = await cRes.json();
    setMedia(mData.items || []);
    setGroups(sData.groups || []);
    setScreens(sData.screens || []);
    setConfig(cData.config || {});
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveConfig(updates: Record<string,string>) {
    await fetch("/api/config", { method: "POST", headers: apiHeaders(), body: JSON.stringify({ updates }) });
    setConfig(c => ({ ...c, ...updates }));
  }

  async function uploadFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedFile) { alert("Please select a file first."); return; }
    setUploading(true);
    const fd = new FormData(e.currentTarget);
    const meta = {
      name: (fd.get("name") as string) || selectedFile.name,
      type: selectedFile.type.startsWith("video") ? "video" : "image",
      durationSeconds: parseInt(fd.get("duration") as string) || 10,
      priority: fd.get("priority") as string || "medium",
      startDate: (fd.get("startDate") as string) || null,
      endDate: (fd.get("endDate") as string) || null,
      daysOfWeek: DAYS.map((_,i) => fd.get(`day_${i}`) ? i : null).filter(x=>x!==null).join(",") || "0,1,2,3,4,5,6",
      screens: screens.map(s => fd.get(`screen_${s.id}`) ? s.id : null).filter(Boolean),
      groupId: (fd.get("groupId") as string) || null,
    };
    const uploadFd = new FormData();
    uploadFd.append("file", selectedFile);
    uploadFd.append("meta", JSON.stringify(meta));
    try {
      const res = await fetch("/api/media", { method: "POST", headers: { "x-admin-password": ADMIN_PW }, body: uploadFd });
      if (!res.ok) throw new Error(await res.text());
      setShowUpload(false);
      setSelectedFile(null);
      load();
    } catch (err) {
      alert("Upload failed: " + String(err));
    } finally {
      setUploading(false);
    }
  }

  async function deleteMedia(id: string) {
    if (!confirm("Delete this item?")) return;
    await fetch("/api/media", { method: "DELETE", headers: apiHeaders(), body: JSON.stringify({ id }) });
    load();
  }

  async function createGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get("name") as string,
      priority: fd.get("priority") as string || "medium",
      startDate: (fd.get("startDate") as string) || null,
      endDate: (fd.get("endDate") as string) || null,
      daysOfWeek: DAYS.map((_,i) => fd.get(`day_${i}`) ? i : null).filter(x=>x!==null).join(",") || "0,1,2,3,4,5,6",
      screens: screens.map(s => fd.get(`screen_${s.id}`) ? s.id : null).filter(Boolean),
    };
    await fetch("/api/schedule", { method: "POST", headers: apiHeaders(), body: JSON.stringify(body) });
    setShowNewGroup(false);
    load();
  }

  const individualMedia = media.filter(m => !m.group_id && m.type !== "dynamic");

  return (
    <div className={styles.shell}>
      {/* SIDEBAR */}
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <div className={styles.churchName}>Bethany Baptist</div>
          <div className={styles.logoSub}>Display Manager</div>
        </div>
        <div className={styles.navSection}>
          <div className={styles.navLabel}>Content</div>
          {(["library","schedule","dynamic"] as const).map(p => (
            <button key={p} className={`${styles.navItem} ${page===p?styles.active:""}`} onClick={()=>setPage(p)}>
              <span className={styles.navIcon}>{p==="library"?"⊞":p==="schedule"?"⊟":"✦"}</span>
              {p==="library"?"Media Library":p==="schedule"?"Schedule":"Dynamic Slides"}
            </button>
          ))}
        </div>
        <div className={styles.navSection}>
          <div className={styles.navLabel}>Displays</div>
          <button className={`${styles.navItem} ${page==="screens"?styles.active:""}`} onClick={()=>setPage("screens")}>
            <span className={styles.navIcon}>⊡</span> Screen Settings
          </button>
        </div>
        <div className={styles.screensList}>
          {screens.map(s => (
            <div key={s.id} className={styles.screenPill}>
              <span className={styles.onlineDot}/>
              {s.name}
            </div>
          ))}
        </div>
      </nav>

      {/* MAIN */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>
            {page==="library"?"Media Library":page==="schedule"?"Schedule & Display Rules":page==="dynamic"?"Dynamic Slides":"Screen Settings"}
          </h1>
          <div className={styles.topActions}>
            {page !== "dynamic" && page !== "screens" && (
              <button className={styles.btnGhost} onClick={()=>setShowNewGroup(true)}>+ New Group</button>
            )}
            {(page === "library" || page === "schedule") && (
              <button className={styles.btnPrimary} onClick={()=>setShowUpload(true)}>↑ Upload Media</button>
            )}
          </div>
        </header>

        <div className={styles.content}>
          {loading && <p style={{padding:"24px",color:"#8a92a8"}}>Loading…</p>}

          {/* LIBRARY */}
          {!loading && page==="library" && (
            <>
              <div className={styles.statsRow}>
                {[
                  {label:"Total Items", value: media.length + groups.length, sub:"in library"},
                  {label:"Groups", value: groups.length, sub:"slide series"},
                  {label:"Screens", value: screens.length, sub:"configured"},
                  {label:"Dynamic", value: media.filter(m=>m.type==="dynamic").length, sub:"live slides"},
                ].map(s=>(
                  <div key={s.label} className={styles.statCard}>
                    <div className={styles.statLabel}>{s.label}</div>
                    <div className={styles.statValue}>{s.value}</div>
                    <div className={styles.statSub}>{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className={styles.uploadZone} onClick={()=>setShowUpload(true)}>
                <div className={styles.uploadIcon}>↑</div>
                <div className={styles.uploadText}>Drop images or videos here, or click to browse</div>
                <div className={styles.uploadSub}>JPG, PNG, GIF, MP4 · Duration suggested based on content</div>
              </div>

              {groups.map(g => (
                <div key={g.id} className={styles.groupCard}>
                  <div className={styles.groupHeader}>
                    <span className={styles.groupIcon}>⊞</span>
                    <span className={styles.groupTitle}>{g.name}</span>
                    <span className={styles.groupMeta}>{g.members?.length||0} slides · {(g.members||[]).reduce((a,m)=>a+(m.duration_seconds||10),0)}s total</span>
                  </div>
                  <div className={styles.groupBody}>
                    {(g.members||[]).map((m)=>(
                      <div key={m.id} className={styles.groupRow}>
                        <span className={styles.dragHandle}>⋮⋮</span>
                        <div className={styles.slideThumbSm}>{m.type==="video"?"▶":"🖼"}</div>
                        <span className={styles.slideName}>{m.name}</span>
                        <input
                          type="number" className={styles.durInput} defaultValue={m.duration_seconds} min={3} max={120}
                          onBlur={async e=>{ await fetch("/api/media",{method:"PATCH",headers:apiHeaders(),body:JSON.stringify({id:m.id,durationSeconds:parseInt(e.target.value)})});}}
                        />
                        <span className={styles.durLabel}>sec</span>
                      </div>
                    ))}
                    <div className={styles.groupFooter}>
                      <div className={styles.screenTags}>
                        {(g.screens||[]).map(sid=><span key={sid} className={`${styles.screenTag} ${styles[sid]||""}`}>{screens.find(s=>s.id===sid)?.name||sid}</span>)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {individualMedia.length > 0 && (
                <>
                  <h2 className={styles.sectionSubtitle}>Individual Slides</h2>
                  <div className={styles.mediaGrid}>
                    {individualMedia.map(m=>(
                      <div key={m.id} className={styles.mediaCard}>
                        <div className={`${styles.mediaThumb} ${m.type==="video"?styles.vidThumb:styles.imgThumb}`}>
                          {m.blob_url && m.type==="image" && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.blob_url} alt={m.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                          )}
                          {m.type==="video" && <span style={{fontSize:"28px"}}>▶</span>}
                          <span className={styles.typeBadge}>{m.type.toUpperCase()}</span>
                          <span className={styles.durBadge}>{m.duration_seconds}s</span>
                        </div>
                        <div className={styles.mediaInfo}>
                          <div className={styles.mediaName}>{m.name}</div>
                          <div className={styles.mediaMeta}>{m.priority} priority</div>
                        </div>
                        <div className={styles.durEditor}>
                          <label>Duration</label>
                          <input type="number" defaultValue={m.duration_seconds} min={3} max={120}
                            onBlur={async e=>{ await fetch("/api/media",{method:"PATCH",headers:apiHeaders(),body:JSON.stringify({id:m.id,durationSeconds:parseInt(e.target.value)})});}}
                          />
                          <span className={styles.durEditorSec}>sec</span>
                        </div>
                        <div className={styles.mediaFooter}>
                          <div className={styles.screenTags}>
                            {(m.screens||[]).map(sid=><span key={sid} className={`${styles.screenTag} ${styles[sid]||""}`}>{screens.find(s=>s.id===sid)?.name||sid}</span>)}
                          </div>
                          <button className={styles.iconBtn} onClick={()=>deleteMedia(m.id)}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* SCHEDULE */}
          {!loading && page==="schedule" && (
            <table className={styles.scheduleTable}>
              <thead>
                <tr><th>Item</th><th>Date Range</th><th>Days</th><th>Priority</th><th>Screens</th><th/></tr>
              </thead>
              <tbody>
                {groups.map(g=>(
                  <tr key={g.id}>
                    <td><strong>{g.name}</strong> <span className={styles.groupBadge}>GROUP · {g.members?.length||0} slides</span></td>
                    <td className={styles.dateCell}>{g.start_date||"—"} → {g.end_date||"—"}</td>
                    <td><div className={styles.daysRow}>{DAYS.map((d,i)=><span key={i} className={`${styles.dayChip} ${(g.days_of_week||"").split(",").includes(String(i))?styles.dayOn:styles.dayOff}`}>{d}</span>)}</div></td>
                    <td><span className={`${styles.priorityDot} ${styles[g.priority]}`}/>  {g.priority}</td>
                    <td><div className={styles.screenTags}>{(g.screens||[]).map(sid=><span key={sid} className={`${styles.screenTag} ${styles[sid]||""}`}>{screens.find(s=>s.id===sid)?.name||sid}</span>)}</div></td>
                    <td/>
                  </tr>
                ))}
                {individualMedia.map(m=>(
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong><br/><span style={{fontSize:"11px",color:"#8a92a8"}}>{m.type} · {m.duration_seconds}s</span></td>
                    <td className={styles.dateCell}>{m.start_date||"—"} → {m.end_date||"—"}</td>
                    <td><div className={styles.daysRow}>{DAYS.map((d,i)=><span key={i} className={`${styles.dayChip} ${(m.days_of_week||"").split(",").includes(String(i))?styles.dayOn:styles.dayOff}`}>{d}</span>)}</div></td>
                    <td><span className={`${styles.priorityDot} ${styles[m.priority]}`}/>  {m.priority}</td>
                    <td><div className={styles.screenTags}>{(m.screens||[]).map(sid=><span key={sid} className={`${styles.screenTag} ${styles[sid]||""}`}>{screens.find(s=>s.id===sid)?.name||sid}</span>)}</div></td>
                    <td><button className={styles.iconBtn} onClick={()=>deleteMedia(m.id)}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* DYNAMIC */}
          {!loading && page==="dynamic" && (
            <div>
              <div className={styles.dynamicCard}>
                <div className={styles.dynamicHeader}>
                  <div className={`${styles.dynamicIcon} ${styles.calIcon}`}>📅</div>
                  <div><div className={styles.dynamicTitle}>Today&apos;s Events</div><div className={styles.dynamicDesc}>Google Calendar · public iCal feed</div></div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked={config["calendar.enabled"]==="true"} onChange={e=>saveConfig({"calendar.enabled":String(e.target.checked)})}/>
                    <span className={styles.toggleSlider}/>
                  </label>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Refresh interval</div>
                    <select defaultValue={config["calendar.refreshMinutes"]||"60"} onChange={e=>saveConfig({"calendar.refreshMinutes":e.target.value})}>
                      <option value="15">Every 15 min</option>
                      <option value="30">Every 30 min</option>
                      <option value="60">Every hour</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Max events shown</div>
                    <input type="number" defaultValue={config["calendar.maxEvents"]||"6"} min={2} max={12}
                      onBlur={e=>saveConfig({"calendar.maxEvents":e.target.value})}/>
                  </div>
                </div>
                <div className={styles.toggleRows}>
                  {[
                    {key:"calendar.showLocation", label:"Show room / location"},
                    {key:"calendar.hideAllDay", label:"Hide all-day events"},
                    {key:"calendar.fallbackTomorrow", label:"Show tomorrow if today is quiet"},
                  ].map(({key,label})=>(
                    <label key={key} className={styles.toggleRow}>
                      <span>{label}</span>
                      <span className={styles.toggle}>
                        <input type="checkbox" defaultChecked={config[key]==="true"} onChange={e=>saveConfig({[key]:String(e.target.checked)})}/>
                        <span className={styles.toggleSlider}/>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.dynamicCard}>
                <div className={styles.dynamicHeader}>
                  <div className={`${styles.dynamicIcon} ${styles.bibleIcon}`}>📖</div>
                  <div><div className={styles.dynamicTitle}>Scripture Verses</div><div className={styles.dynamicDesc}>ESV · rotates through active pool · sermon-series aligned</div></div>
                  <label className={styles.toggle}>
                    <input type="checkbox" defaultChecked={config["verse.enabled"]==="true"} onChange={e=>saveConfig({"verse.enabled":String(e.target.checked)})}/>
                    <span className={styles.toggleSlider}/>
                  </label>
                </div>
                <div className={styles.fieldGrid}>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Active verses at once</div>
                    <select defaultValue={config["verse.activeCount"]||"3"} onChange={e=>saveConfig({"verse.activeCount":e.target.value})}>
                      <option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                    </select>
                  </div>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Verses change</div>
                    <select defaultValue={config["verse.changeFrequency"]||"daily"} onChange={e=>saveConfig({"verse.changeFrequency":e.target.value})}>
                      <option value="daily">Daily</option>
                      <option value="sunday">Every Sunday</option>
                      <option value="manual">Manually only</option>
                    </select>
                  </div>
                </div>
                <div className={styles.versePoolLabel}>Active verse pool — click to toggle</div>
                <div className={styles.verseChips}>
                  {(JSON.parse(config["verse.pool"]||"[]") as {ref:string;active:boolean}[]).map((v,i,arr)=>(
                    <button key={v.ref} className={`${styles.verseChip} ${v.active?styles.verseActive:""}`}
                      onClick={()=>{
                        const updated = arr.map((x,j)=>j===i?{...x,active:!x.active}:x);
                        saveConfig({"verse.pool":JSON.stringify(updated)});
                      }}>
                      {v.ref}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SCREENS */}
          {!loading && page==="screens" && (
            <div className={styles.screensGrid}>
              {screens.map(s=>(
                <div key={s.id} className={styles.screenCard}>
                  <div className={styles.screenCardHeader}>
                    <span className={styles.onlineDot}/> <strong>{s.name}</strong>
                    <span className={styles.onlineBadge}>Online</span>
                  </div>
                  <div className={styles.field}>
                    <div className={styles.fieldLabel}>Default duration (seconds)</div>
                    <input type="number" defaultValue={s.default_duration} min={3} max={60}/>
                    <div className={styles.fieldHint}>Used when a slide has no individual duration set</div>
                  </div>
                  <div className={styles.field} style={{marginTop:"10px"}}>
                    <div className={styles.fieldLabel}>Player URL</div>
                    <input readOnly value={`/player?screen=${s.id}`} style={{fontFamily:"monospace",fontSize:"12px"}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div className={styles.modalOverlay} onClick={e=>{ if(e.target===e.currentTarget){ setShowUpload(false); setSelectedFile(null); } }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <span>Add Media Item</span>
              <button className={styles.modalClose} onClick={()=>{ setShowUpload(false); setSelectedFile(null); }}>✕</button>
            </div>
            <form ref={formRef} className={styles.modalBody} onSubmit={uploadFile}>

              {/* File input — visible but overlaid by styled label */}
              <div className={styles.fileDropZone}>
                <label style={{display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer",gap:"6px"}}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/mp4"
                    style={{width:"100%",cursor:"pointer"}}
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  {selectedFile
                    ? <span style={{fontSize:"13px",color:"#003149",fontWeight:500}}>✓ {selectedFile.name}</span>
                    : <span style={{fontSize:"11px",color:"#8a92a8",marginTop:"2px"}}>JPG, PNG, GIF, MP4 · Max 500 MB</span>
                  }
                </label>
              </div>

              <div className={styles.modalField}>
                <label>Display name</label>
                <input type="text" name="name" placeholder={selectedFile?.name || "e.g. Easter Sunday Announcement"}/>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.modalField}>
                  <label>Duration (seconds)</label>
                  <input type="number" name="duration" defaultValue={10} min={3} max={120}/>
                </div>
                <div className={styles.modalField}>
                  <label>Priority</label>
                  <select name="priority" defaultValue="medium">
                    <option value="high">High — every other slot</option>
                    <option value="medium">Medium — every 3–4 slots</option>
                    <option value="low">Low — once per loop</option>
                  </select>
                </div>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.modalField}><label>Start date</label><input type="date" name="startDate"/></div>
                <div className={styles.modalField}><label>End date</label><input type="date" name="endDate"/></div>
              </div>
              <div className={styles.modalField}>
                <label>Days of week</label>
                <div className={styles.dayPicker}>
                  {DAYS.map((d,i)=>(
                    <label key={i} className={styles.dayToggle}>
                      <input type="checkbox" name={`day_${i}`} defaultChecked/> {d}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.modalField}>
                <label>Screens</label>
                <div className={styles.screenPicker}>
                  {screens.map(s=>(
                    <label key={s.id} className={styles.screenOpt}>
                      <input type="checkbox" name={`screen_${s.id}`} defaultChecked/> {s.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.modalField}>
                <label>Add to group (optional)</label>
                <select name="groupId" defaultValue="">
                  <option value="">No group</option>
                  {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={()=>{ setShowUpload(false); setSelectedFile(null); }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={uploading}>
                  {uploading ? "Uploading…" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW GROUP MODAL */}
      {showNewGroup && (
        <div className={styles.modalOverlay} onClick={e=>{ if(e.target===e.currentTarget) setShowNewGroup(false); }}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <span>New Slide Group</span>
              <button className={styles.modalClose} onClick={()=>setShowNewGroup(false)}>✕</button>
            </div>
            <form className={styles.modalBody} onSubmit={createGroup}>
              <div className={styles.modalField}><label>Group name</label><input type="text" name="name" required placeholder="e.g. VBS Summer Registration"/></div>
              <div className={styles.fieldGrid}>
                <div className={styles.modalField}><label>Start date</label><input type="date" name="startDate"/></div>
                <div className={styles.modalField}><label>End date</label><input type="date" name="endDate"/></div>
              </div>
              <div className={styles.modalField}>
                <label>Days of week</label>
                <div className={styles.dayPicker}>
                  {DAYS.map((d,i)=>(
                    <label key={i} className={styles.dayToggle}>
                      <input type="checkbox" name={`day_${i}`} defaultChecked/> {d}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.modalField}>
                  <label>Priority</label>
                  <select name="priority" defaultValue="medium">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className={styles.modalField}>
                  <label>Screens</label>
                  <div className={styles.screenPicker}>
                    {screens.map(s=>(
                      <label key={s.id} className={styles.screenOpt}>
                        <input type="checkbox" name={`screen_${s.id}`} defaultChecked/> {s.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnGhost} onClick={()=>setShowNewGroup(false)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
