const SESSION_HOURS = 12;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function html(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" } });
}
function b64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function unb64(s) { return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0)); }
async function sha256(s) { return b64(await crypto.subtle.digest('SHA-256', encoder.encode(s))); }
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: 310000, hash: 'SHA-256' }, key, 256);
  return b64(bits);
}
function randomToken() { const a = new Uint8Array(32); crypto.getRandomValues(a); return b64(a); }
function cookie(token, maxAge = SESSION_HOURS * 3600) { return `ne1_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`; }
function clearCookie() { return 'ne1_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'; }
function getCookie(request, name) { return (request.headers.get('Cookie') || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1) || null; }
async function body(request) { try { return await request.json(); } catch { return {}; } }
function validUsername(s) { return typeof s === 'string' && /^[a-zA-Z0-9._-]{4,32}$/.test(s); }
function validPassword(s) { return typeof s === 'string' && s.length >= 12 && s.length <= 128; }
async function sessionUser(request, env) {
  const token = getCookie(request, 'ne1_session'); if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`SELECT u.id,u.username,u.full_name,u.role,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at > datetime('now')`).bind(tokenHash).first();
  return row && row.status === 'approved' ? row : null;
}
async function createSession(userId, env) {
  const token = randomToken(), tokenHash = await sha256(token);
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime('now', ?))").bind(tokenHash,userId,`+${SESSION_HOURS} hours`).run();
  return token;
}
function loginPage(mode='login', message='') {
  const isRegister = mode === 'register';
  return html(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#123c86"><title>${isRegister?'สมัครสมาชิก':'เข้าสู่ระบบ'} | NE1 อีสานทีม</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:linear-gradient(135deg,#0d2e6e,#1e63d5 65%,#36a9e8);font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;color:#182230}.panel{width:min(100%,430px);background:#fff;border-radius:24px;padding:30px;box-shadow:0 24px 70px #001b4c55}.brand{font-size:12px;letter-spacing:2px;font-weight:900;color:#1e63d5}.mark{width:54px;height:54px;border-radius:16px;background:#edf4ff;display:grid;place-items:center;font-size:27px;margin-bottom:18px}.title{font-size:27px;font-weight:900;margin:8px 0}.sub{font-size:13px;color:#657184;margin:0 0 22px}.field{display:grid;gap:7px;margin:14px 0}.field label{font-size:13px;font-weight:750}.field input{width:100%;padding:13px 14px;border:1px solid #dbe3ef;border-radius:12px;font:inherit;outline:none}.field input:focus{border-color:#1e63d5;box-shadow:0 0 0 3px #1e63d51a}.btn{width:100%;border:0;border-radius:12px;padding:14px;background:#123c86;color:#fff;font:inherit;font-weight:850;cursor:pointer;margin-top:10px}.btn:disabled{opacity:.55}.msg{padding:11px 12px;border-radius:10px;background:#fff4e8;color:#99500a;font-size:13px;margin:12px 0}.switch{text-align:center;font-size:13px;margin-top:18px;color:#657184}.switch a{color:#1754b4;font-weight:800;text-decoration:none}.note{font-size:11px;color:#7b8797;line-height:1.6;margin-top:18px}.hidden{display:none!important}
  </style></head><body><main class="panel"><div class="mark">🔐</div><div class="brand">NE1 • ISAN TEAM</div><h1 class="title">${isRegister?'สมัครสมาชิก':'เข้าสู่ระบบ'}</h1><p class="sub">${isRegister?'สร้างบัญชีเพื่อขอสิทธิ์เข้าใช้งานระบบภายในทีม':'กรุณายืนยันตัวตนก่อนเข้าถึงเว็บไซต์ NE1 อีสานทีม'}</p><div id="message" class="msg ${message?'':'hidden'}">${message}</div><form id="authForm">${isRegister?'<div class="field"><label>ชื่อ-นามสกุล</label><input name="full_name" required maxlength="80" autocomplete="name"></div>':''}<div class="field"><label>Username</label><input name="username" required minlength="4" maxlength="32" pattern="[A-Za-z0-9._-]+" autocomplete="username"></div><div class="field"><label>Password</label><input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${isRegister?'new-password':'current-password'}"></div>${isRegister?'<p class="note">รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร บัญชีใหม่จะต้องรอ Super Admin อนุมัติก่อนใช้งาน</p>':''}<button class="btn" type="submit">${isRegister?'ส่งคำขอสมัครสมาชิก':'เข้าสู่ระบบ'}</button></form><div class="switch">${isRegister?'มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a>':'ยังไม่มีบัญชี? <a href="/register">สมัครสมาชิก</a>'}</div><p class="note">ข้อมูลนี้สำหรับการใช้งานภายใน NE1 อีสานทีมเท่านั้น</p></main><script>
  const form=document.getElementById('authForm'),msg=document.getElementById('message');form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const endpoint='${isRegister?'/api/register':'/api/login'}';const btn=form.querySelector('button');btn.disabled=true;try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});const d=await r.json();if(!r.ok)throw new Error(d.error||'ไม่สามารถดำเนินการได้');if(${isRegister?'true':'false'}){form.reset();msg.textContent=d.message;msg.classList.remove('hidden')}else location.href='/'}catch(err){msg.textContent=err.message;msg.classList.remove('hidden')}finally{btn.disabled=false}});
  </script></body></html>`);
}
function adminPage(user) {
 return html(`<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>จัดการสมาชิก | NE1</title><style>body{font-family:system-ui,Tahoma,sans-serif;background:#f5f7fb;color:#182230;margin:0;padding:20px}.wrap{max-width:1000px;margin:auto}.top,.box{background:white;border:1px solid #e4eaf2;border-radius:16px;padding:18px;margin-bottom:14px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}h1{font-size:24px;margin:0}button{border:0;border-radius:9px;padding:9px 12px;background:#123c86;color:#fff;font-weight:750;cursor:pointer;margin:2px}button.danger{background:#b42332}button.gray{background:#64748b}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:11px;border-bottom:1px solid #edf0f5}th{color:#64748b}.muted{color:#64748b;font-size:13px}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}input{padding:10px;border:1px solid #dbe3ef;border-radius:9px}label{font-size:13px}#notice{margin:10px 0;color:#1754b4}@media(max-width:650px){.tablewrap{overflow:auto}table{min-width:650px}}</style></head><body><main class="wrap"><section class="top"><div><div class="muted">NE1 • SUPER ADMIN</div><h1>จัดการสมาชิก</h1><div class="muted">เข้าสู่ระบบในชื่อ ${escapeHtml(user.username)}</div></div><div><button class="gray" onclick="location.href='/'">กลับหน้าเว็บไซต์</button><button class="danger" onclick="logout()">ออกจากระบบ</button></div></section><section class="box"><h3>การสมัครสมาชิก</h3><label><input type="checkbox" id="regOpen"> เปิดให้สมัครสมาชิกเอง</label><button onclick="saveSettings()">บันทึก</button><p class="muted">เมื่อปิดรับสมัคร ผู้ดูแลยังสามารถสร้างบัญชีให้สมาชิกได้</p></section><section class="box"><h3>สร้างบัญชีให้สมาชิก</h3><div class="row"><input id="newName" placeholder="ชื่อ-นามสกุล"><input id="newUser" placeholder="Username"><input id="newPass" type="password" placeholder="Password (12 ตัวขึ้นไป)"><button onclick="createUser()">สร้างบัญชี</button></div></section><section class="box"><h3>รายชื่อสมาชิก</h3><div id="notice"></div><div class="tablewrap"><table><thead><tr><th>ชื่อ</th><th>Username</th><th>สถานะ</th><th>สิทธิ์</th><th>จัดการ</th></tr></thead><tbody id="users"></tbody></table></div></section></main><script>
  async function api(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'เกิดข้อผิดพลาด');return d}function note(t){document.getElementById('notice').textContent=t}async function load(){try{const d=await api('/api/admin/users');document.getElementById('users').innerHTML=d.users.map(u=>'<tr><td>'+esc(u.full_name||'-')+'</td><td>'+esc(u.username)+'</td><td>'+esc(u.status)+'</td><td>'+esc(u.role)+'</td><td>'+(u.role==='admin'?'':(u.status==='pending'?'<button onclick="act(\''+u.id+'\',\'approve\')">อนุมัติ</button>':'')+'<button class="gray" onclick="act(\''+u.id+'\',\'disable\')">ระงับ</button><button class="danger" onclick="act(\''+u.id+'\',\'delete\')">ลบ</button>'))+'</td></tr>').join('');const s=await api('/api/admin/settings');document.getElementById('regOpen').checked=s.registration_open}catch(e){note(e.message)}}function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}async function act(id,action){if(!confirm('ยืนยัน '+action+' สมาชิกนี้?'))return;try{await api('/api/admin/users/'+id+'/'+action,{});note('ดำเนินการแล้ว');load()}catch(e){note(e.message)}}async function saveSettings(){try{await api('/api/admin/settings',{registration_open:document.getElementById('regOpen').checked});note('บันทึกการตั้งค่าแล้ว')}catch(e){note(e.message)}}async function createUser(){try{await api('/api/admin/create-user',{full_name:document.getElementById('newName').value,username:document.getElementById('newUser').value,password:document.getElementById('newPass').value});note('สร้างบัญชีเรียบร้อย');load()}catch(e){note(e.message)}}async function logout(){await api('/api/logout',{});location.href='/login'}load();
  </script></body></html>`);
}
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function requireAdmin(request, env) { const user=await sessionUser(request,env); return user && user.role==='admin' ? user : null; }
async function handleApi(request, env, url) {
  const path=url.pathname, method=request.method;
  if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({error:'คำขอไม่ถูกต้อง'},403);
  if (path==='/api/setup' && method==='POST') {
    if (!env.BOOTSTRAP_KEY) return json({error:'ยังไม่ได้ตั้งค่า BOOTSTRAP_KEY'},503);
    const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").first();
    const b=await body(request);
    if (count.n>0) return json({error:'มี Super Admin แล้ว'},409);
    if (b.key!==env.BOOTSTRAP_KEY) return json({error:'Setup key ไม่ถูกต้อง'},403);
    if (!validUsername(b.username)||!validPassword(b.password)) return json({error:'Username ต้อง 4-32 ตัว และ Password อย่างน้อย 12 ตัว'},400);
    const salt=randomToken(), hash=await passwordHash(b.password,salt), id=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO users(id,username,full_name,password_hash,password_salt,role,status) VALUES(?,?,?,?,?,'admin','approved')").bind(id,b.username,b.full_name||'NE1 Super Admin',hash,salt).run();
    return json({message:'สร้าง Super Admin สำเร็จ'});
  }
  if (path==='/api/register' && method==='POST') {
    const setting=await env.DB.prepare("SELECT value FROM settings WHERE key='registration_open'").first();
    if (setting?.value!=='true') return json({error:'ขณะนี้ปิดรับสมัครสมาชิก กรุณาติดต่อผู้ดูแลระบบ'},403);
    const b=await body(request);
    if (!validUsername(b.username)||!validPassword(b.password)||typeof b.full_name!=='string'||b.full_name.trim().length<2) return json({error:'กรุณากรอกข้อมูลให้ครบ Username 4-32 ตัว และ Password อย่างน้อย 12 ตัว'},400);
    const salt=randomToken(), hash=await passwordHash(b.password,salt), id=crypto.randomUUID();
    try { await env.DB.prepare("INSERT INTO users(id,username,full_name,password_hash,password_salt,role,status) VALUES(?,?,?,?,?,'member','pending')").bind(id,b.username.toLowerCase(),b.full_name.trim(),hash,salt).run(); }
    catch { return json({error:'Username นี้ถูกใช้งานแล้ว'},409); }
    return json({message:'ส่งคำขอสมัครสมาชิกแล้ว กรุณารอ Super Admin อนุมัติก่อนเข้าสู่ระบบ'});
  }
  if (path==='/api/login' && method==='POST') {
    const b=await body(request); if(typeof b.username!=='string'||typeof b.password!=='string') return json({error:'กรุณากรอก Username และ Password'},400);
    const u=await env.DB.prepare('SELECT * FROM users WHERE username=?').bind(b.username.toLowerCase()).first();
    if(!u) return json({error:'Username หรือ Password ไม่ถูกต้อง'},401);
    const hash=await passwordHash(b.password,u.password_salt);
    if(hash!==u.password_hash) return json({error:'Username หรือ Password ไม่ถูกต้อง'},401);
    if(u.status!=='approved') return json({error:u.status==='pending'?'บัญชียังรออนุมัติ':'บัญชีนี้ถูกระงับ'},403);
    const token=await createSession(u.id,env);
    return json({ok:true},200,{'set-cookie':cookie(token)});
  }
  if (path==='/api/logout' && method==='POST') {
    const token=getCookie(request,'ne1_session'); if(token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
    return json({ok:true},200,{'set-cookie':clearCookie()});
  }
  if (path==='/api/me' && method==='GET') { const u=await sessionUser(request,env); return u?json({user:u}):json({user:null},401); }
  if (path==='/api/admin/users' && method==='GET') {
    if(!await requireAdmin(request,env)) return json({error:'ไม่มีสิทธิ์เข้าถึง'},403);
    const r=await env.DB.prepare('SELECT id,username,full_name,role,status,created_at FROM users ORDER BY created_at DESC').all(); return json({users:r.results});
  }
  if (path==='/api/admin/settings' && method==='GET') {
    if(!await requireAdmin(request,env)) return json({error:'ไม่มีสิทธิ์เข้าถึง'},403);
    const r=await env.DB.prepare("SELECT value FROM settings WHERE key='registration_open'").first(); return json({registration_open:r?.value==='true'});
  }
  if (path==='/api/admin/settings' && method==='POST') {
    if(!await requireAdmin(request,env)) return json({error:'ไม่มีสิทธิ์เข้าถึง'},403);
    const b=await body(request); await env.DB.prepare("INSERT INTO settings(key,value) VALUES('registration_open',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(b.registration_open?'true':'false').run(); return json({ok:true});
  }
  if (path==='/api/admin/create-user' && method==='POST') {
    if(!await requireAdmin(request,env)) return json({error:'ไม่มีสิทธิ์เข้าถึง'},403);
    const b=await body(request); if(!validUsername(b.username)||!validPassword(b.password)||typeof b.full_name!=='string'||b.full_name.trim().length<2) return json({error:'ข้อมูลไม่ถูกต้อง หรือ Password ต้องอย่างน้อย 12 ตัว'},400);
    const salt=randomToken(),hash=await passwordHash(b.password,salt),id=crypto.randomUUID();
    try{await env.DB.prepare("INSERT INTO users(id,username,full_name,password_hash,password_salt,role,status) VALUES(?,?,?,?,?,'member','approved')").bind(id,b.username.toLowerCase(),b.full_name.trim(),hash,salt).run()}catch{return json({error:'Username นี้ถูกใช้งานแล้ว'},409)}
    return json({ok:true});
  }
  const action=path.match(/^\/api\/admin\/users\/([\w-]+)\/(approve|disable|delete)$/);
  if(action && method==='POST') {
    if(!await requireAdmin(request,env)) return json({error:'ไม่มีสิทธิ์เข้าถึง'},403);
    const [,id,op]=action;
    if(op==='approve') await env.DB.prepare("UPDATE users SET status='approved' WHERE id=? AND role!='admin'").bind(id).run();
    if(op==='disable') { await env.DB.prepare("UPDATE users SET status='disabled' WHERE id=? AND role!='admin'").bind(id).run(); await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run(); }
    if(op==='delete') { await env.DB.prepare("DELETE FROM users WHERE id=? AND role!='admin'").bind(id).run(); await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(id).run(); }
    return json({ok:true});
  }
  return json({error:'ไม่พบ API'},404);
}
export default {
 async fetch(request, env) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/')) return handleApi(request,env,url);
  if(url.pathname==='/login') return loginPage('login');
  if(url.pathname==='/register') { const s=await env.DB.prepare("SELECT value FROM settings WHERE key='registration_open'").first(); return s?.value==='true'?loginPage('register'):loginPage('login','ขณะนี้ปิดรับสมัครสมาชิก กรุณาติดต่อผู้ดูแลระบบ'); }
  const user=await sessionUser(request,env);
  if(!user) return Response.redirect(new URL('/login',url),302);
  if(url.pathname==='/admin') { if(user.role!=='admin') return new Response('Forbidden',{status:403}); return adminPage(user); }
  const assetResponse=await env.ASSETS.fetch(request);
  const headers=new Headers(assetResponse.headers); headers.set('cache-control','private, no-store'); headers.set('x-robots-tag','noindex, nofollow');
  return new Response(assetResponse.body,{status:assetResponse.status,headers});
 }
};
