import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlQVhREotq0TvUH4mfPrxoJRVGrWP1kUA",
  authDomain: "boxfinder-7154a.firebaseapp.com",
  projectId: "boxfinder-7154a",
  storageBucket: "boxfinder-7154a.firebasestorage.app",
  messagingSenderId: "292547003190",
  appId: "1:292547003190:web:ab32a58459ce20f676e997"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ACCESS_LEVELS = {
  D: { code: 'D', name: 'Do Not Store', description: 'Essentials - keep with you', color: '#DC2626', icon: '🚫' },
  A: { code: 'A', name: 'Accessible', description: 'Need during the move', color: '#10B981', icon: '⚡' },
  M: { code: 'M', name: 'Mid-Access', description: 'May need within first few weeks', color: '#F59E0B', icon: '📦' },
  L: { code: 'L', name: 'Long-term Storage', description: "Won't need until fully settled", color: '#6B7280', icon: '🔒' },
};

const LOCATION_COLORS = {
  'Kitchen': '#EF4444', 'Bedroom': '#8B5CF6', 'Master Bedroom': '#7C3AED', 'Living Room': '#3B82F6',
  'Bathroom': '#06B6D4', 'Office': '#10B981', 'Garage': '#6B7280', 'Basement': '#374151',
  'Attic': '#78716C', 'Dining Room': '#F59E0B', 'Laundry': '#0891B2', 'Closet': '#EC4899',
  'Kids Room': '#F472B6', 'Guest Room': '#A855F7', 'Pantry': '#D97706', 'Storage': '#64748B',
  'Outdoor': '#22C55E', 'Patio': '#84CC16', 'Nursery': '#FB923C', 'Den': '#14B8A6',
  'Mudroom': '#92400E', 'Utility': '#475569', 'Unassigned': '#9CA3AF',
};

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F472B6', '#6366F1'];

// Document ID for shared data - change this if you want separate inventories
const DOC_ID = 'main-inventory';

export default function MovingApp() {
  const [boxes, setBoxes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState('home');
  const [selectedBox, setSelectedBox] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddBox, setShowAddBox] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newBoxName, setNewBoxName] = useState('');
  const [newBoxLocation, setNewBoxLocation] = useState('');
  const [newBoxAccess, setNewBoxAccess] = useState('M');
  const [newBoxNumber, setNewBoxNumber] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [editingBox, setEditingBox] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [filterAccess, setFilterAccess] = useState(null);
  const [boxCounter, setBoxCounter] = useState(1);
  const [locationColorMap, setLocationColorMap] = useState({});
  const [syncStatus, setSyncStatus] = useState('connecting');

  // Real-time listener for Firebase data
  useEffect(() => {
    const docRef = doc(db, 'inventories', DOC_ID);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBoxes(data.boxes || []);
        setBoxCounter(data.boxCounter || 1);
        setLocationColorMap(data.locationColorMap || {});
      }
      setIsLoading(false);
      setSyncStatus('synced');
    }, (error) => {
      console.error('Firebase error:', error);
      setSyncStatus('error');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update selected box when boxes change (for real-time updates)
  useEffect(() => {
    if (selectedBox) {
      const updated = boxes.find(b => b.id === selectedBox.id);
      if (updated) setSelectedBox(updated);
      else { setSelectedBox(null); setView('home'); }
    }
  }, [boxes]);

  const saveData = async (newBoxes, newCounter, newColorMap) => {
    setSyncStatus('saving');
    try {
      const docRef = doc(db, 'inventories', DOC_ID);
      await setDoc(docRef, {
        boxes: newBoxes,
        boxCounter: newCounter || boxCounter,
        locationColorMap: newColorMap || locationColorMap,
        updatedAt: new Date().toISOString()
      });
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to save:', e);
      setSyncStatus('error');
    }
  };

  const getColorForLocation = (location) => {
    const loc = location?.trim() || 'Unassigned';
    if (LOCATION_COLORS[loc]) return LOCATION_COLORS[loc];
    if (locationColorMap[loc]) return locationColorMap[loc];
    const usedColors = Object.values(locationColorMap);
    const availableColors = DEFAULT_COLORS.filter(c => !usedColors.includes(c));
    return availableColors.length > 0 ? availableColors[0] : DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
  };

  const generateBoxCode = (accessLevel, number) => `${accessLevel}-${String(number).padStart(3, '0')}`;

  const addBox = () => {
    if (!newBoxName.trim()) return;
    const boxNum = newBoxNumber ? parseInt(newBoxNumber) : boxCounter;
    const location = newBoxLocation.trim() || 'Unassigned';
    const color = getColorForLocation(location);
    let newColorMap = { ...locationColorMap };
    if (!LOCATION_COLORS[location] && !locationColorMap[location]) newColorMap[location] = color;
    const newBox = { id: Date.now().toString(), name: newBoxName.trim(), location, color, accessLevel: newBoxAccess, boxNumber: boxNum, code: generateBoxCode(newBoxAccess, boxNum), items: [], createdAt: new Date().toISOString() };
    const updated = [...boxes, newBox];
    const newCounter = newBoxNumber ? boxCounter : boxCounter + 1;
    setBoxes(updated); setBoxCounter(newCounter); setLocationColorMap(newColorMap);
    saveData(updated, newCounter, newColorMap);
    resetBoxForm();
  };

  const updateBox = () => {
    if (!editingBox || !newBoxName.trim()) return;
    const boxNum = newBoxNumber ? parseInt(newBoxNumber) : editingBox.boxNumber;
    const location = newBoxLocation.trim() || 'Unassigned';
    const color = getColorForLocation(location);
    let newColorMap = { ...locationColorMap };
    if (!LOCATION_COLORS[location] && !locationColorMap[location]) newColorMap[location] = color;
    const updated = boxes.map(b => b.id === editingBox.id ? { ...b, name: newBoxName.trim(), location, color, accessLevel: newBoxAccess, boxNumber: boxNum, code: generateBoxCode(newBoxAccess, boxNum) } : b);
    setBoxes(updated); setLocationColorMap(newColorMap);
    saveData(updated, boxCounter, newColorMap);
    if (selectedBox?.id === editingBox.id) setSelectedBox(updated.find(b => b.id === editingBox.id));
    resetBoxForm();
  };

  const resetBoxForm = () => { setEditingBox(null); setNewBoxName(''); setNewBoxLocation(''); setNewBoxNumber(''); setShowAddBox(false); };
  const deleteBox = (boxId) => { const updated = boxes.filter(b => b.id !== boxId); setBoxes(updated); saveData(updated); if (selectedBox?.id === boxId) { setSelectedBox(null); setView('home'); } };

  const addItem = (addAnother = false) => {
    if (!selectedBox || !newItemName.trim()) return;
    const newItem = { id: Date.now().toString(), name: newItemName.trim(), notes: newItemNotes.trim(), addedAt: new Date().toISOString() };
    const updated = boxes.map(b => b.id === selectedBox.id ? { ...b, items: [...b.items, newItem] } : b);
    setBoxes(updated); saveData(updated);
    setSelectedBox(updated.find(b => b.id === selectedBox.id));
    setNewItemName(''); setNewItemNotes('');
    if (!addAnother) setShowAddItem(false);
  };

  const updateItem = () => {
    if (!selectedBox || !editingItem || !newItemName.trim()) return;
    const updated = boxes.map(b => b.id === selectedBox.id ? { ...b, items: b.items.map(i => i.id === editingItem.id ? { ...i, name: newItemName.trim(), notes: newItemNotes.trim() } : i) } : b);
    setBoxes(updated); saveData(updated);
    setSelectedBox(updated.find(b => b.id === selectedBox.id));
    resetItemForm();
  };

  const resetItemForm = () => { setEditingItem(null); setNewItemName(''); setNewItemNotes(''); setShowAddItem(false); };
  const deleteItem = (itemId) => { const updated = boxes.map(b => b.id === selectedBox.id ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b); setBoxes(updated); saveData(updated); setSelectedBox(updated.find(b => b.id === selectedBox.id)); };
  const moveItem = (itemId, toBoxId) => { const item = selectedBox.items.find(i => i.id === itemId); if (!item) return; const updated = boxes.map(b => { if (b.id === selectedBox.id) return { ...b, items: b.items.filter(i => i.id !== itemId) }; if (b.id === toBoxId) return { ...b, items: [...b.items, item] }; return b; }); setBoxes(updated); saveData(updated); setSelectedBox(updated.find(b => b.id === selectedBox.id)); };

  const searchResults = searchQuery.trim() ? boxes.flatMap(box => { if (box.code.toLowerCase().includes(searchQuery.toLowerCase())) return box.items.map(item => ({ ...item, box })); return box.items.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.notes.toLowerCase().includes(searchQuery.toLowerCase())).map(item => ({ ...item, box })); }) : [];
  const matchingBoxes = searchQuery.trim() ? boxes.filter(box => box.code.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const filteredBoxes = filterAccess ? boxes.filter(b => b.accessLevel === filterAccess) : boxes;
  const locations = [...new Set(filteredBoxes.map(b => b.location))];
  const totalItems = boxes.reduce((sum, b) => sum + b.items.length, 0);
  const allLocations = [...new Set([...boxes.map(b => b.location), ...Object.keys(LOCATION_COLORS)])].sort();

  const SyncIndicator = () => (
    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:syncStatus==='error'?'#EF4444':'rgba(255,255,255,0.7)'}}>
      <span style={{width:8,height:8,borderRadius:'50%',backgroundColor:syncStatus==='synced'?'#10B981':syncStatus==='saving'?'#F59E0B':syncStatus==='error'?'#EF4444':'#6B7280'}}/>
      {syncStatus==='synced'?'Synced':syncStatus==='saving'?'Saving...':syncStatus==='error'?'Offline':'Connecting...'}
    </div>
  );

  if (isLoading) return <div style={S.container}><div style={S.loadingWrap}><div style={{fontSize:64,animation:'float 1.5s ease-in-out infinite'}}>📦</div><p style={{fontSize:18,color:'#6B7280',fontWeight:500}}>Connecting to cloud...</p></div></div>;

  return (
    <div style={S.container}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}input,textarea,select{font-family:'DM Sans',sans-serif}input:focus,textarea:focus,select:focus{outline:none}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      <header style={S.header}><div style={S.headerContent}>{view==='box'?<button onClick={()=>{setView('home');setSelectedBox(null);}} style={S.backBtn}>← Back</button>:<div style={{display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:28}}>📦</span><span style={{fontSize:22,fontWeight:700,color:'white',letterSpacing:-0.5}}>BoxFinder</span></div>}<div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}><div style={{display:'flex',alignItems:'center',gap:8,fontSize:14,fontWeight:500,color:'rgba(255,255,255,0.8)'}}><span>{boxes.length} boxes</span><span style={{opacity:0.5}}>•</span><span>{totalItems} items</span></div><SyncIndicator/></div></div></header>

      {view==='home'&&<div style={S.searchWrap}><div style={S.searchBox}><span style={{fontSize:20,marginRight:12}}>🔍</span><input type="text" placeholder="Search items or box code (e.g., A-001)..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={S.searchInput}/>{searchQuery&&<button onClick={()=>setSearchQuery('')} style={S.clearBtn}>✕</button>}</div></div>}

      {view==='home'&&!searchQuery&&boxes.length>0&&<div style={S.filterWrap}><div style={S.filterRow}><button onClick={()=>setFilterAccess(null)} style={{...S.filterBtn,...(filterAccess===null?S.filterActive:{})}}>All</button>{Object.values(ACCESS_LEVELS).map(l=><button key={l.code} onClick={()=>setFilterAccess(filterAccess===l.code?null:l.code)} style={{...S.filterBtn,...(filterAccess===l.code?{...S.filterActive,backgroundColor:l.color}:{})}}>{l.icon} {l.code}</button>)}</div><div style={S.legend}>{Object.values(ACCESS_LEVELS).map(l=><div key={l.code} style={S.legendItem}><span style={{...S.legendDot,backgroundColor:l.color}}/><span style={S.legendCode}>{l.code}</span><span style={S.legendName}>= {l.name}</span></div>)}</div></div>}

      <main style={S.main}>
        {searchQuery&&view==='home'&&<div style={{paddingTop:20}}><h2 style={S.sectionTitle}>{matchingBoxes.length>0&&`${matchingBoxes.length} box${matchingBoxes.length!==1?'es':''}`}{matchingBoxes.length>0&&searchResults.length>0&&', '}{searchResults.length>0&&`${searchResults.length} item${searchResults.length!==1?'s':''}`}{matchingBoxes.length===0&&searchResults.length===0&&'No results'} found</h2>
          {matchingBoxes.length>0&&<div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>{matchingBoxes.map((box,i)=><div key={box.id} style={{...S.resultCard,animationDelay:`${i*0.05}s`}} onClick={()=>{setSelectedBox(box);setView('box');setSearchQuery('');}}><div style={{...S.resultColor,backgroundColor:box.color}}><span style={S.resultBoxCode}>{box.code}</span></div><div style={{padding:'12px 16px',flex:1}}><h3 style={{fontSize:16,fontWeight:600,margin:'0 0 4px 0'}}>{box.name}</h3><p style={{fontSize:13,color:'#6B7280',margin:0}}>📍 {box.location} • {box.items.length} items</p></div><div style={{...S.accessSmall,backgroundColor:ACCESS_LEVELS[box.accessLevel].color}}>{ACCESS_LEVELS[box.accessLevel].icon}</div></div>)}</div>}
          {searchResults.length===0&&matchingBoxes.length===0?<div style={S.emptyState}><span style={{fontSize:48,display:'block',marginBottom:12}}>🔎</span><p style={{color:'#6B7280',fontSize:16}}>No items or boxes match "{searchQuery}"</p></div>:searchResults.length>0&&<div style={{display:'flex',flexDirection:'column',gap:12}}>{searchResults.map((item,i)=><div key={`${item.box.id}-${item.id}`} style={{...S.resultCard,animationDelay:`${i*0.05}s`}} onClick={()=>{setSelectedBox(item.box);setView('box');setSearchQuery('');}}><div style={{width:6,alignSelf:'stretch',flexShrink:0,backgroundColor:item.box.color}}/><div style={{padding:'14px 16px',flex:1}}><h3 style={{fontSize:16,fontWeight:600,margin:'0 0 4px 0'}}>{item.name}</h3><p style={{fontSize:13,color:'#6B7280',margin:0}}><span style={S.codeTag}>{item.box.code}</span> {item.box.name} • 📍 {item.box.location}</p>{item.notes&&<p style={{fontSize:13,color:'#9CA3AF',margin:'6px 0 0 0',fontStyle:'italic'}}>{item.notes}</p>}</div><div style={{...S.accessSmall,backgroundColor:ACCESS_LEVELS[item.box.accessLevel].color}}>{ACCESS_LEVELS[item.box.accessLevel].icon}</div></div>)}</div>}
        </div>}

        {!searchQuery&&view==='home'&&<>{boxes.length===0?<div style={S.welcome}><div style={{fontSize:72,marginBottom:20,display:'block',animation:'float 2s ease-in-out infinite'}}>📦</div><h2 style={{fontSize:26,fontWeight:700,marginBottom:12,color:'#1F2937'}}>Ready to get organized?</h2><p style={{fontSize:16,color:'#6B7280',marginBottom:24,lineHeight:1.5}}>Add your first box with a unique code to start tracking where everything goes.</p><div style={S.explainer}><h3 style={{fontSize:16,fontWeight:600,marginBottom:16,color:'#1F2937'}}>Box Code System</h3>{Object.values(ACCESS_LEVELS).map(l=><div key={l.code} style={S.explainerRow}><span style={{...S.explainerBadge,backgroundColor:l.color}}>{l.icon} {l.code}</span><div style={{display:'flex',flexDirection:'column',gap:2,fontSize:14,color:'#6B7280'}}><strong style={{color:'#1F2937'}}>{l.name}</strong><span>{l.description}</span></div></div>)}<p style={{marginTop:16,paddingTop:16,borderTop:'1px solid #E5E7EB',fontSize:14,color:'#6B7280',marginBottom:0}}>Example: <span style={S.codeExample}>A-001</span> = Accessible box #1</p></div><button onClick={()=>setShowAddBox(true)} style={S.primaryBtn}>+ Create First Box</button></div>:<>{locations.map(loc=><div key={loc} style={{marginTop:24,animation:'fadeIn 0.4s ease-out'}}><h2 style={S.locTitle}><span style={{...S.locDot,backgroundColor:getColorForLocation(loc)}}/>{loc}<span style={{fontSize:13,color:'#9CA3AF',fontWeight:500,marginLeft:'auto'}}>{filteredBoxes.filter(b=>b.location===loc).length} boxes</span></h2><div style={S.boxGrid}>{filteredBoxes.filter(b=>b.location===loc).map((box,i)=><div key={box.id} style={{...S.boxCard,animationDelay:`${i*0.08}s`}} onClick={()=>{setSelectedBox(box);setView('box');}}><div style={{...S.boxTop,backgroundColor:box.color}}><span style={S.boxCode}>{box.code}</span><div style={{...S.accessInd,backgroundColor:ACCESS_LEVELS[box.accessLevel].color}}>{ACCESS_LEVELS[box.accessLevel].icon}</div></div><div style={S.boxBottom}><h3 style={{fontSize:14,fontWeight:600,margin:'0 0 4px 0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{box.name}</h3><p style={{fontSize:13,color:'#6B7280',margin:0}}>{box.items.length} item{box.items.length!==1?'s':''}</p></div><button onClick={e=>{e.stopPropagation();setEditingBox(box);setNewBoxName(box.name);setNewBoxLocation(box.location);setNewBoxAccess(box.accessLevel);setNewBoxNumber(String(box.boxNumber));setShowAddBox(true);}} style={S.editBtn}>✏️</button></div>)}</div></div>)}<button onClick={()=>{setEditingBox(null);setNewBoxAccess('M');setNewBoxNumber('');setShowAddBox(true);}} style={S.fab}>+</button></>}</>}

        {view==='box'&&selectedBox&&<div style={{animation:'fadeIn 0.3s ease-out'}}><div style={{...S.detailHeader,backgroundColor:selectedBox.color}}><div><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}><span style={S.detailCode}>{selectedBox.code}</span><div style={{...S.accessBadge,backgroundColor:ACCESS_LEVELS[selectedBox.accessLevel].color}}>{ACCESS_LEVELS[selectedBox.accessLevel].icon} {ACCESS_LEVELS[selectedBox.accessLevel].name}</div></div><h1 style={{fontSize:24,fontWeight:700,margin:'0 0 4px 0',color:'white',textShadow:'0 1px 2px rgba(0,0,0,0.1)'}}>{selectedBox.name}</h1><p style={{fontSize:15,color:'rgba(255,255,255,0.85)',margin:0}}>📍 {selectedBox.location}</p></div><div style={{display:'flex',gap:8}}><button onClick={()=>{setEditingBox(selectedBox);setNewBoxName(selectedBox.name);setNewBoxLocation(selectedBox.location);setNewBoxAccess(selectedBox.accessLevel);setNewBoxNumber(String(selectedBox.boxNumber));setShowAddBox(true);}} style={S.iconBtn}>✏️</button><button onClick={()=>{if(confirm('Delete this box and all items?'))deleteBox(selectedBox.id);}} style={S.iconBtn}>🗑️</button></div></div><div style={{paddingTop:20}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}><h2 style={{fontSize:18,fontWeight:600,margin:0}}>Contents ({selectedBox.items.length})</h2><button onClick={()=>{setEditingItem(null);setShowAddItem(true);}} style={S.addItemBtn}>+ Add Item</button></div>{selectedBox.items.length===0?<div style={S.emptyItems}><span style={{fontSize:48,display:'block',marginBottom:12}}>🫗</span><p style={{color:'#6B7280',marginBottom:16}}>This box is empty</p><button onClick={()=>setShowAddItem(true)} style={S.secondaryBtn}>Add first item</button></div>:selectedBox.items.map((item,i)=><div key={item.id} style={{...S.itemCard,animationDelay:`${i*0.05}s`}}><div style={{flex:1,minWidth:0}}><h3 style={{fontSize:16,fontWeight:600,margin:0}}>{item.name}</h3>{item.notes&&<p style={{fontSize:13,color:'#6B7280',margin:'4px 0 0 0',fontStyle:'italic'}}>{item.notes}</p>}</div><div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}><button onClick={()=>{setEditingItem(item);setNewItemName(item.name);setNewItemNotes(item.notes);setShowAddItem(true);}} style={S.smallBtn}>✏️</button><select onChange={e=>{if(e.target.value)moveItem(item.id,e.target.value);e.target.value='';}} style={S.moveSelect} defaultValue=""><option value="" disabled>Move to...</option>{boxes.filter(b=>b.id!==selectedBox.id).map(b=><option key={b.id} value={b.id}>[{b.code}] {b.name}</option>)}</select><button onClick={()=>deleteItem(item.id)} style={S.smallBtn}>🗑️</button></div></div>)}</div></div>}
      </main>

      {showAddBox&&<div style={S.overlay} onClick={resetBoxForm}><div style={S.modal} onClick={e=>e.stopPropagation()}><h2 style={S.modalTitle}>{editingBox?'Edit Box':'New Box'}</h2><div style={S.formGroup}><label style={S.label}>Access Level</label><div style={{display:'flex',flexDirection:'column',gap:10}}>{Object.values(ACCESS_LEVELS).map(l=><button key={l.code} onClick={()=>setNewBoxAccess(l.code)} style={{...S.accessOpt,borderColor:newBoxAccess===l.code?l.color:'#E5E7EB',backgroundColor:newBoxAccess===l.code?`${l.color}15`:'white'}}><span style={{fontSize:20}}>{l.icon}</span><span style={S.accessCode}>{l.code}</span><span style={{color:'#6B7280',fontSize:14,flex:1}}>{l.name}</span></button>)}</div></div><div style={S.formGroup}><label style={S.label}>Box Number (optional)</label><div style={S.codePreview}><span style={{fontSize:13,color:'#9CA3AF'}}>Code:</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:600,color:'#10B981'}}>{generateBoxCode(newBoxAccess,newBoxNumber||boxCounter)}</span></div><input type="number" value={newBoxNumber} onChange={e=>setNewBoxNumber(e.target.value)} placeholder={`Next: ${boxCounter}`} style={S.input} min="1"/></div><div style={S.formGroup}><label style={S.label}>Box Name</label><input type="text" value={newBoxName} onChange={e=>setNewBoxName(e.target.value)} placeholder="e.g., Kitchen Essentials" style={S.input} autoFocus/></div><div style={S.formGroup}><label style={S.label}>Location / Room</label><div style={{position:'relative'}}><input type="text" value={newBoxLocation} onChange={e=>setNewBoxLocation(e.target.value)} placeholder="e.g., Garage, Living Room" style={{...S.input,paddingLeft:newBoxLocation?40:16}} list="locations"/>{newBoxLocation&&<span style={{...S.locPreview,backgroundColor:getColorForLocation(newBoxLocation)}}/>}</div><datalist id="locations">{allLocations.map(l=><option key={l} value={l}/>)}</datalist><p style={{fontSize:12,color:'#9CA3AF',marginTop:6,marginBottom:0}}>Color is auto-assigned based on location</p></div><div style={S.modalActions}><button onClick={resetBoxForm} style={S.cancelBtn}>Cancel</button>{editingBox&&<button onClick={()=>{if(confirm('Delete this box?')){deleteBox(editingBox.id);resetBoxForm();}}} style={S.deleteBtn}>Delete</button>}<button onClick={editingBox?updateBox:addBox} style={S.saveBtn} disabled={!newBoxName.trim()}>{editingBox?'Save':'Create Box'}</button></div></div></div>}

      {showAddItem&&<div style={S.overlay} onClick={resetItemForm}><div style={S.modal} onClick={e=>e.stopPropagation()}><h2 style={S.modalTitle}>{editingItem?'Edit Item':'Add Item'}</h2><p style={{fontSize:14,color:'#6B7280',textAlign:'center',marginBottom:20}}>Adding to: <strong>{selectedBox.code}</strong> - {selectedBox.name}</p><div style={S.formGroup}><label style={S.label}>Item Name</label><input type="text" value={newItemName} onChange={e=>setNewItemName(e.target.value)} placeholder="e.g., Coffee Maker" style={S.input} autoFocus/></div><div style={S.formGroup}><label style={S.label}>Notes (optional)</label><textarea value={newItemNotes} onChange={e=>setNewItemNotes(e.target.value)} placeholder="e.g., Fragile, handle with care" style={S.textarea} rows={3}/></div><div style={S.modalActions}><button onClick={resetItemForm} style={S.cancelBtn}>Cancel</button>{editingItem?<button onClick={updateItem} style={S.saveBtn} disabled={!newItemName.trim()}>Save</button>:<><button onClick={()=>addItem(true)} style={S.addAnotherBtn} disabled={!newItemName.trim()}>Add + New</button><button onClick={()=>addItem(false)} style={S.saveBtn} disabled={!newItemName.trim()}>Add Item</button></>}</div></div></div>}
    </div>
  );
}

const S = {
  container:{minHeight:'100vh',backgroundColor:'#F8FAFC',fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif",color:'#1F2937',paddingBottom:100},
  loadingWrap:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',gap:16},
  header:{background:'linear-gradient(135deg,#1F2937 0%,#374151 100%)',padding:'16px 20px',position:'sticky',top:0,zIndex:100,boxShadow:'0 4px 20px rgba(0,0,0,0.15)'},
  headerContent:{display:'flex',justifyContent:'space-between',alignItems:'center',maxWidth:600,margin:'0 auto'},
  backBtn:{background:'rgba(255,255,255,0.15)',border:'none',padding:'8px 16px',borderRadius:20,fontSize:15,fontWeight:600,color:'white',cursor:'pointer'},
  searchWrap:{padding:'16px 20px',background:'linear-gradient(180deg,#374151 0%,#F8FAFC 100%)'},
  searchBox:{display:'flex',alignItems:'center',background:'white',borderRadius:14,padding:'12px 16px',maxWidth:600,margin:'0 auto',boxShadow:'0 4px 15px rgba(0,0,0,0.08)'},
  searchInput:{flex:1,border:'none',fontSize:16,background:'transparent',color:'#1F2937'},
  clearBtn:{background:'none',border:'none',fontSize:18,cursor:'pointer',padding:'4px 8px',color:'#6B7280'},
  filterWrap:{padding:'0 20px 16px',maxWidth:600,margin:'0 auto'},
  filterRow:{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'},
  filterBtn:{padding:'8px 12px',border:'2px solid #E5E7EB',borderRadius:20,background:'white',fontSize:13,fontWeight:600,cursor:'pointer',color:'#6B7280',transition:'all 0.2s'},
  filterActive:{borderColor:'#1F2937',backgroundColor:'#1F2937',color:'white'},
  legend:{display:'flex',flexWrap:'wrap',gap:10,padding:12,background:'white',borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,0.05)'},
  legendItem:{display:'flex',alignItems:'center',gap:5,fontSize:12},
  legendDot:{width:10,height:10,borderRadius:'50%'},
  legendCode:{fontFamily:"'JetBrains Mono',monospace",fontWeight:600},
  legendName:{color:'#6B7280'},
  main:{maxWidth:600,margin:'0 auto',padding:'0 20px'},
  sectionTitle:{fontSize:18,fontWeight:600,marginBottom:16,color:'#1F2937'},
  resultCard:{background:'white',borderRadius:12,overflow:'hidden',display:'flex',alignItems:'center',cursor:'pointer',boxShadow:'0 2px 10px rgba(0,0,0,0.06)',animation:'slideUp 0.3s ease-out forwards',opacity:0},
  resultColor:{width:70,height:70,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
  resultBoxCode:{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:600,color:'white',textShadow:'0 1px 2px rgba(0,0,0,0.2)'},
  accessSmall:{width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',marginRight:12,fontSize:16},
  codeTag:{fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:'#1F2937',backgroundColor:'#F3F4F6',padding:'2px 6px',borderRadius:4,marginRight:6},
  emptyState:{textAlign:'center',padding:'40px 20px'},
  welcome:{textAlign:'center',padding:'40px 20px',animation:'fadeIn 0.5s ease-out'},
  explainer:{background:'white',borderRadius:16,padding:20,marginBottom:24,textAlign:'left',boxShadow:'0 4px 15px rgba(0,0,0,0.06)'},
  explainerRow:{display:'flex',alignItems:'center',gap:12,marginBottom:12},
  explainerBadge:{padding:'6px 12px',borderRadius:8,color:'white',fontWeight:600,fontSize:14,minWidth:60,textAlign:'center'},
  codeExample:{fontFamily:"'JetBrains Mono',monospace",fontWeight:600,color:'#10B981',backgroundColor:'#ECFDF5',padding:'2px 8px',borderRadius:4},
  primaryBtn:{background:'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)',border:'none',padding:'14px 28px',borderRadius:25,fontSize:16,fontWeight:600,color:'white',cursor:'pointer',boxShadow:'0 4px 15px rgba(59,130,246,0.4)'},
  locTitle:{fontSize:16,fontWeight:600,display:'flex',alignItems:'center',gap:8,marginBottom:12,color:'#1F2937'},
  locDot:{width:12,height:12,borderRadius:'50%',flexShrink:0},
  boxGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:16},
  boxCard:{background:'white',borderRadius:16,overflow:'hidden',cursor:'pointer',boxShadow:'0 4px 15px rgba(0,0,0,0.06)',position:'relative',animation:'slideUp 0.4s ease-out forwards',opacity:0},
  boxTop:{padding:20,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',minHeight:80},
  boxCode:{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:600,color:'white',textShadow:'0 2px 4px rgba(0,0,0,0.2)'},
  accessInd:{position:'absolute',top:8,left:8,width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,boxShadow:'0 2px 4px rgba(0,0,0,0.1)'},
  boxBottom:{padding:'14px 16px',background:'white'},
  editBtn:{position:'absolute',top:8,right:8,background:'rgba(255,255,255,0.9)',border:'none',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:14,boxShadow:'0 2px 8px rgba(0,0,0,0.1)'},
  fab:{position:'fixed',bottom:24,right:24,width:60,height:60,borderRadius:'50%',background:'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)',border:'none',fontSize:32,color:'white',cursor:'pointer',boxShadow:'0 6px 25px rgba(59,130,246,0.4)',zIndex:50},
  detailHeader:{margin:'0 -20px 0',padding:'24px 20px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'},
  detailCode:{fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:600,color:'white',textShadow:'0 2px 4px rgba(0,0,0,0.2)'},
  accessBadge:{padding:'4px 10px',borderRadius:6,color:'white',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4},
  iconBtn:{background:'rgba(255,255,255,0.25)',border:'none',width:40,height:40,borderRadius:'50%',cursor:'pointer',fontSize:18},
  addItemBtn:{background:'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)',border:'none',padding:'8px 16px',borderRadius:20,fontSize:14,fontWeight:600,cursor:'pointer',color:'white'},
  emptyItems:{textAlign:'center',padding:'40px 20px',background:'white',borderRadius:16},
  secondaryBtn:{background:'transparent',border:'2px solid #3B82F6',padding:'10px 20px',borderRadius:20,fontSize:14,fontWeight:600,color:'#3B82F6',cursor:'pointer'},
  itemCard:{background:'white',borderRadius:12,padding:16,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,boxShadow:'0 2px 10px rgba(0,0,0,0.04)',animation:'slideUp 0.3s ease-out forwards',opacity:0},
  smallBtn:{background:'#F3F4F6',border:'none',width:32,height:32,borderRadius:8,cursor:'pointer',fontSize:14},
  moveSelect:{background:'#F3F4F6',border:'none',padding:'6px 8px',borderRadius:8,fontSize:13,cursor:'pointer',maxWidth:100},
  overlay:{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200,animation:'fadeIn 0.2s ease-out'},
  modal:{background:'#F8FAFC',borderRadius:'24px 24px 0 0',padding:'24px 20px 40px',width:'100%',maxWidth:500,maxHeight:'90vh',overflow:'auto',animation:'slideUp 0.3s ease-out'},
  modalTitle:{fontSize:22,fontWeight:700,marginBottom:20,textAlign:'center'},
  formGroup:{marginBottom:20},
  label:{display:'block',fontSize:14,fontWeight:600,marginBottom:8,color:'#374151'},
  accessOpt:{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',border:'2px solid #E5E7EB',borderRadius:12,background:'white',cursor:'pointer',textAlign:'left',transition:'all 0.2s'},
  accessCode:{fontFamily:"'JetBrains Mono',monospace",fontWeight:600,fontSize:16},
  codePreview:{display:'flex',alignItems:'center',gap:8,marginBottom:10,padding:'10px 14px',background:'#1F2937',borderRadius:8},
  input:{width:'100%',padding:'14px 16px',border:'2px solid #E5E7EB',borderRadius:12,fontSize:16,background:'white'},
  textarea:{width:'100%',padding:'14px 16px',border:'2px solid #E5E7EB',borderRadius:12,fontSize:16,background:'white',resize:'vertical',minHeight:80},
  locPreview:{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',width:16,height:16,borderRadius:'50%',border:'2px solid white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'},
  modalActions:{display:'flex',gap:12,marginTop:24},
  cancelBtn:{flex:1,padding:14,border:'2px solid #E5E7EB',borderRadius:12,background:'white',fontSize:16,fontWeight:600,cursor:'pointer',color:'#6B7280'},
  deleteBtn:{padding:'14px 20px',border:'none',borderRadius:12,background:'#EF4444',fontSize:16,fontWeight:600,cursor:'pointer',color:'white'},
  addAnotherBtn:{padding:'14px 16px',border:'2px solid #3B82F6',borderRadius:12,background:'white',fontSize:16,fontWeight:600,cursor:'pointer',color:'#3B82F6'},
  saveBtn:{flex:1,padding:14,border:'none',borderRadius:12,background:'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)',fontSize:16,fontWeight:600,cursor:'pointer',color:'white'},
};
