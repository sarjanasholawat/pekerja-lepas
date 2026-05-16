// ============================================================
//  PEKERJA LEPAS — Code.gs v3
//  Tambahan: field kategori di Pekerjaan
// ============================================================

const SHEET_USERS     = 'Users';
const SHEET_PEKERJAAN = 'Pekerjaan';

function doGet(e)  { return route(e); }
function doPost(e) { return route(e); }

function route(e) {
  let body = {};
  try { if (e.postData && e.postData.contents) body = JSON.parse(e.postData.contents); } catch(_){}
  const action = e.parameter.action || body.action || '';
  let result;
  try {
    switch(action) {
      case 'login':       result = login(body);       break;
      case 'getUsers':    result = getUsers(body);    break;
      case 'createUser':  result = createUser(body);  break;
      case 'updateUser':  result = updateUser(body);  break;
      case 'deleteUser':  result = deleteUser(body);  break;
      case 'getJobs':     result = getJobs(body);     break;
      case 'getAllJobs':   result = getAllJobs(body);  break;
      case 'saveJob':     result = saveJob(body);     break;
      case 'deleteJob':   result = deleteJob(body);   break;
      case 'initSheets':  result = initSheets();      break;
      case 'ping':        result = {success:true,message:'API aktif!'}; break;
      default:            result = {success:false,error:'Action tidak dikenali: '+action};
    }
  } catch(err) { result = {success:false,error:err.message}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "'+name+'" tidak ditemukan. Jalankan initSheets dulu.');
  return sheet;
}

function getAllRows(sheetName) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).filter(row=>row[0]!==''&&row[0]!==null).map(row=>{
    const obj={}; headers.forEach((h,i)=>obj[String(h)]=row[i]); return obj;
  });
}

function isAdmin(requesterId) {
  if (!requesterId) return false;
  const u = getAllRows(SHEET_USERS).find(u=>String(u.id)===String(requesterId));
  return u && u.role==='admin';
}

function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let us = ss.getSheetByName(SHEET_USERS);
  if (!us) {
    us = ss.insertSheet(SHEET_USERS);
    us.appendRow(['id','username','password','nama','role','createdAt']);
    us.getRange(1,1,1,6).setFontWeight('bold').setBackground('#0C447C').setFontColor('#FFF');
    [140,130,130,160,80,180].forEach((w,i)=>us.setColumnWidth(i+1,w));
    us.appendRow(['USR_001','admin','admin123','Administrator','admin',new Date().toISOString()]);
    us.appendRow(['USR_002','user1','user123','Budi Santoso','user',new Date().toISOString()]);
    us.appendRow(['USR_003','user2','user456','Sari Dewi','user',new Date().toISOString()]);
  }

  let pk = ss.getSheetByName(SHEET_PEKERJAAN);
  if (!pk) {
    pk = ss.insertSheet(SHEET_PEKERJAAN);
    // kolom ke-9 = kategori (baru)
    pk.appendRow(['id','userId','nama','tgl','hari','tahun','durasi','status','kategori','wibMulai','wibSelesai','createdAt']);
    pk.getRange(1,1,1,12).setFontWeight('bold').setBackground('#1a6fca').setFontColor('#FFF');
    [150,120,220,100,90,70,80,90,130,80,80,180].forEach((w,i)=>pk.setColumnWidth(i+1,w));
  }

  return {success:true,message:'Sheet berhasil dibuat! Akun: admin/admin123, user1/user123, user2/user456.'};
}

function login(body) {
  const {username,password,role}=body;
  if(!username||!password) return {success:false,error:'Username dan password wajib.'};
  const u=getAllRows(SHEET_USERS).find(u=>String(u.username)===String(username)&&String(u.password)===String(password)&&(role?String(u.role)===String(role):true));
  if(!u) return {success:false,error:'Username, password, atau role tidak sesuai.'};
  return {success:true,user:{id:u.id,username:u.username,nama:u.nama,role:u.role}};
}

function getUsers(body) {
  if(!isAdmin(body.requesterId)) return {success:false,error:'Akses ditolak.'};
  return {success:true,data:getAllRows(SHEET_USERS).map(u=>({id:u.id,username:u.username,nama:u.nama,role:u.role,createdAt:u.createdAt}))};
}

function createUser(body) {
  if(!isAdmin(body.requesterId)) return {success:false,error:'Akses ditolak.'};
  const{username,password,nama,role}=body;
  if(!username||!password||!nama||!role) return {success:false,error:'Semua field wajib.'};
  if(getAllRows(SHEET_USERS).find(u=>String(u.username)===String(username))) return {success:false,error:'Username sudah digunakan.'};
  const id='USR_'+Date.now();
  getSheet(SHEET_USERS).appendRow([id,username,password,nama,role,new Date().toISOString()]);
  return {success:true,id};
}

function updateUser(body) {
  if(!isAdmin(body.requesterId)) return {success:false,error:'Akses ditolak.'};
  const{id,username,password,nama,role}=body;
  const sheet=getSheet(SHEET_USERS);
  const data=sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(String(data[i][0])===String(id)){
      if(username) sheet.getRange(i+1,2).setValue(username);
      if(password) sheet.getRange(i+1,3).setValue(password);
      if(nama)     sheet.getRange(i+1,4).setValue(nama);
      if(role)     sheet.getRange(i+1,5).setValue(role);
      return {success:true};
    }
  }
  return {success:false,error:'User tidak ditemukan.'};
}

function deleteUser(body) {
  if(!isAdmin(body.requesterId)) return {success:false,error:'Akses ditolak.'};
  const{id}=body;
  const us=getSheet(SHEET_USERS); const ud=us.getDataRange().getValues();
  for(let i=ud.length-1;i>=1;i--){ if(String(ud[i][0])===String(id)){us.deleteRow(i+1);break;} }
  const pk=getSheet(SHEET_PEKERJAAN); const pd=pk.getDataRange().getValues();
  for(let i=pd.length-1;i>=1;i--){ if(String(pd[i][1])===String(id)){pk.deleteRow(i+1);} }
  return {success:true};
}

function getJobs(body) {
  const{userId}=body;
  if(!userId) return {success:false,error:'userId wajib.'};
  const jobs=getAllRows(SHEET_PEKERJAAN)
    .filter(j=>String(j.userId)===String(userId))
    .map(j=>({id:j.id,nama:j.nama,tgl:j.tgl,hari:j.hari,tahun:parseInt(j.tahun)||0,durasi:parseInt(j.durasi)||0,status:j.status,kategori:j.kategori||'',wibMulai:j.wibMulai||'',wibSelesai:j.wibSelesai||''}))
    .reverse();
  return {success:true,data:jobs};
}

function getAllJobs(body) {
  if(!isAdmin(body.requesterId)) return {success:false,error:'Akses ditolak.'};
  const jobs=getAllRows(SHEET_PEKERJAAN)
    .map(j=>({id:j.id,userId:j.userId,nama:j.nama,tgl:j.tgl,hari:j.hari,tahun:parseInt(j.tahun)||0,durasi:parseInt(j.durasi)||0,status:j.status,kategori:j.kategori||'',wibMulai:j.wibMulai||'',wibSelesai:j.wibSelesai||''}))
    .reverse();
  return {success:true,data:jobs};
}

function saveJob(body) {
  const{userId,nama,tgl,hari,tahun,durasi,status,kategori}=body;
  if(!userId||!nama||!tgl||!durasi) return {success:false,error:'Field tidak lengkap.'};
  const id='JOB_'+Date.now();
  getSheet(SHEET_PEKERJAAN).appendRow([id,userId,nama,tgl,hari,tahun,parseInt(durasi),status||'selesai',kategori||'',new Date().toISOString()]);
  return {success:true,id};
}

function deleteJob(body) {
  const{id,requesterId}=body;
  if(!id) return {success:false,error:'id wajib.'};
  const sheet=getSheet(SHEET_PEKERJAAN);
  const data=sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(String(data[i][0])===String(id)){
      if(!isAdmin(requesterId)&&String(data[i][1])!==String(requesterId)) return {success:false,error:'Akses ditolak.'};
      sheet.deleteRow(i+1);
      return {success:true};
    }
  }
  return {success:false,error:'Data tidak ditemukan.'};
}
