// =======================================================================
//  الملف: archive/drive-archive.gs   (برنامج Google Apps Script)
//  المشروع: منصة الشكاوى — إدارة الحج والعمرة، قسم الشكاوى
//  الوصف: أرشفة الشكاوى تلقائياً على Google Drive. يعمل داخل حساب Google الخاص بالإدارة، مجاناً،
//         ويقرأ البيانات من Supabase (للقراءة فقط) بمفتاح أرشفة خاص.
//  ما ينشئه على Drive:
//    📁 أرشيف الشكاوى
//     └─ 📁 موسم 1448
//         ├─ 📊 سجل شكاوى موسم 1448           (Google Sheet بكل الشكاوى، يتحدّث في كل تشغيل)
//         └─ 📁 1448-00003 — سعيد ضد خالد
//             ├─ 📄 الملف الكامل 1448-00003.pdf  (الشكوى ← الجلسات ← النتيجة ← الاعتراض ← الجلسات ← النتيجة النهائية)
//             ├─ 📁 01 الشكوى الرئيسية   ← الشكوى.pdf
//             ├─ 📁 02 الإحالات           ← سجل الإحالات.pdf
//             ├─ 📁 03 الوثائق            ← فارغ: تضع فيه المستندات يدوياً (لا يمسّه البرنامج)
//             ├─ 📁 04 الجلسات            ← ملف لكل جلسة
//             └─ 📁 05 قرار الإغلاق       ← عند إغلاق الشكوى
//  طريقة التشغيل (مرة واحدة):
//    1) script.google.com ← مشروع جديد ← الصق هذا الملف كاملاً مكان الكود الموجود ← احفظ.
//    2) ضع مفتاح الأرشفة في ARCHIVE_KEY أدناه (نفس المفتاح المعيَّن في Supabase بـ set_archive_key).
//    3) اختر الدالة archiveNow ← «تشغيل» ← وافق على الأذونات (Drive وجداول البيانات والاتصال الخارجي).
//    4) اختر الدالة installHourly ← «تشغيل»: يعمل البرنامج وحده كل ساعة بعد ذلك.
//  ملاحظات:
//    - لا يعيد إنشاء ملفات شكوى لم تتغيّر (يحفظ «بصمة» لكل شكوى)، ويعالج 25 شكوى متغيّرة كحد أقصى في كل
//      تشغيل (حد وقت Google)، والباقي في التشغيل التالي.
//    - الملفات التي ينشئها البرنامج تحمل وصف AUTO-ARCHIVE، ويستبدلها فقط هي؛ ملفاتك في «03 الوثائق» لا تُمس.
//    - لا تشارك هذا المشروع: فيه مفتاح الأرشفة. والمجلد فيه أسماء وأرقام هواتف: شاركه مع أشخاص محددين فقط.
//  سجل التعديلات:
//    2026-09-30  الإصدار الأول.
//    2026-09-30  قرار الإغلاق والملف الكامل يشملان حالة «مغلقة بعد الاعتراض».
//    2026-09-30  الملف الكامل بالترتيب المعتمد: المشتكي، المشتكى عليه، العنوان، النص، الجلسات قبل الاعتراض (موضوع
//                ونتيجة كل جلسة)، نتيجة الشكوى عند إغلاقها، الاعتراض، الجلسات بعده، ثم نتيجة الاعتراض.
// =======================================================================

// الإعدادات: عنوان المشروع ومفتاحه العام (نفس config.js)، ومفتاح الأرشفة الخاص، واسم مجلد الأرشيف
const CONFIG = {
  SUPABASE_URL: "https://nkcngzsjevgzurwxkjqn.supabase.co",
  ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rY25nenNqZXZnenVyd3hranFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTQyMTEsImV4cCI6MjEwMTMzMDIxMX0.2UlqfEPT-TCBGnIfHqn1sArX1AOkhRr6zvnQt4evD0U",
  ARCHIVE_KEY: "ضع-مفتاح-الأرشفة-هنا",
  ROOT_FOLDER: "أرشيف الشكاوى",
  LOGO_URL: "https://syrian-hajj-complaints.github.io/logo.png",
  MAX_PER_RUN: 25,
};

// أسماء المجلدات الفرعية لكل شكوى، وعلامة الملفات المولَّدة، وألوان الهوية
const SUB = { main: "01 الشكوى الرئيسية", refs: "02 الإحالات", docs: "03 الوثائق", sessions: "04 الجلسات", closing: "05 قرار الإغلاق" };
const MARK = "AUTO-ARCHIVE";
const CLOSED = "مغلقة";
const isClosed = s => s === CLOSED || s === "مغلقة بعد الاعتراض";   // الإغلاق قبل الاعتراض أو بعده

// =====================================================================
// التشغيل
// =====================================================================
// الأرشفة الآن: جلب البيانات ← أرشفة الشكاوى المتغيّرة ← تحديث سجل كل موسم
function archiveNow() {
  const started = Date.now();
  const data = fetchData();
  const props = PropertiesService.getScriptProperties();
  const root = folderIn(DriveApp.getRootFolder(), CONFIG.ROOT_FOLDER);
  const logo = logoDataUri();

  // تجميع الجلسات والإحالات حسب الشكوى
  const bySess = groupBy(data.sessions, "complaint_id");
  const byRefs = groupBy(data.referrals, "complaint_id");

  // الشكاوى حسب الموسم
  const seasons = groupBy(data.complaints, "season");
  let done = 0, pending = 0;

  Object.keys(seasons).sort().forEach(season => {
    const seasonFolder = folderIn(root, "موسم " + (season === "null" ? "بلا موسم" : season));
    const folders = complaintFolders(seasonFolder);

    seasons[season].forEach(c => {
      const sess = bySess[c.id] || [];
      const refs = byRefs[c.id] || [];
      const fp = fingerprint([c, sess, refs]);
      const key = "fp_" + c.id;
      if (props.getProperty(key) === fp && folders[c.complaint_number]) return;          // لم تتغيّر
      if (done >= CONFIG.MAX_PER_RUN || Date.now() - started > 4.5 * 60 * 1000) { pending++; return; }
      folders[c.complaint_number] = archiveComplaint(seasonFolder, folders[c.complaint_number], c, sess, refs, logo);
      props.setProperty(key, fp);
      done++;
    });

    updateSeasonSheet(seasonFolder, season, seasons[season], folders, bySess, byRefs);
  });

  Logger.log("تمت أرشفة " + done + " شكوى" + (pending ? "، وبقي " + pending + " للتشغيل القادم" : ""));
}

// تشغيل تلقائي كل ساعة (يُشغَّل مرة واحدة)
function installHourly() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "archiveNow").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("archiveNow").timeBased().everyHours(1).create();
  Logger.log("تم: الأرشفة تعمل وحدها كل ساعة.");
}

// إعادة إنشاء كل الملفات من جديد في التشغيل القادم (مثلاً بعد تغيير شكل الملفات)
function rebuildAll() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).filter(k => k.indexOf("fp_") === 0).forEach(k => props.deleteProperty(k));
  archiveNow();
}

// =====================================================================
// البيانات
// =====================================================================
// جلب كل الشكاوى والجلسات والإحالات من Supabase عبر archive_export
function fetchData() {
  const res = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + "/rest/v1/rpc/archive_export", {
    method: "post",
    contentType: "application/json",
    headers: { apikey: CONFIG.ANON_KEY, Authorization: "Bearer " + CONFIG.ANON_KEY },
    payload: JSON.stringify({ p_key: CONFIG.ARCHIVE_KEY }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("تعذّر الاتصال بـ Supabase: " + res.getContentText());
  const data = JSON.parse(res.getContentText());
  if (!data) throw new Error("مفتاح الأرشفة غير صحيح أو لم يُعيَّن (select public.set_archive_key('...') في Supabase).");
  return data;
}

// تجميع مصفوفة حسب حقل
function groupBy(list, field) {
  const out = {};
  (list || []).forEach(x => { const k = String(x[field]); (out[k] = out[k] || []).push(x); });
  return out;
}

// بصمة قصيرة لبيانات الشكوى (لمعرفة هل تغيّرت منذ آخر أرشفة)
function fingerprint(obj) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(obj), Utilities.Charset.UTF_8));
}

// =====================================================================
// المجلدات والملفات على Drive
// =====================================================================
// مجلد فرعي بالاسم (يُنشأ إن لم يوجد)
function folderIn(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// مجلدات الشكاوى الموجودة في مجلد الموسم: رقم الشكوى ← المجلد (الاسم يبدأ بالرقم)
function complaintFolders(seasonFolder) {
  const map = {};
  const it = seasonFolder.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    const m = f.getName().match(/^(\d{4}-\d{5})/);
    if (m) map[m[1]] = f;
  }
  return map;
}

// اسم مجلد الشكوى: الرقم — المشتكي ضد المشتكى عليه
function complaintFolderName(c) {
  return cleanName(c.complaint_number + " — " + (c.complainant_name || "") + " ضد " + (c.accused_name || ""));
}

// حذف الحروف غير المسموحة في أسماء الملفات
function cleanName(s) {
  return String(s).replace(/[\\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 150);
}

// حذف الملفات المولَّدة سابقاً فقط (ملفات المستخدم لا تُمس)
function clearGenerated(folder) {
  const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (f.getDescription() === MARK) f.setTrashed(true); }
}

// حفظ صفحة HTML كملف PDF في مجلد، مع علامة «مولَّد»
function savePdf(folder, name, html) {
  const blob = Utilities.newBlob(html, "text/html", "page.html").getAs("application/pdf").setName(cleanName(name) + ".pdf");
  folder.createFile(blob).setDescription(MARK);
}

// أرشفة شكوى واحدة: المجلد ومجلداته الفرعية، ثم الملفات
function archiveComplaint(seasonFolder, folder, c, sess, refs, logo) {
  // المجلد (إنشاء أو تصحيح الاسم)
  const name = complaintFolderName(c);
  if (!folder) folder = seasonFolder.createFolder(name);
  else if (folder.getName() !== name) folder.setName(name);
  const sub = {};
  Object.keys(SUB).forEach(k => { sub[k] = folderIn(folder, SUB[k]); });

  // الشكوى الرئيسية
  clearGenerated(sub.main);
  savePdf(sub.main, "الشكوى " + c.complaint_number, page(logo, "الشكوى " + c.complaint_number, complaintBlock(c)));

  // الإحالات
  clearGenerated(sub.refs);
  if (refs.length) savePdf(sub.refs, "الإحالات " + c.complaint_number, page(logo, "سجل إحالات الشكوى " + c.complaint_number, referralsBlock(refs)));

  // الجلسات: ملف لكل جلسة
  clearGenerated(sub.sessions);
  sess.forEach((s, i) => {
    const title = "جلسة " + (i + 1) + " — " + fmtDay(s.session_at) + (s.title ? " — " + s.title : "");
    savePdf(sub.sessions, title, page(logo, "الشكوى " + c.complaint_number + " — " + title, sessionBlock(s, i + 1)));
  });

  // قرار الإغلاق (للشكوى المغلقة فقط)
  clearGenerated(sub.closing);
  if (isClosed(c.status)) savePdf(sub.closing, "قرار الإغلاق " + c.complaint_number, page(logo, "قرار إغلاق الشكوى " + c.complaint_number, closingBlock(c)));

  // الملف الكامل في مجلد الشكوى نفسه
  clearGenerated(folder);
  savePdf(folder, "الملف الكامل " + c.complaint_number, page(logo, "الملف الكامل للشكوى " + c.complaint_number, fullBlock(c, sess, refs)));
  return folder;
}

// =====================================================================
// سجل الموسم (Google Sheet)
// =====================================================================
// إنشاء «سجل شكاوى موسم ...» أو تحديثه بكل شكاوى الموسم، مع رابط مجلد كل شكوى
function updateSeasonSheet(seasonFolder, season, list, folders, bySess, byRefs) {
  const name = "سجل شكاوى موسم " + season;
  const it = seasonFolder.getFilesByName(name);
  let ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else { ss = SpreadsheetApp.create(name); DriveApp.getFileById(ss.getId()).moveTo(seasonFolder); }

  // الأعمدة والصفوف
  const head = ["رقم الشكوى", "تاريخ الشكوى", "الحالة", "عنوان الاعتراض", "المشتكي", "صفة المشتكي", "رقم الهاتف", "واتس / تلغرام",
                "المشتكى عليه", "صفة المشتكى عليه", "التصنيف", "آخر إحالة", "عدد الإحالات", "عدد الجلسات",
                "النتيجة قبل الاعتراض", "الاعتراض", "نتيجة الشكوى", "تاريخ الإغلاق", "مجلد الشكوى"];
  const rows = list.map(c => {
    const f = folders[c.complaint_number];
    return [c.complaint_number, fmt(c.received_date), c.status, c.title || "", c.complainant_name || "", c.complainant_role || "",
            c.phone_number || "", c.contact_number || "", c.accused_name || "", c.accused_role || "", c.classification || "",
            c.referred_to || "", (byRefs[c.id] || []).length, (bySess[c.id] || []).length,
            c.result_before_objection || "", c.objection_at ? "نعم — " + fmt(c.objection_at) : "لا", c.result || "",
            fmt(c.closed_date), f ? '=HYPERLINK("' + f.getUrl() + '","📁 فتح")' : ""];
  });

  // الكتابة والتنسيق: من اليمين لليسار، صف عناوين ملوّن ومثبّت، وتصفية
  const sh = ss.getSheets()[0];
  sh.setName("الشكاوى");
  if (sh.getFilter()) sh.getFilter().remove();
  sh.clear();
  sh.setRightToLeft(true);
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold").setBackground("#006e5c").setFontColor("#ffffff");
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows).setFontColor("#333132").setVerticalAlignment("top");
  sh.setFrozenRows(1);
  sh.getRange(1, 1, Math.max(rows.length, 1) + 1, head.length).createFilter();
  sh.autoResizeColumns(1, head.length);
}

// =====================================================================
// صفحات PDF (HTML بألوان الهوية)
// =====================================================================
// الصفحة: الترويسة (الشعار والاسم) + العنوان + المحتوى + التذييل
function page(logo, title, body) {
  return '<html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Tahoma,sans-serif;color:#333132;font-size:13pt;line-height:1.7;margin:28px}' +
    '.head{width:100%;border:0;border-bottom:3px solid #ad9e6e;margin-bottom:18px}.head td{border:0;padding:0 0 10px;vertical-align:middle}' +
    '.head img{width:64px;height:64px;margin-left:12px}.org{color:#00594f;font-weight:bold;font-size:15pt}.dept{color:#ad9e6e;font-size:12pt}' +
    'h1{color:#00594f;font-size:17pt;margin:0 0 14px}h2{color:#006e5c;font-size:14pt;border-bottom:1px solid #e3ddd2;padding-bottom:4px;margin:22px 0 10px}' +
    'table{width:100%;border-collapse:collapse;margin:6px 0}td,th{border:1px solid #e3ddd2;padding:6px 9px;vertical-align:top;text-align:right}' +
    'th{background:#f5f1ea;color:#00594f;width:28%;font-weight:bold}.box{background:#f5f1ea;border-right:4px solid #279e91;padding:10px 12px;white-space:pre-wrap}' +
    '.sess{border:1px solid #e3ddd2;border-radius:8px;padding:4px 12px 8px;margin:10px 0}.sess h3{color:#006e5c;font-size:13pt;margin:8px 0}' +
    '.muted{color:#939598}.sign{width:100%;margin-top:48px;border:0}.sign td{border:0;border-top:1px solid #939598;width:40%;text-align:center;padding-top:6px}.sign .gap{border-top:0;width:20%}' +
    '.foot{margin-top:30px;color:#939598;font-size:10pt;border-top:1px solid #e3ddd2;padding-top:6px}' +
    '</style></head><body>' +
    '<table class="head"><tr>' + (logo ? '<td style="width:76px"><img src="' + logo + '"></td>' : '') + '<td><div class="org">إدارة الحج والعمرة</div><div class="dept">قسم الشكاوى</div></td></tr></table>' +
    '<h1>' + esc(title) + '</h1>' + body +
    '<div class="foot">أُنشئ تلقائياً من منصة الشكاوى في ' + esc(fmt(new Date())) + '</div></body></html>';
}

// جدول «عنوان: قيمة»
function kv(rows) {
  return "<table>" + rows.filter(r => r[1] !== undefined && r[1] !== null && r[1] !== "")
    .map(r => "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>").join("") + "</table>";
}

// نص طويل في مربع
function box(text) {
  return text ? '<div class="box">' + esc(text) + "</div>" : '<p class="muted">—</p>';
}

// بيانات الشكوى الرئيسية
function complaintBlock(c) {
  return kv([
    ["رقم الشكوى", c.complaint_number], ["الموسم", c.season], ["تاريخ الشكوى", fmt(c.received_date)], ["الحالة", c.status],
    ["المشتكي", c.complainant_name + (c.complainant_role ? " (" + c.complainant_role + ")" : "")],
    ["رقم الهاتف", c.phone_number], ["واتس / تلغرام", c.contact_number],
    ["المشتكى عليه", (c.accused_name || "") + (c.accused_role ? " (" + c.accused_role + ")" : "")],
    ["التصنيف", c.classification], ["عنوان الاعتراض", c.title],
  ]) + "<h2>نص الشكوى</h2>" + box(c.subject);
}

// سجل الإحالات
function referralsBlock(refs) {
  return "<table><tr><th style='width:30%'>التاريخ</th><th>مُحالة إلى</th></tr>" +
    refs.map(r => "<tr><td>" + esc(fmt(r.referred_at)) + "</td><td>" + esc(r.referred_to) + "</td></tr>").join("") + "</table>";
}

// جلسة واحدة
function sessionBlock(s, n) {
  return kv([["رقم الجلسة", n], ["التاريخ والوقت", fmt(s.session_at)], ["عنوان الجلسة", s.title], ["مُحالة إلى", s.referred_to], ["حالة الشكوى بعد الجلسة", s.status]]) +
    "<h2>موضوع الجلسة</h2>" + box(s.topic) + "<h2>نتيجة الجلسة</h2>" + box(s.result);
}

// قرار الإغلاق: نص القرار ثم النتيجة ومكان التوقيع
function closingBlock(c) {
  return "<p>بعد دراسة الشكوى رقم <b>" + esc(c.complaint_number) + "</b> بعنوان «" + esc(c.title || "") + "» المقدّمة من <b>" +
    esc(c.complainant_name || "") + "</b>" + (c.complainant_role ? " (" + esc(c.complainant_role) + ")" : "") + " بحق <b>" +
    esc(c.accused_name || "") + "</b>" + (c.accused_role ? " (" + esc(c.accused_role) + ")" : "") +
    "، تقرّر إغلاق الشكوى بتاريخ <b>" + esc(fmtDay(c.closed_date)) + "</b>.</p>" +
    "<h2>النتيجة النهائية</h2>" + box(c.result) +
    (c.complainant_result ? "<h2>ما أُبلغ به المشتكي</h2>" + box(c.complainant_result) : "") +
    '<table class="sign"><tr><td>رئيس قسم الشكاوى</td><td class="gap"></td><td>الختم</td></tr></table>';
}

// الملف الكامل بالترتيب المعتمد من الإدارة:
//   المشتكي ← المشتكى عليه ← عنوان الاعتراض ← نص الاعتراض ← الجلسات قبل الاعتراض (موضوع ونتيجة كل جلسة)
//   ← نتيجة الشكوى عند إغلاقها ← الاعتراض (إن وُجد) ← الجلسات بعد الاعتراض ← نتيجة الاعتراض
function fullBlock(c, sess, refs) {
  const objAt = c.objection_at ? new Date(c.objection_at).getTime() : null;
  const before = sess.filter(s => objAt === null || new Date(s.session_at).getTime() < objAt);
  const after = objAt === null ? [] : sess.filter(s => new Date(s.session_at).getTime() >= objAt);
  const closedBefore = objAt !== null || isClosed(c.status);             // أُغلقت الشكوى (قبل الاعتراض)؟
  const closedFinal = c.status === "مغلقة بعد الاعتراض";

  // جلسات مفصّلة: عنوان كل جلسة وتاريخها، ثم موضوعها ونتيجتها
  const sessionsHtml = list => list.length ? list.map(s =>
    '<div class="sess"><h3>الجلسة ' + (sess.indexOf(s) + 1) + (s.title ? " — " + esc(s.title) : "") +
    ' <span class="muted">(' + esc(fmt(s.session_at)) + ")</span></h3>" +
    "<p><b>موضوع الجلسة:</b></p>" + box(s.topic) + "<p><b>نتيجة الجلسة:</b></p>" + box(s.result) + "</div>").join("")
    : '<p class="muted">لا توجد جلسات.</p>';

  // البيانات الأساسية
  let html = kv([
    ["رقم الشكوى", c.complaint_number], ["تاريخ الشكوى", fmt(c.received_date)], ["الحالة", c.status],
    ["اسم المشتكي", (c.complainant_name || "") + (c.complainant_role ? " (" + c.complainant_role + ")" : "")],
    ["اسم المشتكى عليه", (c.accused_name || "") + (c.accused_role ? " (" + c.accused_role + ")" : "")],
    ["عنوان الاعتراض", c.title],
  ]);
  html += "<h2>نص الاعتراض</h2>" + box(c.subject);

  // المرحلة الأولى: الجلسات ثم نتيجة الشكوى عند إغلاقها
  html += "<h2>الجلسات" + (objAt !== null ? " قبل الاعتراض" : "") + "</h2>" + sessionsHtml(before);
  html += "<h2>نتيجة الشكوى عند إغلاقها</h2>" + (closedBefore
    ? kv([["تاريخ الإغلاق", objAt !== null ? "" : fmtDay(c.closed_date)]]) + box(objAt !== null ? c.result_before_objection : c.result)
    : '<p class="muted">لم تُغلق الشكوى بعد.</p>');

  // المرحلة الثانية (إن حصل اعتراض): الاعتراض، الجلسات بعده، ونتيجة الاعتراض
  if (objAt !== null) {
    html += "<h2>⚖️ الاعتراض</h2>" + kv([["تاريخ الاعتراض", fmt(c.objection_at)], ["سبب التمديد الاستثنائي", c.objection_extension_reason]]) + box(c.objection_text);
    html += "<h2>الجلسات بعد الاعتراض</h2>" + sessionsHtml(after);
    html += "<h2>نتيجة الاعتراض</h2>" + (closedFinal
      ? kv([["تاريخ الإغلاق النهائي", fmtDay(c.closed_date)]]) + box(c.result)
      : '<p class="muted">الاعتراض قيد المتابعة.</p>');
  }
  return html;
}

// =====================================================================
// أدوات مساعدة
// =====================================================================
// الشعار من موقع المنصة كصورة مضمّنة (إن تعذّر تحميله تُكتب الترويسة بلا شعار)
function logoDataUri() {
  try { return "data:image/png;base64," + Utilities.base64Encode(UrlFetchApp.fetch(CONFIG.LOGO_URL).getBlob().getBytes()); }
  catch (e) { return ""; }
}

// تنسيق التاريخ والوقت بتوقيت المشروع
function fmt(v) {
  return v ? Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm") : "";
}
function fmtDay(v) {
  return v ? Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), "yyyy-MM-dd") : "";
}

// تهريب النص داخل HTML، مع إبقاء الأرقام والتواريخ من اليسار لليمين (حتى لا تنقلب: 1448-00003 و 2026/09/30 10:00)
function esc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/\d[\d\-:\/ ]*\d/g, m => '<span dir="ltr">' + m + "</span>");
}
