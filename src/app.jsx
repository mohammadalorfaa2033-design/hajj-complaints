// =======================================================================
//  الملف: src/app.jsx
//  المشروع: منصة الشكاوى — إدارة الحج والعمرة، قسم الشكاوى
//  الوصف: كود التطبيق كاملاً (React/JSX): الصفحات، المكونات، والاتصال بدوال Supabase.
//  التشغيل: هذا هو المصدر؛ يُحوَّل إلى app.js بالأمر  python build.py  ثم يُرفع الملفان معاً.
//           الصفحة main.html تحمّل app.js الجاهز (لا تحويل داخل الجوال، ففتح الصفحة أسرع).
//  المحتويات: الإعدادات والثوابت، الأدوات المساعدة، التصدير إلى Excel، صفحات المشتكي والنتيجة
//             والاعتراض، لوحة الأدمن وتبويباتها، صفحة التقارير، والتطبيق الرئيسي (الموجّه).
//  ملاحظات:
//    - وصف الصفحات وسجل التعديلات حتى 2026-09-30 في رأس main.html.
//    - قاعدة معتمدة: ملاحظة عربية قبل كل فقرة كود، وتصميم ثابت على الجوال.
//  سجل التعديلات:
//    2026-09-30  نقل الكود من main.html إلى هذا الملف، مع التحويل المسبق إلى app.js (build.py).
//    2026-09-30  صفحة الأدمن: شاشة رئيسية بأزرار كبيرة وأعداد وبحث سريع، وكل قسم يُفتح وحده مع زر «🏠 الرئيسية»
//                (وزر الرجوع في الجوال)؛ صلاحيتان «مدير» و«موظف» (admin_whoami)، وقسم «👥 الموظفون» للمدير.
//    2026-09-30  نموذج الشكوى على ثلاث خطوات مع شريط تقدم: بياناتك ← المشتكى عليه ← شكواك.
//    2026-09-30  سطر «الإحالات» في تفاصيل الشكوى، وورقة «الإحالات» في ملف Excel الكامل (جدول الإحالات الصغير).
//    2026-09-30  تسلسل الشكوى: الحالة والنتيجة للعرض فقط (من آخر جلسة)، حالتا «قيد مراجعة الاعتراض» و«جاري متابعة
//                الاعتراض»، الاعتراض بعد الإغلاق فقط والمعترض يرى العنوان فقط، علامة «⚖️ بعد الاعتراض» على النتيجة،
//                لا جلسات جديدة للمغلقة، «إغلاق عبر جلسة» في مربع «المطلوب»، وأزرار الجلسات والاعتراض بالأخضر.
//    2026-09-30  قسم «📑 القرارات الإدارية»: رقم القرار وتاريخه وعنوانه وموضوعه ورابطه وتصنيفه، بحث متقدم (حقل، تصنيف،
//                فترة، ترتيب)، شرائح التصنيفات بأعدادها، فرز بالعناوين، تفاصيل القرار، وتصدير Excel؛ الإضافة للمدير.
//    2026-09-30  حالة «مغلقة بعد الاعتراض» (جلسة إغلاق بعد الاعتراض)، ونص المشتكي إلزامي في جلسة الإغلاق (ونص المعترض
//                اختياري بعد الاعتراض) ويُحفظ مع الشكوى.
//    2026-09-30  زر «📄 تصدير ملف الشكوى (Word)» في تفاصيل الشكوى: ملف ‎.docx قابل للتعديل بالترويسة والترتيب المعتمد
//                (بديل الأرشفة على Google Drive التي أُلغيت).
// =======================================================================
// استيراد خطافات React المستخدمة في المكونات
const { useState, useEffect, useCallback } = React;

// =====================================================================
// الإعدادات والثوابت
// =====================================================================
// قراءة الإعدادات من config.js والتأكد من أنها ضُبطت
const cfg = window.APP_CONFIG || {};
const isConfigured = !!cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR_") && !!cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
// قائمتا التصنيفات والصفات: تبدآن من config.js، ثم تُستبدل محتوياتهما بما حفظه الأدمن في «الإعدادات»
const CLASSIFICATIONS = [...(cfg.CLASSIFICATIONS || ["أخرى"])];
const ROLES = [...(cfg.ROLES || ["حاج", "مرافق", "رئيس مجموعة", "مشرف", "مندوب", "موظف", "سائق"])];
const DECISION_CLASSES = ["تنظيمي", "إداري", "مالي", "تأديبي", "تعميم", "أخرى"];   // تصنيفات القرارات (تُستبدل من الإعدادات)
const replaceList = (list, items) => { if (Array.isArray(items) && items.length) list.splice(0, list.length, ...items); };

// حالات الشكوى (تطابق القيد في schema.sql) واسم لاتيني لكل حالة لاستخدامه في الألوان
const STATUSES = ["جديد", "قيد المراجعة", "جاري المتابعة", "قيد مراجعة الاعتراض", "جاري متابعة الاعتراض", "مغلقة", "مغلقة بعد الاعتراض"];
const ST_KEY = { "جديد": "new", "قيد المراجعة": "review", "جاري المتابعة": "follow",
                 "قيد مراجعة الاعتراض": "objreview", "جاري متابعة الاعتراض": "objfollow", "مغلقة": "closed", "مغلقة بعد الاعتراض": "closedobj" };
const stClass = s => `st-${ST_KEY[s] || "new"}`;
const CLOSED = "مغلقة";
const CLOSED_OBJ = "مغلقة بعد الاعتراض";                       // الإغلاق النهائي بعد الاعتراض
const isClosed = s => s === CLOSED || s === CLOSED_OBJ;         // هل الحالة مغلقة (قبل الاعتراض أو بعده)؟

// اتصال Supabase بالمفتاح العام فقط (لا توجد حسابات مستخدمين)
const sb = isConfigured
  ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// =====================================================================
// دوال مساعدة
// =====================================================================
// قراءة وكتابة آمنة في التخزين (قد يكون معطّلاً في التصفح الخاص)
function storeGet(storage, key) { try { return storage.getItem(key); } catch { return null; } }
function storeSet(storage, key, value) { try { value == null ? storage.removeItem(key) : storage.setItem(key, value); } catch { /* غير متاح */ } }

// شكاوى المشتكي المحفوظة على جهازه: [{number, code}]
const MY_KEY = "hajj_my_complaints";
function myComplaints() { try { const l = JSON.parse(storeGet(localStorage, MY_KEY) || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } }
function rememberMine(number, code) { storeSet(localStorage, MY_KEY, JSON.stringify([{ number, code }, ...myComplaints().filter(x => x.number !== number)].slice(0, 20))); }

// تنسيق التواريخ للعرض بالعربية مع أرقام لاتينية، وللحقول بالتوقيت المحلي
const fmtDate = v => v ? new Date(v).toLocaleDateString("ar-u-nu-latn", { dateStyle: "medium" }) : "—";
const fmtDateTime = v => v ? new Date(v).toLocaleString("ar-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }) : "—";
const pad = n => String(n).padStart(2, "0");
const toDateInput = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateInputToIso = s => s ? new Date(`${s}T12:00:00`).toISOString() : null;   // منتصف النهار حتى لا يتغير اليوم
const toDateTimeInput = v => { if (!v) return ""; const d = new Date(v); return `${toDateInput(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dateTimeInputToIso = s => s ? new Date(s).toISOString() : null;

// رابط المنصة بدون جزء #
const siteUrl = () => location.href.split("#")[0];

// نسخ نص إلى الحافظة؛ تُرجع true عند النجاح
async function copyText(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

// ---------------------------------------------------------------------
// التصدير إلى Excel (‎.xlsx): مكتبة SheetJS تُحمَّل فقط عند أول تصدير (حجمها كبير، فلا تُبطئ الصفحة)
// ---------------------------------------------------------------------
let xlsxPromise = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxPromise) xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => { xlsxPromise = null; reject(new Error("تعذّر تحميل أداة Excel")); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

// تاريخ ووقت بصيغة قابلة للفرز في Excel: 2026-09-29 14:30
const xlDate = v => { if (!v) return ""; const d = new Date(v); return `${toDateInput(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

// كلمة مرور قفل ملفات Excel: يجلبها AdminPage عند الدخول من الإعدادات (فارغة = قفل بلا كلمة مرور)
const excelLock = { password: "" };

// إنشاء ملف Excel من عدة أوراق [{name, headers, rows}] وتنزيله؛ الأوراق من اليمين إلى اليسار
// كل ورقة مقفولة للعرض فقط: القراءة والتحديد والتصفية وتوسيع الأعمدة مسموحة، والكتابة والحذف ممنوعة
async function saveWorkbook(sheets, filename) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  sheets.forEach(sh => {
    const ws = XLSX.utils.aoa_to_sheet([sh.headers, ...sh.rows.map(r => r.map(v => v ?? ""))]);
    // عرض كل عمود حسب أطول قيمة فيه (بين 10 و60 حرفاً)
    ws["!cols"] = sh.headers.map((h, i) => ({ wch: Math.min(60, Math.max(10, h.length + 2, ...sh.rows.map(r => String(r[i] ?? "").length + 2))) }));
    // أزرار التصفية على صف العناوين، ثم قفل الورقة
    if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!protect"] = { password: excelLock.password || undefined, autoFilter: false, formatColumns: false, formatRows: false };
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

// ---------------------------------------------------------------------
// تصدير ملف الشكوى الكامل إلى Word ‎(.docx) قابل للتعديل — مكتبة docx تُحمَّل عند أول تصدير فقط
// الترتيب المعتمد: الترويسة ← المشتكي ← المشتكى عليه ← عنوان الاعتراض ← نص الاعتراض ← الجلسات قبل
// الاعتراض (موضوع ونتيجة كل جلسة) ← نتيجة الشكوى عند إغلاقها ← الاعتراض ← الجلسات بعده ← نتيجة الاعتراض
// ---------------------------------------------------------------------
let docxPromise = null;
function loadDocx() {
  if (window.docx) return Promise.resolve(window.docx);
  if (!docxPromise) docxPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";
    s.onload = () => resolve(window.docx);
    s.onerror = () => { docxPromise = null; reject(new Error("تعذّر تحميل أداة Word")); };
    document.head.appendChild(s);
  });
  return docxPromise;
}

// بناء مستند Word للشكوى (sess: جلساتها، logo: بيانات صورة الشعار أو null)
function buildComplaintDoc(D, c, sess, logo) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, BorderStyle, ShadingType } = D;
  // ألوان الهوية والخط
  const GREEN = "00594F", GREEN2 = "006E5C", GOLD = "AD9E6E", INK = "333132", MUTED = "939598", SAND = "F5F1EA", FONT = "Arial";

  // نص عربي من اليمين لليسار، والأرقام والتواريخ من اليسار لليمين (حتى لا تنقلب)
  const runs = (text, o = {}) => String(text == null || text === "" ? "—" : text).split(/(\d[\d\-:\/ ]*\d|\d)/).filter(x => x !== "")
    .map(part => new TextRun({ text: part, font: FONT, size: o.size || 24, bold: !!o.bold, color: o.color || INK, rightToLeft: !/^\d/.test(part) }));
  const para = (text, o = {}) => new Paragraph({ bidirectional: true, spacing: { before: o.before || 0, after: o.after == null ? 80 : o.after }, children: runs(text, o) });
  const heading = text => para(text, { bold: true, size: 28, color: GREEN2, before: 280, after: 120 });
  // نص طويل في مربع رملي فاتح (كل سطر فقرة)
  const box = text => String(text || "—").split("\n").map(line => new Paragraph({
    bidirectional: true, spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: SAND, color: "auto" }, children: runs(line || " "),
  }));
  // جدول «عنوان: قيمة» من اليمين لليسار
  const cell = (text, head) => new TableCell({
    width: { size: head ? 30 : 70, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: head ? { type: ShadingType.CLEAR, fill: SAND, color: "auto" } : undefined,
    children: [para(text, { bold: head, color: head ? GREEN : INK, after: 0 })],
  });
  const kv = rows => new Table({
    visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.filter(r => r[1]).map(r => new TableRow({ children: [cell(r[0], true), cell(r[1], false)] })),
  });

  // الجلسات مفصّلة: عنوان كل جلسة وتاريخها، ثم موضوعها ونتيجتها
  const objAt = c.objection_at ? new Date(c.objection_at).getTime() : null;
  const before = sess.filter(s => objAt === null || new Date(s.session_at).getTime() < objAt);
  const after = objAt === null ? [] : sess.filter(s => new Date(s.session_at).getTime() >= objAt);
  const sessionsBlock = list => !list.length ? [para("لا توجد جلسات.", { color: MUTED })] : list.flatMap(s => [
    para(`الجلسة ${sess.indexOf(s) + 1}${s.title ? " — " + s.title : ""} (${xlDate(s.session_at)})`, { bold: true, size: 26, color: GREEN2, before: 160 }),
    para("موضوع الجلسة:", { bold: true, after: 40 }), ...box(s.topic),
    para("نتيجة الجلسة:", { bold: true, before: 80, after: 40 }), ...box(s.result),
  ]);

  // الترويسة: الشعار واسم الإدارة والقسم، ثم خط ذهبي
  const head = [
    new Paragraph({ bidirectional: true, children: [
      ...(logo ? [new ImageRun({ data: logo, transformation: { width: 64, height: 62 } })] : []),
      new TextRun({ text: "  إدارة الحج والعمرة", font: FONT, size: 32, bold: true, color: GREEN, rightToLeft: true }),
      new TextRun({ text: "قسم الشكاوى", font: FONT, size: 24, color: GOLD, rightToLeft: true, break: 1 }),
    ] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: GOLD, space: 4 } }, spacing: { after: 200 }, children: [] }),
    para(`ملف الشكوى ${c.complaint_number}`, { bold: true, size: 34, color: GREEN, after: 160 }),
  ];

  // المحتوى بالترتيب المعتمد
  const closedBefore = objAt !== null || isClosed(c.status);
  const body = [
    kv([
      ["رقم الشكوى", c.complaint_number], ["تاريخ الشكوى", xlDate(c.received_date)], ["الحالة", c.status],
      ["اسم المشتكي", withRole(c.complainant_name, c.complainant_role)],
      ["اسم المشتكى عليه", withRole(c.accused_name, c.accused_role)],
      ["عنوان الاعتراض", c.title],
    ]),
    heading("نص الاعتراض"), ...box(c.subject),
    heading(objAt !== null ? "الجلسات قبل الاعتراض" : "الجلسات"), ...sessionsBlock(before),
    heading("نتيجة الشكوى عند إغلاقها"),
    ...(closedBefore ? box(objAt !== null ? c.result_before_objection : c.result) : [para("لم تُغلق الشكوى بعد.", { color: MUTED })]),
  ];
  if (objAt !== null) body.push(
    heading("⚖️ الاعتراض"), para(`تاريخ الاعتراض: ${xlDate(c.objection_at)}`, { color: MUTED }), ...box(c.objection_text),
    heading("الجلسات بعد الاعتراض"), ...sessionsBlock(after),
    heading("نتيجة الاعتراض"),
    ...(c.status === CLOSED_OBJ ? [para(`تاريخ الإغلاق النهائي: ${xlDate(c.closed_date)}`, { color: MUTED }), ...box(c.result)]
                                : [para("الاعتراض قيد المتابعة.", { color: MUTED })]),
  );
  body.push(para(`أُعدّ من منصة الشكاوى في ${xlDate(new Date())}`, { size: 18, color: MUTED, before: 400 }));

  return new Document({ sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children: [...head, ...body] }] });
}

// التصدير: جلب جلسات الشكوى والشعار، بناء المستند، ثم تنزيله
async function exportComplaintWord(secret, c) {
  const D = await loadDocx();
  const s = await sb.rpc("admin_list_sessions", { p_secret: secret, p_complaint_id: c.id });
  if (s.error) throw new Error(NET_ERR);
  const sess = (s.data || []).slice().sort((a, b) => new Date(a.session_at) - new Date(b.session_at));
  let logo = null;
  try { const r = await fetch("logo.png"); if (r.ok) logo = new Uint8Array(await r.arrayBuffer()); } catch {}
  const blob = await D.Packer.toBlob(buildComplaintDoc(D, c, sess, logo));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ملف-الشكوى-${c.complaint_number}.docx`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

// تصدير كامل للأدمن: الشكاوى والجلسات والإحالات — في ملف واحد
async function exportAllToExcel(secret, complaints) {
  const [s, r] = await Promise.all([
    sb.rpc("admin_list_sessions", { p_secret: secret, p_complaint_id: null }),
    sb.rpc("admin_list_referrals", { p_secret: secret }),
  ]);
  if (s.error) throw new Error(NET_ERR);
  // الجلسات: فقط ما يخص الشكاوى المصدَّرة (الموسم المختار)
  const nums = new Set(complaints.map(c => c.complaint_number));
  const sess = (s.data || []).filter(x => nums.has(x.complaint_number));
  const refs = (r.data || []).filter(x => nums.has(x.complaint_number));   // فارغة إن لم يُنفَّذ القسم 25
  await saveWorkbook([
    { name: "الشكاوى",
      headers: ["الموسم", "رقم الشكوى", "تاريخ الشكوى", "الحالة", "عنوان الاعتراض", "المشتكي", "صفة المشتكي", "رقم الهاتف", "واتس / تلغرام", "المشتكى عليه", "صفة المشتكى عليه",
                "نص الشكوى", "التصنيف", "مُحالة إلى", "نتيجة الشكوى", "النتيجة للمشتكي", "النتيجة للمعترض", "تاريخ الإغلاق", "رمز المتابعة", "تنبيه المتابعة", "المطلوب عند التنبيه",
                "ملخص للمشتكى عليه", "آخر موعد للاعتراض", "سبب التمديد الاستثنائي", "نص الاعتراض", "تاريخ الاعتراض", "آخر تعديل"],
      rows: complaints.map(c => [c.season, c.complaint_number, xlDate(c.received_date), c.status, c.title, c.complainant_name, c.complainant_role, c.phone_number,
                c.contact_number, c.accused_name, c.accused_role, c.subject, c.classification, c.referred_to, c.result, c.complainant_result, c.accused_result,
                xlDate(c.closed_date), c.tracking_code,
                xlDate(c.reminder_at), c.reminder_note, c.objection_summary, xlDate(c.objection_deadline), c.objection_extension_reason, c.objection_text,
                xlDate(c.objection_at), xlDate(c.updated_at)]) },
    { name: "الجلسات",
      headers: ["رقم الشكوى", "المشتكي", "تاريخ ووقت الجلسة", "عنوان الجلسة", "موضوع الجلسة", "مُحالة إلى", "نتيجة الجلسة", "حالة الشكوى"],
      rows: sess.map(x => [x.complaint_number, x.complainant_name, xlDate(x.session_at), x.title, x.topic, x.referred_to, x.result, x.status]) },
    { name: "الإحالات",
      headers: ["رقم الشكوى", "تاريخ الإحالة", "مُحالة إلى"],
      rows: refs.map(x => [x.complaint_number, xlDate(x.referred_at), x.referred_to]) },
  ], `قسم-الشكاوى-${toDateInput(new Date())}.xlsx`);
}

// متابعة الجزء بعد # في الرابط (لاختيار الصفحة)
function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => { setHash(location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

// رسائل موحّدة
const NET_ERR = "تعذّر الاتصال، يرجى المحاولة مرة أخرى.";

// =====================================================================
// مكونات عامة
// =====================================================================
// حقل نموذج موحّد: تسمية + علامة الإلزامي + تلميح اختياري
function Field({ label, required, hint, full, children }) {
  return (
    <label className={`field${full ? " full" : ""}`}>
      <span className="field-label">{label}{required && <b className="req">*</b>}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

// رسالة تنبيه، مؤشر تحميل، وشارة حالة بلونها
const Alert = ({ type, children }) => <div className={`alert ${type}`}>{children}</div>;
const Loading = () => <div className="spinner" aria-label="جارٍ التحميل" />;
const StatusBadge = ({ value }) => <span className={`badge ${stClass(value)}`}>{value}</span>;

// الشعار: الصورة logo.png في مجلد المنصة؛ إن لم توجد يظهر 🕋 مؤقتاً
function Logo({ size }) {
  const [ok, setOk] = useState(true);
  return ok
    ? <img className="logo" src="logo.png" alt="الشعار" width={size} height={size} onError={() => setOk(false)} />
    : <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.55 }}>🕋</span>;
}

// الشريط العلوي: الشعار، اسم الجهة والقسم، اسم الصفحة، وزر خروج اختياري
function Header({ label, onLogout }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#">
          <Logo size={36} />
          <span className="brand-text"><b>إدارة الحج والعمرة</b><small>قسم الشكاوى{label && ` · ${label}`}</small></span>
        </a>
        {onLogout && <button className="btn ghost" onClick={onLogout}>خروج</button>}
      </div>
    </header>
  );
}

// رسالة تظهر عند عدم ضبط بيانات Supabase في config.js
function SetupNotice() {
  return (
    <div className="card">
      <h2>إعداد الاتصال بقاعدة البيانات</h2>
      <p>ضع <code>SUPABASE_URL</code> و<code>SUPABASE_ANON_KEY</code> في الملف <code>config.js</code> ثم أعد تحميل الصفحة.</p>
    </div>
  );
}

// صفحة دخول موحّدة (كلمة مرور المشتكي، الأدمن، الإدارة): verify(value) تُرجع رسالة خطأ أو null
// account: اسم ثابت للحساب (admin / reports) حتى يحفظ المتصفح كلمة المرور لكل صفحة؛ remember: إظهار «تذكّرني»
function GatePage({ title, sub, label, placeholder, numeric, maxLength, secret, initialError, verify, onPass, footer, account, remember }) {
  // المدخل، حالة التحقق، إظهار كلمة المرور المخفية، و«تذكّرني على هذا الجهاز»
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);

  // تنظيف المدخل: الأرقام فقط (مع تحويل ٠-٩) عند طلب ذلك
  function onChange(e) {
    let v = e.target.value;
    if (numeric) v = v.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "");
    setValue(maxLength ? v.slice(0, maxLength) : v);
  }

  // التحقق عبر الدالة الممرَّرة
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!value.trim()) return setError(`يرجى إدخال ${label}.`);
    setBusy(true);
    const err = await verify(value.trim());
    setBusy(false);
    if (err) setError(err); else onPass(value.trim(), remember && keep);
  }

  // العرض: الشعار، العنوان، الخانة (في المنتصف، ومعها زر إظهار للمخفية)، وزر الدخول
  return (
    <div className="narrow">
      <div className="hero">
        <Logo size={72} />
        <div className="hero-org">إدارة الحج والعمرة — قسم الشكاوى</div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <form className="card" onSubmit={submit} noValidate>
        {error && <Alert type="error">{error}</Alert>}
        {/* اسم حساب مخفي بصرياً: يجعل مدير كلمات المرور في المتصفح يعرض الحفظ ويملأ الخانة لاحقاً */}
        {account && <input type="text" name="username" autoComplete="username" value={account} readOnly tabIndex={-1} className="sr-only" aria-hidden="true" />}
        <Field label={label}>
          <div className="pw-wrap">
            <input className={secret ? "secret-input" : "code-input"} type={secret && !show ? "password" : "text"} value={value} onChange={onChange}
              inputMode={numeric ? "numeric" : undefined} autoComplete={secret ? "current-password" : "off"}
              autoCapitalize="off" spellCheck={false} placeholder={placeholder} dir="ltr" />
            {secret && (
              <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)}
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}><EyeIcon closed={show} /></button>
            )}
          </div>
        </Field>
        {remember && (
          <label className="keep-row">
            <input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />
            تذكّرني على هذا الجهاز (لا تفعّله على جهاز مشترك)
          </label>
        )}
        <button className="btn block" style={{ marginTop: 16 }} disabled={busy}>{busy ? "جارٍ التحقق…" : "دخول"}</button>
      </form>
      {footer}
    </div>
  );
}

// أيقونة العين: مفتوحة (إظهار كلمة المرور) أو مشطوبة بخط (إخفاؤها)
function EyeIcon({ closed }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
      {closed && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

// رابط «معرفة نتيجة شكوى سابقة» أسفل صفحات المشتكي
const ResultLink = () => <div className="below-link"><a href="#/result">🔎 معرفة نتيجة شكوى سابقة</a></div>;

// =====================================================================
// الصفحة 1: المشتكي
// =====================================================================
// الصفحة الأولى دائماً خانة كلمة المرور (عامة أو خاصة حسب الإعداد)، وتحتها زر
// «تقديم شكوى مباشرة» إن فعّله الأدمن؛ ثم النموذج، ثم رسالة النجاح
function ComplainantPage() {
  // الإعدادات (النوع + زر المباشر)، كلمة المرور المقبولة ("" = مباشر)، خطأ للعودة، والنتيجة
  const [config, setConfig] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState(null);
  const [gateError, setGateError] = useState("");
  const [done, setDone] = useState(null);

  // جلب إعدادات صفحة المشتكي من قاعدة البيانات
  useEffect(() => {
    sb.rpc("get_access_config").then(({ data, error }) => {
      if (error || !data || !data.length) setLoadError(NET_ERR); else setConfig(data[0]);
    });
  }, []);

  // التحقق من كلمة المرور (عامة أو خاصة) عبر check_access_code
  const isPrivate = config && config.mode === "private";
  async function verify(value) {
    if (isPrivate && value.length !== 4) return "كلمة المرور مكوّنة من 4 أرقام.";
    const { data, error } = await sb.rpc("check_access_code", { p_code: value });
    if (error) return NET_ERR;
    return data === "ok" ? null : isPrivate ? "كلمة المرور غير صحيحة أو سبق استخدامها." : "كلمة المرور غير صحيحة.";
  }

  // اختيار ما يُعرض
  if (loadError) return <div className="narrow"><Alert type="error">{loadError}</Alert></div>;
  if (!config) return <Loading />;
  if (done) return <SuccessMessage number={done.complaint_number} code={done.tracking_code} />;
  if (code !== null) return (
    <ComplaintForm code={code} onDone={r => { rememberMine(r.complaint_number, r.tracking_code); setDone(r); }}
      onRejected={msg => { setCode(null); setGateError(msg); }} />
  );
  return (
    <GatePage key={gateError} title="تقديم شكوى" sub="أدخل كلمة المرور التي وصلتك لتقديم شكواك"
      label="كلمة المرور" placeholder={isPrivate ? "••••" : ""} numeric={isPrivate} maxLength={isPrivate ? 4 : 30}
      initialError={gateError} verify={verify} onPass={v => { setGateError(""); setCode(v); }}
      footer={
        <>
          {config.direct && (
            <div className="card center" style={{ marginTop: 14 }}>
              <p className="muted" style={{ margin: "0 0 10px" }}>ليس لديك كلمة مرور؟</p>
              <button className="btn gold block" onClick={() => { setGateError(""); setCode(""); }}>📝 تقديم شكوى مباشرة</button>
            </div>
          )}
          <ResultLink />
        </>
      } />
  );
}

// نموذج الشكوى على ثلاث خطوات مع شريط تقدم (أسهل لغير المعتادين على النماذج الطويلة):
//   1) بياناتك: الاسم والصفة والهاتف وواتس/تلغرام   2) المشتكى عليه: الاسم والصفة
//   3) شكواك: عنوان الاعتراض ونصّه (مع زر التحدث)   — رقم الشكوى ورمز المتابعة والتاريخ تلقائية
const FORM_STEPS = ["بياناتك", "المشتكى عليه", "شكواك"];

function ComplaintForm({ code, onDone, onRejected }) {
  // بيانات النموذج، الخطوة الحالية (0..2)، وحالة الإرسال
  const [form, setForm] = useState({ name: "", crole: "", phone: "", contact: "", accused: "", arole: "", title: "", subject: "" });
  const [step, setStep] = useState(0);
  // قائمة الصفات من الإعدادات (وإلا قائمة config.js)
  const [roles, setRoles] = useState([...ROLES]);
  useEffect(() => { sb.rpc("get_form_lists").then(({ data }) => { if (data && data.roles && data.roles.length) setRoles(data.roles); }); }, []);
  const [interim, setInterim] = useState("");   // الكلام الجاري التقاطه قبل تثبيته
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const setPhone = key => e => setForm(f => ({ ...f, [key]: cleanPhone(e.target.value) }));

  // التحقق من خطوة: تُرجع رسالة الخطأ أو "" إن كانت مكتملة
  function checkStep(i) {
    if (i === 0) {
      if (!form.name.trim()) return "اكتب اسمك.";
      if (!form.crole.trim()) return "اختر صفتك.";
      if (!form.phone) return "اكتب رقم هاتفك.";
      if (!/^\d{7,15}$/.test(form.phone)) return "رقم الهاتف غير صالح. اكتب الأرقام فقط مع رمز الدولة.";
      if (form.contact && !/^\d{7,15}$/.test(form.contact)) return "رقم واتس / تلغرام غير صالح. اكتب الأرقام فقط مع رمز الدولة.";
    }
    if (i === 1) {
      if (!form.accused.trim()) return "اكتب اسم المشتكى عليه.";
      if (!form.arole.trim()) return "اختر صفة المشتكى عليه.";
    }
    if (i === 2) {
      if (!form.title.trim()) return "اكتب عنواناً قصيراً للاعتراض.";
      if (!form.subject.trim()) return "اكتب نص الاعتراض أو اضغط 🎤 وتحدّث.";
    }
    return "";
  }

  // الانتقال بين الخطوات (التالي يتحقق أولاً)، مع الصعود لأعلى الصفحة
  const toStep = i => { setError(""); setStep(i); window.scrollTo({ top: 0, behavior: "smooth" }); };
  function next() { const err = checkStep(step); if (err) return setError(err); toStep(step + 1); }

  // الإرسال عبر submit_complaint؛ تُرجع رقم الشكوى ورمز المتابعة
  async function submit(e) {
    e.preventDefault();
    if (step < FORM_STEPS.length - 1) return next();   // زر Enter في الخطوات الأولى = التالي
    setError("");
    for (let i = 0; i < FORM_STEPS.length; i++) { const err = checkStep(i); if (err) { setStep(i); return setError(err); } }
    setBusy(true);
    let { data, error: rpcErr } = await sb.rpc("submit_complaint", {
      p_code: code, p_complainant_name: form.name, p_complainant_role: form.crole, p_phone_number: form.phone, p_contact_number: form.contact,
      p_accused_name: form.accused, p_accused_role: form.arole, p_title: form.title, p_subject: form.subject,
    });
    // قاعدة لم يُنفَّذ فيها القسم 23 بعد: النسخة القديمة، والصفة بين قوسين بعد الاسم حتى لا تضيع
    if (rpcErr && /submit_complaint|function/i.test(rpcErr.message || "") && !rpcErr.message.includes("INVALID_CODE"))
      ({ data, error: rpcErr } = await sb.rpc("submit_complaint", {
        p_code: code, p_complainant_name: withRole(form.name.trim(), form.crole.trim()), p_phone_number: form.phone, p_contact_number: form.contact,
        p_accused_name: withRole(form.accused.trim(), form.arole.trim()), p_title: form.title, p_subject: form.subject,
      }));
    setBusy(false);
    if (rpcErr && rpcErr.message.includes("INVALID_CODE"))
      return onRejected(code ? "كلمة المرور لم تعد صالحة. اطلب كلمة مرور جديدة." : "التقديم المباشر غير متاح حالياً. أدخل كلمة المرور.");
    if (rpcErr || !data || !data.length) return setError("تعذّر إرسال الشكوى، يرجى المحاولة مرة أخرى.");
    onDone(data[0]);
  }

  // العرض: شريط الخطوات، حقول الخطوة الحالية، ثم زرّا السابق/التالي (أو الإرسال في الأخيرة)
  return (
    <div className="narrow">
      <div className="page-head">
        <h1>تقديم شكوى</h1>
        <p>نستقبل شكواكم ونتابعها بكل اهتمام وسرية</p>
      </div>
      <ol className="steps">
        {FORM_STEPS.map((t, i) => (
          <li key={t} className={i === step ? "s-now" : i < step ? "s-done" : ""}>
            <span className="step-dot">{i < step ? "✓" : i + 1}</span><span className="step-name">{t}</span>
          </li>
        ))}
      </ol>
      <form className="card" onSubmit={submit} noValidate>
        {error && <Alert type="error">{error}</Alert>}
        <div className="grid" style={{ gridTemplateColumns: "1fr" }}>
          {step === 0 && (
            <>
              <Field label="اسمك" required><input type="text" value={form.name} onChange={set("name")} maxLength={200} autoComplete="name" /></Field>
              <RoleField label="صفتك" roles={roles} value={form.crole} onChange={v => setForm(f => ({ ...f, crole: v }))} />
              <Field label="رقم الهاتف للاتصال" required hint="مع رمز الدولة، مثال: 963912345678">
                <input type="tel" inputMode="tel" dir="ltr" value={form.phone} onChange={setPhone("phone")} maxLength={15} autoComplete="tel" />
              </Field>
              <Field label="رقم واتس / تلغرام" hint="اختياري — إن كان مختلفاً عن رقم الهاتف">
                <input type="tel" inputMode="tel" dir="ltr" value={form.contact} onChange={setPhone("contact")} maxLength={15} />
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="اسم المشتكى عليه" required><input type="text" value={form.accused} onChange={set("accused")} maxLength={200} /></Field>
              <RoleField label="صفة المشتكى عليه" roles={roles} value={form.arole} onChange={v => setForm(f => ({ ...f, arole: v }))} />
            </>
          )}
          {step === 2 && (
            <>
              <Field label="عنوان الاعتراض" required hint="عنوان قصير، مثال: تأخر الحافلة"><input type="text" value={form.title} onChange={set("title")} maxLength={150} /></Field>
              <div className="field">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="field-label">نص الاعتراض<b className="req">*</b></span>
                  <MicButton onText={t => setForm(f => ({ ...f, subject: (f.subject ? f.subject.replace(/\s*$/, " ") : "") + t }))} onError={setError} onInterim={setInterim} />
                </div>
                <textarea value={form.subject} onChange={set("subject")} maxLength={5000} placeholder="اشرح تفاصيل الشكوى: ماذا حدث، ومتى، وأين… أو اضغط 🎤 وتحدّث" style={{ minHeight: 150 }} />
                {interim && <div className="interim">🎙️ {interim}</div>}
              </div>
            </>
          )}
        </div>
        <div className="step-buttons">
          {step > 0 && <button type="button" className="btn secondary" onClick={() => toStep(step - 1)} disabled={busy}>→ السابق</button>}
          {step < FORM_STEPS.length - 1
            ? <button className="btn">التالي ←</button>
            : <button className="btn" disabled={busy}>{busy ? "جارٍ الإرسال…" : "✅ إرسال الشكوى"}</button>}
        </div>
      </form>
      <ResultLink />
    </div>
  );
}

// خانة الصفة: قائمة جاهزة (من الإعدادات) + «أخرى» تفتح خانة لكتابة صفة غير موجودة؛ إلزامية
function RoleField({ label, roles, value, onChange }) {
  // هل اختار «أخرى»؟ (أو صفة مكتوبة ليست في القائمة)
  const [custom, setCustom] = useState(false);
  const isOther = custom || (value !== "" && !roles.includes(value));
  return (
    <Field label={label} required hint="لتمييز الأسماء المتشابهة">
      <select value={isOther ? "__other" : value}
        onChange={e => { const v = e.target.value; if (v === "__other") { setCustom(true); onChange(""); } else { setCustom(false); onChange(v); } }}>
        <option value="">— اختر —</option>
        {roles.map(r => <option key={r} value={r}>{r}</option>)}
        <option value="__other">أخرى (اكتبها)</option>
      </select>
      {isOther && <input type="text" style={{ marginTop: 8 }} value={value} onChange={e => onChange(e.target.value)} maxLength={100} placeholder="اكتب الصفة" autoFocus />}
    </Field>
  );
}

// تنظيف رقم الهاتف أثناء الكتابة: الأرقام العربية ← إنجليزية، أرقام فقط، وحذف 00 من البداية
function cleanPhone(v) {
  return String(v || "").replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\D/g, "").replace(/^00/, "").slice(0, 15);
}

// زر 🎤 تحويل الكلام إلى نص (يظهر فقط في المتصفحات التي تدعمه)؛ يستمر حتى «إيقاف» ويعرض الكلام أثناء النطق
function MicButton({ onText, onError, onInterim }) {
  // هل المتصفح يدعم التعرّف على الكلام؟ وهل التسجيل جارٍ؟
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const [listening, setListening] = useState(false);
  const recRef = React.useRef(null);
  const wantRef = React.useRef(false);      // المستخدم ما زال يريد الاستماع (لإعادة التشغيل التلقائي)
  const failRef = React.useRef(0);          // إعادات تشغيل فاشلة متتالية (حماية من التكرار اللانهائي)

  // إيقاف التسجيل عند مغادرة الصفحة
  useEffect(() => () => { wantRef.current = false; try { recRef.current && recRef.current.abort(); } catch {} }, []);
  if (!Recognition) return null;

  // جلسة استماع واحدة؛ الجوال يُنهيها بعد ثوانٍ من الصمت فنعيد تشغيلها تلقائياً حتى يضغط «إيقاف»
  // (على أندرويد: continuous = false لتجنّب تكرار الجمل المعروف في Chrome)
  function run() {
    const rec = new Recognition();
    rec.lang = "ar-SA";
    rec.continuous = !/Android/i.test(navigator.userAgent);
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = e => {
      failRef.current = 0;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onText(r[0].transcript.trim()); else interim += r[0].transcript;
      }
      onInterim && onInterim(interim);
    };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false; setListening(false);
        onError("اسمح للمتصفح باستخدام الميكروفون لتحويل الكلام إلى نص.");
      } else if (e.error === "network") {
        wantRef.current = false; setListening(false);
        onError("تحويل الكلام إلى نص يحتاج اتصالاً بالإنترنت. يمكنك الكتابة يدوياً.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        failRef.current++;
      }
    };
    rec.onend = () => {
      onInterim && onInterim("");
      if (wantRef.current && failRef.current < 5) setTimeout(() => { if (wantRef.current) run(); }, 200);
      else { wantRef.current = false; setListening(false); }
    };
    recRef.current = rec;
    try { rec.start(); } catch { failRef.current++; }
  }

  // بدء الاستماع وإيقافه
  function start() { wantRef.current = true; failRef.current = 0; setListening(true); onError(""); run(); }
  function stop() { wantRef.current = false; setListening(false); onInterim && onInterim(""); try { recRef.current && recRef.current.stop(); } catch {} }

  // العرض: زر تحدّث / إيقاف
  return (
    <button type="button" className={`btn sm ${listening ? "danger-mic" : "secondary"}`} onClick={listening ? stop : start}>
      {listening ? "⏹ إيقاف التسجيل" : "🎤 تحدّث بدل الكتابة"}
    </button>
  );
}

// رسالة النجاح مع رقم الشكوى ورمز المتابعة (للاطلاع على النتيجة لاحقاً)
function SuccessMessage({ number, code }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="narrow">
      <div className="card done">
        <div className="icon">✅</div>
        <h2>تم تسجيل الشكوى بنجاح</h2>
        <p className="muted" style={{ margin: 0 }}>احتفظ بالرقم والرمز لمعرفة نتيجة شكواك</p>
        <div className="ticket">
          <div><small>رقم الشكوى</small><b>{number}</b></div>
          <div><small>رمز المتابعة</small><b>{code}</b></div>
        </div>
        <p className="muted" style={{ fontSize: 13.5 }}>حُفظت الشكوى على هذا الجهاز، ويمكنك معرفة نتيجتها من صفحة «نتيجة الشكوى».</p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
          <button className="btn secondary" onClick={async () => setCopied(await copyText(`رقم الشكوى: ${number}\nرمز المتابعة: ${code}\n${siteUrl()}#/result`))}>{copied ? "✓ تم النسخ" : "📋 نسخ"}</button>
          <a className="btn" href="#/result">🔎 نتيجة الشكوى</a>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// الصفحة 2: نتيجة الشكوى (‎#/result)
// =====================================================================
// الشكاوى المحفوظة على الجهاز تلقائياً، أو البحث بالرقم + رمز المتابعة
function ResultPage() {
  // نتائج شكاوى الجهاز، ومدخلات البحث ونتيجته
  const [mine, setMine] = useState(null);
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(null);

  // عند الفتح: جلب نتيجة كل شكوى محفوظة على هذا الجهاز
  useEffect(() => {
    const saved = myComplaints();
    if (!saved.length) { setMine([]); return; }
    Promise.all(saved.map(s => sb.rpc("track_complaint", { p_number: s.number, p_code: s.code })))
      .then(res => setMine(res.flatMap(r => r.data || [])));
  }, []);

  // البحث اليدوي عبر track_complaint
  async function search(e) {
    e.preventDefault();
    setError(""); setFound(null);
    if (!number.trim() || !code.trim()) return setError("يرجى إدخال رقم الشكوى ورمز المتابعة.");
    setBusy(true);
    const { data, error: rpcErr } = await sb.rpc("track_complaint", { p_number: number.trim(), p_code: code.trim() });
    setBusy(false);
    if (rpcErr) return setError(NET_ERR);
    if (!data || !data.length) return setError("لم نعثر على شكوى بهذا الرقم والرمز. تأكد منهما.");
    rememberMine(data[0].complaint_number, code.trim());
    setFound(data[0]);
  }

  // العرض: شكاوى الجهاز، ثم نموذج البحث ونتيجته
  return (
    <div className="narrow">
      <div className="page-head">
        <h1>نتيجة الشكوى</h1>
        <p>تظهر هنا تلقائياً الشكاوى المقدّمة من هذا الجهاز</p>
      </div>
      {mine === null ? <Loading /> : mine.map(r => <ResultCard key={r.complaint_number} r={r} />)}
      <form className="card" onSubmit={search} noValidate style={{ marginTop: 14 }}>
        <h2>البحث برقم الشكوى</h2>
        {error && <Alert type="error">{error}</Alert>}
        <div className="grid">
          <Field label="رقم الشكوى" hint="مثال: 1448-00001"><input type="text" dir="ltr" value={number} onChange={e => setNumber(e.target.value)} maxLength={30} /></Field>
          <Field label="رمز المتابعة" hint="6 أرقام"><input type="text" inputMode="numeric" dir="ltr" value={code} onChange={e => setCode(e.target.value)} maxLength={6} /></Field>
        </div>
        <button className="btn block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ البحث…" : "عرض النتيجة"}</button>
      </form>
      {found && <ResultCard r={found} />}
      <div className="below-link"><a href="#">← تقديم شكوى جديدة</a></div>
    </div>
  );
}

// =====================================================================
// صفحة اعتراض المشتكى عليه (‎#/objection)
// =====================================================================
// يُدخل رقم الشكوى ورمز الاعتراض، فيرى الملخص فقط (دون بيانات المشتكي)، ويقدّم اعتراضه مرة واحدة
function ObjectionPage() {
  // مدخلات الدخول، بيانات الشكوى المعروضة، نص الاعتراض، والرسائل
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  const [view, setView] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // جلب ما يراه المشتكى عليه عبر objection_view
  async function lookup(num, cod) {
    const { data, error: rpcErr } = await sb.rpc("objection_view", { p_number: num, p_code: cod });
    if (rpcErr) return NET_ERR;
    if (!data || !data.length) return "رقم الشكوى أو رمز الاعتراض غير صحيح.";
    setView(data[0]);
    return null;
  }

  // الدخول بالرقم والرمز
  async function open(e) {
    e.preventDefault();
    setError("");
    if (!number.trim() || !code.trim()) return setError("يرجى إدخال رقم الشكوى ورمز الاعتراض.");
    setBusy(true);
    const err = await lookup(number.trim(), code.trim());
    setBusy(false);
    if (err) setError(err);
  }

  // تقديم الاعتراض عبر submit_objection (مرة واحدة)
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!text.trim()) return setError("يرجى كتابة اعتراضك.");
    setBusy(true);
    const { data, error: rpcErr } = await sb.rpc("submit_objection", { p_number: number.trim(), p_code: code.trim(), p_text: text });
    setBusy(false);
    if (rpcErr) return setError("تعذّر إرسال الاعتراض، يرجى المحاولة مرة أخرى.");
    if (data === "INVALID") return setError("رقم الشكوى أو رمز الاعتراض لم يعد صالحاً.");
    if (data === "EXPIRED") setError("انتهت مدة الاعتراض. للحالات الاستثنائية تواصل مع قسم الشكاوى.");
    else if (data === "ALREADY") setError("سبق تقديم الاعتراض على هذه الشكوى.");
    else setDone(true);
    await lookup(number.trim(), code.trim());
  }

  // العرض: نموذج الدخول، ثم الملخص ونموذج الاعتراض (أو الاعتراض المقدَّم)
  return (
    <div className="narrow">
      <div className="page-head">
        <h1>⚖️ الاعتراض على شكوى</h1>
        <p>للاطلاع على الشكوى المقدّمة بحقك وتقديم اعتراضك (مرة واحدة)</p>
      </div>
      {!view ? (
        <form className="card" onSubmit={open} noValidate>
          {error && <Alert type="error">{error}</Alert>}
          <div className="grid">
            <Field label="رقم الشكوى" hint="مثال: 1448-00001"><input type="text" dir="ltr" value={number} onChange={e => setNumber(e.target.value)} maxLength={30} /></Field>
            <Field label="رمز الاعتراض" hint="6 أرقام"><input type="text" inputMode="numeric" dir="ltr" value={code} onChange={e => setCode(e.target.value)} maxLength={6} /></Field>
          </div>
          <button className="btn block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ التحقق…" : "عرض الشكوى"}</button>
        </form>
      ) : (
        <>
          <div className="card">
            <div className="c-head">
              <div className="c-no">{view.complaint_number}</div>
              <span className="muted">📅 {fmtDate(view.received_date)}</span>
            </div>
            <div className="field-label">عنوان الشكوى</div>
            <div className="subject">{view.summary}</div>
            {view.result && <><div className="field-label">نتيجة الشكوى</div><div className="subject">{view.result}</div></>}
            {view.deadline && !view.objection_at && (
              <div className={`deadline ${new Date(view.deadline) < new Date() ? "over" : ""}`} style={{ marginBottom: 0 }}>
                ⏳ آخر موعد للاعتراض: <b>{fmtDateTime(view.deadline)}</b>
              </div>
            )}
          </div>
          {done && <Alert type="ok">✅ تم تسجيل اعتراضك بنجاح، وسيراجعه قسم الشكاوى.</Alert>}
          {error && <Alert type="error">{error}</Alert>}
          {view.objection_at ? (
            <div className="card">
              <h2>اعتراضك</h2>
              <div className="muted" style={{ fontSize: 13.5 }}>قُدّم في {fmtDateTime(view.objection_at)} — لا يمكن تعديله.</div>
              <div className="subject" style={{ marginTop: 6, marginBottom: 0 }}>{view.objection_text}</div>
            </div>
          ) : view.deadline && new Date(view.deadline) < new Date() ? (
            <div className="card center">
              <h2 style={{ color: "var(--danger)" }}>انتهت مدة الاعتراض</h2>
              <p className="muted" style={{ margin: 0 }}>لا يُقبل الاعتراض بعد الموعد المحدد إلا في الحالات الاستثنائية. تواصل مع قسم الشكاوى إن كان لديك عذر.</p>
            </div>
          ) : (
            <form className="card" onSubmit={submit} noValidate>
              <Field label="نص الاعتراض" required hint="يُقبل الاعتراض مرة واحدة فقط، فاكتبه كاملاً قبل الإرسال">
                <textarea value={text} onChange={e => setText(e.target.value)} maxLength={5000} style={{ minHeight: 150 }} />
              </Field>
              <button className="btn block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال الاعتراض"}</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

// بطاقة نتيجة شكوى: الرقم، التاريخ، الحالة، النتيجة، وتاريخ الإغلاق
function ResultCard({ r }) {
  return (
    <div className={`card status-card ${stClass(r.status)}`} style={{ marginTop: 14 }}>
      <div className="c-head">
        <div>
          <div className="c-no">{r.complaint_number}</div>
          <div className="meta"><span>📅 {fmtDate(r.received_date)}</span></div>
        </div>
        <StatusBadge value={r.status} />
      </div>
      {r.title && <div className="c-title" style={{ marginTop: 0, marginBottom: 8 }}>📝 {r.title}</div>}
      <div className="field-label">النتيجة</div>
      <div className="subject" style={{ marginBottom: 6 }}>{r.result || "لم تصدر النتيجة بعد، سيتابع قسم الشكاوى شكواك."}</div>
      {r.closed_date && <div className="muted">تاريخ الإغلاق: {fmtDate(r.closed_date)}</div>}
    </div>
  );
}

// =====================================================================
// الصفحة 3: الأدمن (‎#/admin)
// =====================================================================
// ---------------------------------------------------------------------
// التنبيهات الذكية: قواعد تُطبَّق تلقائياً على كل شكوى غير مغلقة (المدد من config.js)
// ---------------------------------------------------------------------
const RULES = { PENDING_HOURS: 24, PENDING_URGENT_HOURS: 72, REFERRED_DAYS: 2, IDLE_DAYS: 3, LATE_DAYS: 7, ...(cfg.ALERT_RULES || {}) };
const HOUR = 36e5, DAY = 864e5;

// مدة مقروءة بالعربية: «ساعتين»، «3 أيام»، «12 يوماً»
function ago(ms) {
  const h = Math.floor(ms / HOUR);
  if (h < 24) return h <= 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const d = Math.floor(ms / DAY);
  return d === 1 ? "يوم" : d === 2 ? "يومين" : d <= 10 ? `${d} أيام` : `${d} يوماً`;
}

// تنبيهات شكوى واحدة كما تكون في وقت مرجعي ref (الآن افتراضياً، أو يوم يختاره الأدمن)
// تُرجع قائمة {level: danger/warn/info/later, text}
function smartAlerts(c, ref = new Date()) {
  // اعتراض المشتكى عليه لم يُراجع بعد (لم تُحفظ الشكوى بعد وصوله) — يظهر حتى لو كانت مغلقة
  const objection = c.objection_at && new Date(c.updated_at || 0) - new Date(c.objection_at) < 5000
    ? [{ level: "warn", text: `⚖️ وصل اعتراض من المشتكى عليه (${fmtDateTime(c.objection_at)}) — افتح الشكوى لمراجعته` }] : [];
  if (isClosed(c.status)) return objection;
  const now = ref.getTime();
  const age = now - new Date(c.received_date);                     // عمر الشكوى
  const idle = now - new Date(c.updated_at || c.received_date);   // منذ آخر تعديل
  const out = [...objection];

  // بداية ونهاية اليوم المرجعي، وهل هو اليوم الحالي (لصياغة النص)
  const sod = new Date(ref); sod.setHours(0, 0, 0, 0);
  const eod = new Date(sod); eod.setDate(eod.getDate() + 1);
  const isToday = sod.getTime() === new Date().setHours(0, 0, 0, 0);

  // التنبيه اليدوي: فات موعده ← أحمر، في اليوم المرجعي ← برتقالي، بعده ← مجدول
  if (c.reminder_at) {
    const at = new Date(c.reminder_at);
    const note = c.reminder_note ? ` — ${c.reminder_note}` : "";
    const time = at.toLocaleTimeString("ar-u-nu-latn", { timeStyle: "short" });
    if (at < sod) out.push({ level: "danger", text: `فات موعد المتابعة (${fmtDateTime(at)})${note}` });
    else if (at < eod) out.push({ level: "warn", text: `${isToday ? "متابعة اليوم" : "متابعة في هذا اليوم"} الساعة ${time}${note}` });
    else out.push({ level: "later", text: `متابعة مجدولة: ${fmtDateTime(at)}${note}` });
  }

  // مضى عليها وقت طويل دون إغلاق
  if (age >= RULES.LATE_DAYS * DAY) out.push({ level: "danger", text: `مضى ${ago(age)} على الشكوى دون إغلاق` });

  // «جديد» لم تُراجع
  if (c.status === "جديد" && age >= RULES.PENDING_HOURS * HOUR)
    out.push({ level: age >= RULES.PENDING_URGENT_HOURS * HOUR ? "danger" : "warn", text: `جديدة ولم تُراجع منذ ${ago(age)}` });

  // مُحالة لجهة ولا تحديث ← متابعة الجهة؛ أو قيد العمل بلا تحديث ← تذكير
  if (c.referred_to && idle >= RULES.REFERRED_DAYS * DAY)
    out.push({ level: "warn", text: `مُحالة إلى «${c.referred_to}» ولا تحديث منذ ${ago(idle)} — تابع مع الجهة` });
  else if (c.status !== "جديد" && idle >= RULES.IDLE_DAYS * DAY)
    out.push({ level: "info", text: `لا تحديث منذ ${ago(idle)}` });

  return out;
}

// التنبيهات المطلوبة في وقت مرجعي (كل شيء عدا المجدول لما بعده)
const dueAlerts = (c, ref) => smartAlerts(c, ref).filter(a => a.level !== "later");

// أولوية الشكوى للترتيب: أحمر ← برتقالي ← أزرق ← مجدول
const alertWeight = alerts =>
  alerts.some(a => a.level === "danger") ? 0 : alerts.some(a => a.level === "warn") ? 1 : alerts.some(a => a.level === "info") ? 2 : 3;

// أقسام صفحة الأدمن: المفتاح، العنوان، وهل هي للمدير فقط
const SECTIONS = {
  today:      { title: "📅 المطلوب" },
  complaints: { title: "📋 الشكاوى" },
  sessions:   { title: "🗓️ الجلسات" },
  links:      { title: "🔗 إرسال رابط" },
  decisions:  { title: "📑 القرارات الإدارية" },
  access:     { title: "🔐 دخول المشتكين", manager: true },
  viewers:    { title: "📊 كلمات مرور الإدارة", manager: true },
  staff:      { title: "👥 الموظفون", manager: true },
  settings:   { title: "⚙️ الإعدادات", manager: true },
};

// صفحة الأدمن: شاشة رئيسية بأزرار كبيرة، وكل قسم يُفتح وحده مع زر «🏠 الرئيسية» للعودة
// (زر الرجوع في الجوال يعود أيضاً إلى الرئيسية). الموظف يرى الأقسام الأساسية فقط، والمدير يرى الكل
function AdminPage({ secret }) {
  // القسم الحالي (home = الشاشة الرئيسية)، الشكاوى (تُجلب مرة واحدة لكل الأقسام)، الشكوى المفتوحة،
  // ورقم نسخة الجلسات (يزيد عند إضافة/تعديل جلسة فيُعاد جلب قسم الجلسات)
  const [tab, setTab] = useState("home");
  const [start, setStart] = useState({});      // بداية القسم: بحث أو تصفية مختارة من الرئيسية
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [openFromDue, setOpenFromDue] = useState(false);   // فُتحت من «المطلوب» ← طلب تحديد التنبيه القادم
  const [sessVer, setSessVer] = useState(0);

  // من الداخل؟ مدير أو موظف (قاعدة لم يُنفَّذ فيها القسم 24 ← مدير كما كان)
  const [me, setMe] = useState(null);
  useEffect(() => {
    sb.rpc("admin_whoami", { p_secret: secret }).then(({ data, error }) => setMe(error || !data ? { role: "مدير", name: "" } : data));
  }, [secret]);
  const isManager = !me || me.role === "مدير";

  // فتح قسم (مع حفظ خطوة في سجل المتصفح ليعود زر الرجوع إلى الرئيسية)، والعودة للرئيسية
  const go = (key, opts = {}) => { setStart(opts); setTab(key); try { history.pushState({ adminTab: key }, "", location.hash); } catch {} };
  const goHome = () => { if (history.state && history.state.adminTab) history.back(); else setTab("home"); };
  useEffect(() => {
    const onPop = () => setTab("home");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // فتح شكوى: إن كانت «جديد» تتحول تلقائياً إلى «قيد المراجعة» (admin_open_complaint) قبل عرضها
  const openComplaint = async (c, fromDue = false) => {
    const row = (rows || []).find(r => r.id === c.id) || c;
    if (row.status === "جديد") {
      const { data } = await sb.rpc("admin_open_complaint", { p_secret: secret, p_id: c.id });
      if (data && data.length) onSaved(data[0]);
    }
    setOpenFromDue(fromDue); setOpenId(c.id);
  };

  // قائمتا التصنيفات والصفات من الإعدادات (تحلّان محل قائمتي config.js)
  const [, setListsVer] = useState(0);
  useEffect(() => {
    sb.rpc("admin_get_lists", { p_secret: secret }).then(({ data }) => {
      if (!data) return;
      replaceList(CLASSIFICATIONS, data.classifications); replaceList(ROLES, data.roles);
      replaceList(DECISION_CLASSES, data.decision_classes); setListsVer(n => n + 1);
    });
  }, [secret]);

  // كلمة مرور قفل ملفات Excel (من الإعدادات) لتُستخدم في كل تصدير
  useEffect(() => {
    sb.rpc("admin_get_excel_lock", { p_secret: secret }).then(({ data }) => { excelLock.password = data || ""; });
  }, [secret]);

  // جلب كل الشكاوى
  const load = useCallback(async () => {
    setError("");
    const { data, error } = await sb.rpc("admin_list_complaints", { p_secret: secret });
    if (error) return setError(NET_ERR);
    setRows(data || []);
  }, [secret]);
  useEffect(() => { load(); }, [load]);

  // تحديث شكوى أو أكثر في القائمة بعد حفظها، وإعادة الجلب
  const onSaved = updated => {
    const list = Array.isArray(updated) ? updated : [updated];
    setRows(rs => rs.map(r => list.find(u => u.id === r.id) || r));
  };
  const reload = () => { setRows(null); load(); };
  const opened = (rows || []).find(r => r.id === openId);

  // القسم المطلوب غير مسموح لهذا الدور ← الرئيسية
  const section = SECTIONS[tab];
  const allowed = tab === "home" || (section && (isManager || !section.manager));

  // العرض: الرئيسية أو القسم المفتوح (مع شريط العودة)، ونافذة التفاصيل عند فتح شكوى
  if (!me) return <Loading />;
  return (
    <div>
      {error && <Alert type="error">{error}</Alert>}
      {!allowed || tab === "home" ? (
        <AdminHome me={me} isManager={isManager} rows={rows} go={go} />
      ) : (
        <>
          <div className="section-bar">
            <button type="button" className="btn secondary" onClick={goHome}>🏠 الرئيسية</button>
            <h2>{section.title}</h2>
          </div>
          {tab === "today" && <AdminDue secret={secret} rows={rows} onSaved={onSaved} reload={reload} onOpen={c => openComplaint(c, true)} />}
          {tab === "links" && <AdminLinks secret={secret} isManager={isManager} />}
          {tab === "decisions" && <AdminDecisions secret={secret} isManager={isManager} />}
          {tab === "complaints" && <AdminComplaints secret={secret} rows={rows} onSaved={onSaved} reload={reload} onOpen={c => openComplaint(c)}
                                     initialSearch={start.search || ""} initialFilter={start.filter || "الكل"} />}
          {tab === "sessions" && <AdminSessions secret={secret} version={sessVer} onOpen={c => openComplaint(c)} />}
          {tab === "access" && <AdminAccess secret={secret} />}
          {tab === "viewers" && <AdminViewers secret={secret} />}
          {tab === "staff" && <AdminStaff secret={secret} />}
          {tab === "settings" && <AdminSettings secret={secret} rows={rows} reload={reload} />}
        </>
      )}
      {opened && (
        <div className="modal-back" onClick={() => setOpenId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-close"><button className="btn secondary sm" onClick={() => setOpenId(null)}>✕ إغلاق</button></div>
            <ComplaintCard key={opened.id} secret={secret} complaint={opened} onSaved={onSaved} onSessionsChanged={() => setSessVer(n => n + 1)} fromDue={openFromDue} />
          </div>
        </div>
      )}
    </div>
  );
}

// الشاشة الرئيسية للأدمن: ترحيب، بحث سريع، وأزرار كبيرة بأعداد واضحة؛ أزرار المدير في قسم منفصل
function AdminHome({ me, isManager, rows, go }) {
  // نص البحث السريع
  const [q, setQ] = useState("");

  // الأعداد: المطلوب اليوم، الجديدة، والمفتوحة (كل ما لم يُغلق)
  const list = rows || [];
  const due = list.filter(c => dueAlerts(c).length > 0).length;
  const fresh = list.filter(c => c.status === "جديد").length;
  const open = list.filter(c => !isClosed(c.status)).length;

  // زر كبير: أيقونة، عنوان، وعدد (اختياري) بلون
  const Tile = ({ icon, title, count, tone, onClick, sub }) => (
    <button type="button" className={`tile ${tone || ""}`} onClick={onClick}>
      <span className="tile-icon">{icon}</span>
      <span className="tile-title">{title}</span>
      {count != null && <span className="tile-count">{rows ? count : "…"}</span>}
      {sub && <span className="tile-sub">{sub}</span>}
    </button>
  );

  // العرض: الترحيب، البحث، الأزرار الأساسية، ثم أزرار المدير
  return (
    <div>
      <div className="home-hello">أهلاً{me.name ? ` ${me.name}` : ""} 👋 <span className="muted">· {isManager ? "مدير" : "موظف"}</span></div>
      <form className="row home-search" style={{ flexWrap: "nowrap" }} onSubmit={e => { e.preventDefault(); go("complaints", { search: q.trim() }); }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ابحث برقم الشكوى أو الاسم أو الهاتف" />
        <button className="btn">بحث</button>
      </form>
      <div className="home-tiles">
        <Tile icon="📅" title="المطلوب اليوم" count={due} tone={due > 0 ? "hot" : "ok"} onClick={() => go("today")} sub={due > 0 ? "اضغط للمتابعة" : "لا شيء متأخر"} />
        <Tile icon="🆕" title="شكاوى جديدة" count={fresh} tone={fresh > 0 ? "warm" : ""} onClick={() => go("complaints", { filter: "جديد" })} />
        <Tile icon="📋" title="كل الشكاوى" count={open} sub="مفتوحة" onClick={() => go("complaints")} />
        <Tile icon="🗓️" title="الجلسات" onClick={() => go("sessions")} />
        <Tile icon="🔗" title="إرسال رابط" sub="لمشتكٍ أو للإدارة" onClick={() => go("links")} />
        <Tile icon="📑" title="القرارات الإدارية" sub="بحث وروابط" onClick={() => go("decisions")} />
      </div>
      {isManager && (
        <>
          <div className="home-label">للمدير</div>
          <div className="home-tiles small">
            <Tile icon="🔐" title="دخول المشتكين" onClick={() => go("access")} />
            <Tile icon="📊" title="كلمات مرور الإدارة" onClick={() => go("viewers")} />
            <Tile icon="👥" title="الموظفون" onClick={() => go("staff")} />
            <Tile icon="⚙️" title="الإعدادات" onClick={() => go("settings")} />
          </div>
        </>
      )}
    </div>
  );
}

// قسم الموظفين (للمدير): إضافة موظف بكلمة مرور خاصة، نسخ رسالته، وإيقافه أو تفعيله
function AdminStaff({ secret }) {
  // اسم الموظف الجديد، الكلمة المولّدة الأخيرة، القائمة، والرسائل
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب الموظفين
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("admin_list_staff", { p_secret: secret });
    if (error) { setList([]); return setMsg({ type: "error", text: "تعذّر الجلب (نفّذ القسم 24 من schema.sql في Supabase)." }); }
    setList(data || []);
  }, [secret]);
  useEffect(() => { load(); }, [load]);

  // إضافة موظف وتوليد كلمة مروره
  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return setMsg({ type: "error", text: "يرجى كتابة اسم الموظف." });
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_create_staff", { p_secret: secret, p_name: name });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر الإضافة، يرجى المحاولة مرة أخرى." });
    setCreated(data[0]); setName(""); load();
  }

  // إيقاف موظف أو إعادة تفعيله
  async function toggle(r) {
    const { data } = await sb.rpc("admin_set_staff_active", { p_secret: secret, p_id: r.id, p_active: !r.active });
    if (data) load();
  }

  // رسالة الموظف: الرابط وكلمة مروره
  const text = r => `رابط لوحة قسم الشكاوى — إدارة الحج والعمرة:\n${siteUrl()}#/admin\nكلمة المرور الخاصة بك: ${r.code}`;

  // العرض: شرح الصلاحية، نموذج الإضافة، الكلمة الجديدة وزر النسخ، ثم القائمة
  return (
    <div>
      <form className="card" onSubmit={create}>
        <h2>إضافة موظف</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>الموظف يرى: المطلوب، الشكاوى، الجلسات، وإرسال رابط للمشتكي. لا يرى الإعدادات ولا كلمات المرور.</p>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}
        <Field label="اسم الموظف"><input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={200} /></Field>
        <button className="btn gold block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ الإضافة…" : "👥 إضافة وتوليد كلمة مرور"}</button>
        {created && (
          <div style={{ marginTop: 16 }}>
            <div className="muted center">كلمة مرور {created.name}</div>
            <div className="big-code">{created.code}</div>
            <button type="button" className="btn secondary block" onClick={async () => setMsg(await copyText(text(created)) ? { type: "ok", text: "تم نسخ الرسالة." } : { type: "error", text: "تعذّر النسخ." })}>📋 نسخ الرسالة</button>
          </div>
        )}
      </form>
      <div className="card">
        <h2>الموظفون</h2>
        {list === null ? <Loading /> : list.length === 0 ? <p className="muted">لم تُضف أي موظف بعد.</p> : (
          <ul className="list">
            {list.map(r => (
              <li key={r.id}>
                <div>
                  <b>{r.name}</b> · <span className="mono">{r.code}</span>
                  <div className="muted" style={{ fontSize: 13 }}>آخر دخول: {fmtDateTime(r.last_seen_at)}</div>
                </div>
                <button className={`btn sm ${r.active ? "secondary" : ""}`} onClick={() => toggle(r)}>{r.active ? "إيقاف" : "تفعيل"}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// جدول الشكاوى (مثل Excel): فرز بالعناوين، عدد الأسطر، إظهار/إخفاء الأعمدة، حجم الخط،
// اختيار عدة صفوف وتغييرها معاً، وفتح صف للتعديل الفردي
// ---------------------------------------------------------------------
// الاسم مع الصفة: نص «الاسم (الصفة)» للتصدير، واسم وتحته الصفة بخط صغير للعرض
const withRole = (name, role) => name ? (role ? `${name} (${role})` : name) : "";
function NameRole({ name, role }) {
  return <span>{name}{role && <small className="role-tag">{role}</small>}</span>;
}

// تعريف الأعمدة: المفتاح، العنوان، قيمة الفرز، النص (للتصدير)، والعرض داخل الخلية
const muted = v => v || <span className="muted">—</span>;
const COLUMNS = [
  { key: "number", label: "رقم الشكوى", sort: c => c.complaint_number, text: c => c.complaint_number, cell: c => <b dir="ltr">{c.complaint_number}</b> },
  { key: "date", label: "التاريخ", sort: c => new Date(c.received_date).getTime(), text: c => xlDate(c.received_date), cell: c => fmtDate(c.received_date) },
  { key: "title", label: "العنوان", sort: c => c.title, text: c => c.title, cell: c => c.title ? <b>{c.title}</b> : muted() },
  { key: "name", label: "المشتكي", sort: c => c.complainant_name, text: c => withRole(c.complainant_name, c.complainant_role), cell: c => <NameRole name={c.complainant_name} role={c.complainant_role} /> },
  { key: "phone", label: "رقم الهاتف", sort: c => c.phone_number, text: c => c.phone_number, cell: c => <span dir="ltr">{c.phone_number || "—"}</span> },
  { key: "contact", label: "واتس / تلغرام", sort: c => c.contact_number, text: c => c.contact_number, cell: c => <span dir="ltr">{c.contact_number || "—"}</span> },
  { key: "accused", label: "المشتكى عليه", sort: c => c.accused_name, text: c => withRole(c.accused_name, c.accused_role), cell: c => c.accused_name ? <NameRole name={c.accused_name} role={c.accused_role} /> : muted() },
  { key: "subject", label: "الموضوع", sort: c => c.subject, text: c => c.subject, wrap: true, cell: c => <span className="clip">{c.subject}</span> },
  { key: "class", label: "التصنيف", sort: c => c.classification, text: c => c.classification, cell: c => muted(c.classification) },
  { key: "referred", label: "مُحالة إلى", sort: c => c.referred_to, text: c => c.referred_to, cell: c => muted(c.referred_to) },
  { key: "status", label: "الحالة", sort: c => STATUSES.indexOf(c.status), text: c => c.status, cell: c => <StatusBadge value={c.status} /> },
  { key: "result", label: "نتيجة الشكوى", sort: c => c.result, text: c => c.result, wrap: true, cell: c => c.result ? <span className="clip">{c.result}</span> : muted() },
  { key: "cresult", label: "نتيجة المشتكي", sort: c => c.complainant_result, text: c => c.complainant_result, wrap: true, cell: c => c.complainant_result ? <span className="clip">{c.complainant_result}</span> : muted() },
  { key: "aresult", label: "نتيجة المعترض", sort: c => c.accused_result, text: c => c.accused_result, wrap: true, cell: c => c.accused_result ? <span className="clip">{c.accused_result}</span> : muted() },
  { key: "closed", label: "تاريخ الإغلاق", sort: c => c.closed_date ? new Date(c.closed_date).getTime() : null, text: c => xlDate(c.closed_date), cell: c => c.closed_date ? fmtDate(c.closed_date) : muted() },
  { key: "tracking", label: "رمز المتابعة", sort: c => c.tracking_code, text: c => c.tracking_code, cell: c => <span dir="ltr">{c.tracking_code || "—"}</span> },
  { key: "objection", label: "الاعتراض", sort: c => c.objection_at ? new Date(c.objection_at).getTime() : null, text: c => c.objection_text || "",
    cell: c => c.objection_at ? <span className="badge st-review">⚖️ {fmtDate(c.objection_at)}</span> : c.objection_code ? <span className="muted">بانتظار الاعتراض</span> : muted() },
];
// الأعمدة المخفية افتراضياً (يمكن إظهارها من قائمة الأعمدة)
const DEFAULT_HIDDEN = ["result", "cresult", "aresult", "tracking", "objection"];

// تفضيلات الجدول المحفوظة على الجهاز: الأعمدة المخفية، حجم الخط، عدد الأسطر
function usePref(key, initial) {
  const [value, setValue] = useState(() => { try { const v = JSON.parse(storeGet(localStorage, key)); return v ?? initial; } catch { return initial; } });
  const save = v => { setValue(v); storeSet(localStorage, key, JSON.stringify(v)); };
  return [value, save];
}

function ComplaintsTable({ secret, rows, onSaved, onOpen, alertsFor }) {
  // التفضيلات: الأعمدة المخفية، حجم الخط، عدد الأسطر
  const [hidden, setHidden] = usePref("hajj_cols_hidden", DEFAULT_HIDDEN);
  const [fontSize, setFontSize] = usePref("hajj_font_size", 14);
  const [pageSize, setPageSize] = usePref("hajj_page_size", 50);

  // الفرز (العمود والاتجاه)، الصفحة الحالية، قائمة الأعمدة، الاختيار، والتغيير الجماعي
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(0);
  const [colsOpen, setColsOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState({ status: "", classification: "", referred_to: "", closed: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // الأعمدة الظاهرة
  const cols = COLUMNS.filter(c => !hidden.includes(c.key));

  // الفرز: القيم الفارغة دائماً في الأسفل؛ النصوص بالترتيب العربي
  const sorted = (() => {
    const col = COLUMNS.find(c => c.key === sort.key);
    if (!col) return rows;
    return [...rows].sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      if (x == null || x === "") return 1;
      if (y == null || y === "") return -1;
      const r = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ar");
      return r * sort.dir;
    });
  })();

  // التقسيم إلى صفحات؛ العودة لآخر صفحة موجودة إن قلّت الصفوف
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const pageRows = sorted.slice(cur * pageSize, (cur + 1) * pageSize);

  // الضغط على عنوان: فرز تصاعدي، ثم تنازلي، ثم بلا فرز
  function onSort(key) {
    setSort(s => s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : { key: null, dir: 1 });
    setPage(0);
  }
  const arrow = key => sort.key !== key ? <span className="sort-arrow off">⇅</span> : <span className="sort-arrow">{sort.dir === 1 ? "▲" : "▼"}</span>;

  // الاختيار: صف واحد، أو كل صفوف الصفحة الحالية
  const pageIds = pageRows.map(r => r.id);
  const chosen = rows.filter(r => selected.has(r.id)).map(r => r.id);
  const pageAllOn = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePage = () => setSelected(s => { const n = new Set(s); pageIds.forEach(id => pageAllOn ? n.delete(id) : n.add(id)); return n; });

  // إظهار/إخفاء عمود
  const toggleCol = key => setHidden(hidden.includes(key) ? hidden.filter(k => k !== key) : [...hidden, key]);

  // تطبيق التغيير الجماعي عبر admin_bulk_update (الحقل الفارغ يبقى كما هو)
  async function applyBulk() {
    if (!bulk.status && !bulk.classification && !bulk.referred_to.trim() && !bulk.closed)
      return setMsg({ type: "error", text: "اختر تغييراً واحداً على الأقل." });
    setBusy(true); setMsg(null);
    const status = bulk.closed ? CLOSED : (bulk.status || null);
    const { data, error } = await sb.rpc("admin_bulk_update", {
      p_secret: secret, p_ids: chosen, p_status: status,
      p_classification: bulk.classification || null, p_referred_to: bulk.referred_to.trim() || null,
      p_closed_date: status === CLOSED ? dateInputToIso(bulk.closed || toDateInput(new Date())) : null,
    });
    setBusy(false);
    if (error || !data) return setMsg({ type: "error", text: "تعذّر التطبيق، يرجى المحاولة مرة أخرى." });
    onSaved(data);
    setMsg({ type: "ok", text: `تم تطبيق التغيير على ${data.length} شكوى.` });
    setSelected(new Set());
    setBulk({ status: "", classification: "", referred_to: "", closed: "" });
  }

  // تصدير كل الصفوف الظاهرة (بالترتيب الحالي والأعمدة الظاهرة) إلى ملف Excel ‎.xlsx
  async function exportExcel() {
    setMsg(null);
    try {
      await saveWorkbook([{ name: "الشكاوى", headers: cols.map(c => c.label), rows: sorted.map(r => cols.map(c => c.text(r))) }],
        `الشكاوى-${toDateInput(new Date())}.xlsx`);
    } catch (e) { setMsg({ type: "error", text: e.message || NET_ERR }); }
  }

  // العرض: شريط التغيير الجماعي (عند الاختيار)، شريط الأدوات، الجدول، ثم التنقل بين الصفحات
  return (
    <div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {chosen.length > 0 && (
        <div className="bulk-bar">
          <b>✔ {chosen.length} محددة — تغيير إلى:</b>
          <select value={bulk.classification} onChange={e => setBulk(b => ({ ...b, classification: e.target.value }))}>
            <option value="">التصنيف (بلا تغيير)</option>
            {CLASSIFICATIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <input type="text" placeholder="ترحيل / مُحالة إلى" value={bulk.referred_to} onChange={e => setBulk(b => ({ ...b, referred_to: e.target.value }))} />
          <button className="btn gold" disabled={busy} onClick={applyBulk}>{busy ? "جارٍ التطبيق…" : `تطبيق على ${chosen.length}`}</button>
          <button className="btn secondary" onClick={() => setSelected(new Set())}>إلغاء التحديد</button>
        </div>
      )}

      <div className="table-tools">
        <label className="tool">عدد الأسطر
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}>
            {[10, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <div className="tool cols-menu">
          <button className="btn secondary sm" onClick={() => setColsOpen(o => !o)} aria-expanded={colsOpen}>⚙ الأعمدة ({cols.length}/{COLUMNS.length})</button>
          {colsOpen && (
            <>
              <div className="menu-back" onClick={() => setColsOpen(false)} />
              <div className="menu">
                {COLUMNS.map(c => (
                  <label key={c.key}><input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}</label>
                ))}
                <button className="btn secondary sm block" style={{ marginTop: 6 }} onClick={() => setHidden(DEFAULT_HIDDEN)}>الافتراضي</button>
              </div>
            </>
          )}
        </div>
        <div className="tool font-tools" title="حجم الخط">
          <button className="btn secondary sm" onClick={() => setFontSize(Math.max(11, fontSize - 1))} aria-label="تصغير الخط">A−</button>
          <button className="btn secondary sm" onClick={() => setFontSize(14)} aria-label="الحجم الافتراضي">{fontSize}</button>
          <button className="btn secondary sm" onClick={() => setFontSize(Math.min(22, fontSize + 1))} aria-label="تكبير الخط">A+</button>
        </div>
        {rows.length > 0 && <button className="btn secondary sm tool-end" onClick={exportExcel}>⬇ تصدير Excel</button>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows.length === 0 ? <div className="empty">لا توجد شكاوى</div> : (
          <div className="table-wrap">
            <table className="sheet" style={{ fontSize }}>
              <thead>
                <tr>
                  <th className="chk"><input type="checkbox" checked={pageAllOn} onChange={togglePage} title="تحديد كل صفوف الصفحة" /></th>
                  {alertsFor && <th>التنبيه</th>}
                  {cols.map(c => <th key={c.key} className="sortable" onClick={() => onSort(c.key)}>{c.label} {arrow(c.key)}</th>)}
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => (
                  <tr key={r.id} className={`status-row ${stClass(r.status)} ${selected.has(r.id) ? "selected" : ""}`} onClick={() => onOpen(r)}>
                    <td className="chk" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                    {alertsFor && <td className="wrap">{alertsFor(r).map((a, i) => <span key={i} className={`alert-tag ${a.level}`}>{a.text}</span>)}</td>}
                    {cols.map(c => <td key={c.key} className={c.wrap ? "wrap" : ""}>{c.cell(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="pager">
          <span className="muted">عرض {cur * pageSize + 1}–{Math.min((cur + 1) * pageSize, sorted.length)} من {sorted.length}</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn secondary sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}>→ السابق</button>
            <span className="muted">صفحة {cur + 1} من {pages}</span>
            <button className="btn secondary sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>التالي ←</button>
          </div>
        </div>
      )}
    </div>
  );
}

// تبويب «المطلوب»: اختيار الفترة (اليوم / الكل / تاريخ محدد) ثم جدول المطلوب فيها، الأهم أولاً
function AdminDue({ secret, rows, onSaved, reload, onOpen }) {
  // الفترة المختارة: today / all / date، والتاريخ المحدد (افتراضياً الغد)
  const [mode, setMode] = useState("today");
  const [day, setDay] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateInput(d); });

  // الوقت المرجعي: الآن لليوم والكل؛ وللتاريخ المحدد نهاية ذلك اليوم (أو الآن إن كان هو اليوم)
  const todayStr = toDateInput(new Date());
  const ref = mode === "date" && day && day !== todayStr ? new Date(`${day}T23:59:00`) : new Date();

  // التنبيهات لكل شكوى حسب الفترة: «الكل» يشمل المتابعات المجدولة لاحقاً
  const alertsFor = c => mode === "all" ? smartAlerts(c, ref) : dueAlerts(c, ref);

  // الشكاوى المطلوبة مرتّبة: الأحمر ثم البرتقالي ثم الأزرق ثم المجدول، وداخل كل لون الأقدم أولاً
  const due = (rows || [])
    .map(c => ({ c, alerts: alertsFor(c) }))
    .filter(x => x.alerts.length > 0)
    .sort((a, b) => alertWeight(a.alerts) - alertWeight(b.alerts) || new Date(a.c.received_date) - new Date(b.c.received_date));
  const counts = [0, 0, 0, 0];
  due.forEach(x => counts[alertWeight(x.alerts)]++);

  // عنوان الفترة المختارة
  const fmtDay = d => d.toLocaleDateString("ar-u-nu-latn", { weekday: "long", day: "numeric", month: "long" });
  const title = mode === "all" ? "كل المطلوب" : mode === "date" && day ? `المطلوب يوم ${fmtDay(new Date(`${day}T12:00:00`))}` : `مطلوب اليوم · ${fmtDay(new Date())}`;

  // العرض: أزرار الفترة، العنوان والملخص، ثم الجدول
  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div className="row">
          <div className="chips" style={{ margin: 0 }}>
            <button className={mode === "today" ? "active" : ""} onClick={() => setMode("today")}>اليوم</button>
            <button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>الكل</button>
            <button className={mode === "date" ? "active" : ""} onClick={() => setMode("date")}>تاريخ محدد</button>
          </div>
          {mode === "date" && <input type="date" className="grow" value={day} onChange={e => setDay(e.target.value)} style={{ maxWidth: 200 }} />}
          <button className="btn secondary sm" onClick={reload} style={{ marginInlineStart: "auto" }}>🔄 تحديث</button>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}><b style={{ fontSize: 18 }}>{title}</b></div>
      {due.length > 0 && (
        <div className="row" style={{ marginBottom: 12, gap: 8 }}>
          {counts[0] > 0 && <span className="alert-chip danger">🔴 عاجل: {counts[0]}</span>}
          {counts[1] > 0 && <span className="alert-chip warn">🟠 متابعة: {counts[1]}</span>}
          {counts[2] > 0 && <span className="alert-chip info">🔵 تذكير: {counts[2]}</span>}
          {counts[3] > 0 && <span className="alert-chip later">🗓️ مجدولة: {counts[3]}</span>}
        </div>
      )}
      {rows === null ? <Loading /> : due.length === 0 ? (
        <div className="card empty">✅ لا توجد أمور مطلوبة {mode === "all" ? "حالياً" : mode === "date" ? "في هذا اليوم" : "اليوم"} — كل الشكاوى في وضع جيد.</div>
      ) : <ComplaintsTable secret={secret} rows={due.map(x => x.c)} onSaved={onSaved} onOpen={onOpen} alertsFor={alertsFor} />}
    </div>
  );
}

// تبويب الإعدادات: تصفير المنصة (حذف كل الشكاوى والجلسات والسجل وكلمات مرور المشتكين، وإعادة الترقيم)
// محمي بثلاثة أقفال: كلمة مرور الأدمن + رمز التصفير الخاص (يُعيَّن من SQL Editor) + كتابة كلمة «تصفير»
function AdminSettings({ secret, rows, reload }) {
  // رمز التصفير وإظهاره، كلمة التأكيد، وحالة التنفيذ والرسائل
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // نسخة احتياطية قبل التصفير: نفس التصدير الكامل إلى Excel
  async function backup() {
    setBusy(true); setMsg(null);
    try { await exportAllToExcel(secret, rows || []); }
    catch (e) { setMsg({ type: "error", text: e.message || NET_ERR }); }
    setBusy(false);
  }

  // التنفيذ: سؤال أخير، ثم الدالة admin_reset_platform
  async function reset() {
    if (!window.confirm("سيتم حذف جميع الشكاوى نهائياً ولا يمكن التراجع. متابعة؟")) return;
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_reset_platform", { p_secret: secret, p_reset_code: code });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: NET_ERR });
    if (data === "NO_CODE") return setMsg({ type: "error", text: "لم يُعيَّن رمز التصفير بعد. عيّنه من Supabase ← SQL Editor بالأمر: select public.set_reset_code('رمزك');" });
    if (data !== "OK") return setMsg({ type: "error", text: "رمز التصفير غير صحيح." });
    setCode(""); setConfirm("");
    setMsg({ type: "ok", text: "✅ تم تصفير المنصة. الشكوى القادمة تبدأ من الرقم 00001 في الموسم الحالي." });
    reload();
  }

  // العرض: بطاقة الموسم، ثم بطاقة حمراء تحذيرية بما سيُحذف وما يبقى، وزر النسخة الاحتياطية والخانات
  return (
    <div>
    <SeasonCard secret={secret} reload={reload} />
    <ListCard secret={secret} listKey="classifications" list={CLASSIFICATIONS} title="🏷️ التصنيفات"
      hint="تظهر في تفاصيل الشكوى وفي تصفية جدول الشكاوى، مثل: تقييم المجموعات" />
    <ListCard secret={secret} listKey="decision_classes" list={DECISION_CLASSES} title="📑 تصنيفات القرارات الإدارية"
      hint="تظهر في قسم «القرارات الإدارية» عند إضافة قرار وفي التصفية" />
    <ListCard secret={secret} listKey="roles" list={ROLES} title="🪪 الصفات"
      hint="تظهر للمشتكي في نموذج الشكوى لاختيار صفته وصفة المشتكى عليه (مع خيار «أخرى»)" />
    <ExcelLockCard secret={secret} />
    <div className="card danger-zone">
      <h2>⚠️ تصفير المنصة</h2>
      <ul>
        <li>يُحذف: جميع الشكاوى، وجلساتها، وسجلها، وكلمات مرور المشتكين الخاصة.</li>
        <li>يبقى: كلمات مرور الأدمن والإدارة، وإعدادات الدخول.</li>
        <li>يعود ترقيم الشكاوى إلى 00001.</li>
      </ul>
      <p className="muted">ننصح بتصدير نسخة احتياطية أولاً ({(rows || []).length} شكوى حالياً).</p>
      <button type="button" className="btn secondary" disabled={busy} onClick={backup}>📥 نسخة احتياطية (Excel)</button>
      <div className="grid" style={{ marginTop: 14 }}>
        <Field label="رمز التصفير الخاص" hint="يُعيَّن من Supabase ← SQL Editor، وليس كلمة مرور الأدمن">
          <div className="pw-wrap">
            <input className="secret-input" type={show ? "text" : "password"} value={code} onChange={e => setCode(e.target.value)}
              autoComplete="off" autoCapitalize="off" spellCheck={false} dir="ltr" />
            <button type="button" className="pw-toggle" onClick={() => setShow(v => !v)}
              aria-label={show ? "إخفاء الرمز" : "إظهار الرمز"}><EyeIcon closed={show} /></button>
          </div>
        </Field>
        <Field label="للتأكيد اكتب كلمة: تصفير">
          <input value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <button type="button" className="btn danger" style={{ marginTop: 12 }}
        disabled={busy || !code || confirm.trim() !== "تصفير"} onClick={reset}>
        {busy ? "جارٍ التنفيذ…" : "🗑️ تصفير المنصة نهائياً"}
      </button>
    </div>
    </div>
  );
}

// بطاقة قائمة يعدّلها الأدمن (التصنيفات أو الصفات): إضافة عنصر، حذفه، وترتيبه — تُحفظ فوراً
function ListCard({ secret, listKey, list, title, hint }) {
  // العناصر الحالية، العنصر الجديد المكتوب، وحالة الحفظ والرسالة
  const [items, setItems] = useState([...list]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // حفظ القائمة كاملة عبر admin_set_list، ثم تحديث القائمة في الصفحة
  async function persist(next, okText) {
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_list", { p_secret: secret, p_key: listKey, p_items: next });
    setBusy(false);
    if (error || data !== "OK") return setMsg({ type: "error", text: error ? "تعذّر الحفظ (نفّذ القسم 23 من schema.sql في Supabase)." : "تعذّر الحفظ." });
    setItems(next); replaceList(list, next);
    setMsg({ type: "ok", text: okText });
  }

  // إضافة عنصر جديد (بلا تكرار)
  function add(e) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    if (items.includes(v)) return setMsg({ type: "error", text: "هذا العنصر موجود." });
    setText("");
    persist([...items, v], `✅ أُضيف «${v}».`);
  }

  // حذف عنصر (الشكاوى التي تحمله تبقى كما هي) وتحريكه للأعلى
  const remove = v => { if (window.confirm(`حذف «${v}» من القائمة؟ الشكاوى التي تحمله لا تتغيّر.`)) persist(items.filter(x => x !== v), `✅ حُذف «${v}».`); };
  const up = i => { if (i > 0) { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; persist(n, "✅ تم الترتيب."); } };

  // العرض: الشرح، خانة الإضافة، ثم العناصر كشرائح مع زري الرفع والحذف
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>{hint}</p>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={add}>
        <input type="text" value={text} onChange={e => setText(e.target.value)} maxLength={60} placeholder="اكتب عنصراً جديداً" />
        <button className="btn gold" disabled={busy || !text.trim()}>➕ إضافة</button>
      </form>
      <ul className="list-items">
        {items.map((v, i) => (
          <li key={v}>
            <span>{v}</span>
            <span className="row" style={{ gap: 4 }}>
              {i > 0 && <button type="button" className="btn secondary sm" disabled={busy} onClick={() => up(i)} aria-label="للأعلى">▲</button>}
              <button type="button" className="btn danger-text" disabled={busy} onClick={() => remove(v)}>حذف</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// بطاقة قفل ملفات Excel: كلمة المرور التي تُقفل بها ملفات التصدير (لفك القفل في Excel عند الحاجة)
function ExcelLockCard({ secret }) {
  // الكلمة المكتوبة، إظهارها، حالة الحفظ، والرسالة
  const [value, setValue] = useState(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب الكلمة الحالية
  useEffect(() => {
    sb.rpc("admin_get_excel_lock", { p_secret: secret }).then(({ data, error }) => {
      if (error) return setMsg({ type: "error", text: "تعذّر الجلب (نفّذ القسم 22 من schema.sql في Supabase)." });
      setValue(data || "");
    });
  }, [secret]);

  // الحفظ: تُستخدم فوراً في التصدير التالي
  async function save() {
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_excel_lock", { p_secret: secret, p_password: value });
    setBusy(false);
    if (error || data !== "OK") return setMsg({ type: "error", text: "تعذّر الحفظ، يرجى المحاولة مرة أخرى." });
    excelLock.password = value.trim();
    setMsg({ type: "ok", text: value.trim() ? "✅ تم الحفظ: ملفات Excel تُقفل بهذه الكلمة." : "✅ تم الحفظ: ملفات Excel تُقفل بلا كلمة مرور." });
  }

  // العرض: شرح مختصر، خانة الكلمة مع العين، وزر الحفظ
  return (
    <div className="card">
      <h2>🔒 قفل ملفات Excel</h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>كل ملف Excel يُصدَّر يكون للعرض فقط (لا كتابة ولا حذف). لفك القفل في Excel: مراجعة ← إلغاء حماية الورقة، ثم هذه الكلمة.</p>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {value !== null && (
        <Field label="كلمة مرور فك القفل" hint="اتركها فارغة للقفل بلا كلمة مرور">
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <div className="pw-wrap grow">
              <input className="secret-input" type={show ? "text" : "password"} value={value} onChange={e => setValue(e.target.value)}
                autoComplete="off" autoCapitalize="off" spellCheck={false} dir="ltr" maxLength={50} />
              <button type="button" className="pw-toggle" onClick={() => setShow(v => !v)}
                aria-label={show ? "إخفاء الكلمة" : "إظهار الكلمة"}><EyeIcon closed={show} /></button>
            </div>
            <button type="button" className="btn gold" disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>
          </div>
        </Field>
      )}
    </div>
  );
}

// بطاقة الموسم: الموسم الحالي (تُرقَّم به الشكاوى الجديدة من 1)، وبدء موسم جديد، وعدد شكاوى كل موسم
function SeasonCard({ secret, reload }) {
  // بيانات المواسم من الخادم، الموسم المكتوب، وحالة الحفظ والرسائل
  const [info, setInfo] = useState(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب الموسم الحالي وقائمة المواسم
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("admin_get_season", { p_secret: secret });
    if (error || !data) return setMsg({ type: "error", text: "تعذّر جلب المواسم (نفّذ القسم 21 من schema.sql في Supabase)." });
    setInfo(data); setValue(data.current || "");
  }, [secret]);
  useEffect(() => { load(); }, [load]);

  // حفظ الموسم الجديد بعد التأكيد
  async function save() {
    const v = value.trim();
    if (!/^\d{4}$/.test(v)) return setMsg({ type: "error", text: "اكتب الموسم بأربعة أرقام، مثل 1449." });
    if (!window.confirm(`تغيير الموسم الحالي إلى ${v}؟ الشكاوى الجديدة ستُرقَّم ${v}-00001، ${v}-00002 …`)) return;
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_season", { p_secret: secret, p_season: v });
    setBusy(false);
    if (error || data !== "OK") return setMsg({ type: "error", text: "تعذّر الحفظ، يرجى المحاولة مرة أخرى." });
    setMsg({ type: "ok", text: `✅ الموسم الحالي الآن ${v}.` });
    load(); reload();
  }

  // العرض: الموسم الحالي بخط كبير، خانة التغيير، ثم قائمة المواسم وأعدادها
  return (
    <div className="card">
      <h2>🕋 الموسم</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {info === null ? (!msg && <Loading />) : (
        <>
          <div className="muted center">الموسم الحالي</div>
          <div className="big-code">{info.current || "—"}</div>
          <p className="muted" style={{ fontSize: 14 }}>كل موسم يبدأ ترقيم شكاواه من 1، مثل {info.current || "1448"}-00001. الشكاوى السابقة تبقى بأرقامها.</p>
          <Field label="بدء موسم جديد" hint="4 أرقام، مثل 1449">
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input type="text" inputMode="numeric" dir="ltr" className="grow" value={value} onChange={e => setValue(e.target.value)} maxLength={4} />
              <button type="button" className="btn gold" disabled={busy || value.trim() === info.current} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
            </div>
          </Field>
          {info.seasons.length > 0 && (
            <ul className="list" style={{ marginTop: 10 }}>
              {info.seasons.map(x => (
                <li key={x.season}><b>موسم {x.season}{x.season === info.current && <span className="muted"> · الحالي</span>}</b><span className="muted">{x.total} شكوى</span></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// استعراض نسخة Excel محفوظة على الجهاز (للاطلاع فقط): يُقرأ الملف داخل المتصفح ولا يُرفع إلى أي مكان
// ولا يغيّر شيئاً في المنصة. لكل ورقة: بحث، تصفية بعمود وقيمة، فرز بالضغط على العنوان، اختيار الأعمدة
// الظاهرة، عدد الأسطر مع صفحات، والضغط على أي صف يفتح «بطاقته» بكل الحقول
function ExcelViewer({ onClose }) {
  // الملف المقروء {name, sheets:[{name, rows}]}، الورقة المعروضة، وحالة القراءة
  const [book, setBook] = useState(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // أدوات العرض: البحث، التصفية {col, value}، الفرز {col, dir}، الأعمدة المخفية، عدد الأسطر، الصفحة، والبطاقة المفتوحة
  const [search, setSearch] = useState("");
  const [filt, setFilt] = useState({ col: "", value: "" });
  const [sort, setSort] = useState({ col: null, dir: 1 });
  const [hidden, setHidden] = useState([]);
  const [showCols, setShowCols] = useState(false);
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(0);
  const [cardAt, setCardAt] = useState(null);

  // إعادة أدوات العرض لوضعها الأول (عند فتح ملف أو تغيير الورقة)
  function resetView() {
    setSearch(""); setFilt({ col: "", value: "" }); setSort({ col: null, dir: 1 });
    setHidden([]); setShowCols(false); setPage(0); setCardAt(null);
  }

  // قراءة الملف المختار: كل ورقة ← مصفوفة صفوف (الصف الأول = العناوين)
  async function open(file) {
    if (!file) return;
    setBusy(true); setError(""); setBook(null);
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheets = wb.SheetNames.map(n => ({ name: n,
        rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "", raw: false, dateNF: "yyyy-mm-dd hh:mm" }) }));
      setBook({ name: file.name, sheets }); setActive(0); resetView();
    } catch (e) { setError("تعذّر قراءة الملف. تأكد أنه ملف Excel ‎(.xlsx)."); }
    setBusy(false);
  }

  // الورقة الحالية: العناوين، والأعمدة الظاهرة (بأرقامها)
  const sheet = book && book.sheets[active];
  const head = sheet ? sheet.rows[0] || [] : [];
  const cols = head.map((h, i) => i).filter(i => !hidden.includes(i));

  // الصفوف: البحث ← التصفية ← الفرز (الأرقام والتواريخ تُفرز كأرقام، والنص أبجدياً)
  const term = search.trim();
  let body = sheet ? sheet.rows.slice(1) : [];
  if (term) body = body.filter(r => r.some(v => String(v).includes(term)));
  if (filt.col !== "") body = body.filter(r => String(r[filt.col] ?? "") === filt.value);
  if (sort.col !== null) {
    const key = v => { const s = String(v ?? ""); return s !== "" && !isNaN(Number(s)) ? Number(s) : s; };
    body = [...body].sort((a, b) => {
      const x = key(a[sort.col]), y = key(b[sort.col]);
      if (x === "" && y !== "") return 1;
      if (y === "" && x !== "") return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ar")) * sort.dir;
    });
  }

  // القيم المختلفة في عمود التصفية (لقائمة الاختيار)
  const values = filt.col === "" || !sheet ? [] :
    [...new Set(sheet.rows.slice(1).map(r => String(r[filt.col] ?? "")))].sort((a, b) => a.localeCompare(b, "ar")).slice(0, 300);

  // الصفحات
  const pages = Math.max(1, Math.ceil(body.length / perPage));
  const pg = Math.min(page, pages - 1);
  const shown = body.slice(pg * perPage, pg * perPage + perPage);

  // الضغط على عنوان: فرز تصاعدي ← تنازلي ← بلا فرز
  const toggleSort = i => setSort(s => s.col !== i ? { col: i, dir: 1 } : s.dir === 1 ? { col: i, dir: -1 } : { col: null, dir: 1 });
  const arrow = i => sort.col === i ? (sort.dir === 1 ? " ▲" : " ▼") : "";

  // إظهار عمود أو إخفاؤه (يبقى عمود واحد على الأقل)
  const toggleCol = i => setHidden(h => h.includes(i) ? h.filter(x => x !== i) : (head.length - h.length > 1 ? [...h, i] : h));

  // البطاقة المفتوحة: رقمها ضمن الصفوف بعد البحث والتصفية والفرز
  const card = cardAt !== null && body[cardAt];

  // العرض: نافذة فيها اختيار الملف، تبويبات الأوراق، أدوات العرض، الجدول، الصفحات، ثم البطاقة
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal xl-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-close"><button className="btn secondary sm" onClick={onClose}>✕ إغلاق</button></div>
        <h2 style={{ marginTop: 0 }}>📂 استعراض نسخة محفوظة <span className="muted" style={{ fontSize: 13 }}>(للاطلاع فقط)</span></h2>
        <label className="btn secondary block">
          {busy ? "جارٍ القراءة…" : book ? `📄 ${book.name} — اختيار ملف آخر` : "اختر ملف Excel من جهازك"}
          <input type="file" accept=".xlsx,.xls" hidden onChange={e => { open(e.target.files[0]); e.target.value = ""; }} />
        </label>
        <p className="muted" style={{ fontSize: 13 }}>الملف يُقرأ على هذا الجهاز فقط، ولا يُرفع ولا يغيّر بيانات المنصة.</p>
        {error && <Alert type="error">{error}</Alert>}
        {book && (
          <>
            <div className="tabs">
              {book.sheets.map((sh, i) => (
                <button key={sh.name} className={i === active ? "active" : ""} onClick={() => { setActive(i); resetView(); }}>
                  {sh.name} ({Math.max(0, sh.rows.length - 1)})
                </button>
              ))}
            </div>

            <div className="xl-tools">
              <input type="text" placeholder="🔍 بحث في هذه الورقة…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <select value={filt.col} onChange={e => { setFilt({ col: e.target.value === "" ? "" : Number(e.target.value), value: "" }); setPage(0); }} aria-label="تصفية حسب العمود">
                  <option value="">⏷ تصفية حسب…</option>
                  {head.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
                {filt.col !== "" && (
                  <select value={filt.value} onChange={e => { setFilt(f => ({ ...f, value: e.target.value })); setPage(0); }} aria-label="القيمة">
                    <option value="" disabled>اختر القيمة</option>
                    {values.map(v => <option key={v} value={v}>{v || "(فارغ)"}</option>)}
                  </select>
                )}
                {filt.col !== "" && <button type="button" className="btn danger-text" onClick={() => setFilt({ col: "", value: "" })}>مسح</button>}
              </div>
              <div className="row">
                <span className="field-label">عدد الأسطر</span>
                <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }} style={{ width: "auto" }}>
                  {[10, 50, 100, 500].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" className="btn secondary sm" onClick={() => setShowCols(v => !v)}>⚙️ الأعمدة ({cols.length}/{head.length})</button>
              </div>
              {showCols && (
                <div className="col-picker">
                  {head.map((h, i) => (
                    <label key={i}><input type="checkbox" checked={!hidden.includes(i)} onChange={() => toggleCol(i)} /> {h}</label>
                  ))}
                  <div className="row" style={{ marginTop: 6 }}>
                    <button type="button" className="btn secondary sm" onClick={() => setHidden([])}>إظهار الكل</button>
                  </div>
                </div>
              )}
            </div>

            {body.length === 0 ? <p className="muted center">لا توجد صفوف{term || filt.col !== "" ? " مطابقة" : ""}.</p> : (
              <>
                <div className="table-wrap xl-view">
                  <table>
                    <thead><tr>{cols.map(i => <th key={i} className="sortable" onClick={() => toggleSort(i)}>{head[i]}{arrow(i)}</th>)}</tr></thead>
                    <tbody>
                      {shown.map((r, k) => (
                        <tr key={k} className="clickable" onClick={() => setCardAt(pg * perPage + k)} title="اضغط لعرض البطاقة">
                          {cols.map(j => <td key={j}>{r[j]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 13 }}>عرض {pg * perPage + 1}–{pg * perPage + shown.length} من {body.length} · اضغط على أي صف لعرض بطاقته</span>
                  {pages > 1 && (
                    <span className="row" style={{ gap: 6 }}>
                      <button type="button" className="btn secondary sm" disabled={pg === 0} onClick={() => setPage(pg - 1)}>→ السابق</button>
                      <span className="muted">{pg + 1} / {pages}</span>
                      <button type="button" className="btn secondary sm" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>التالي ←</button>
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {card && (
          <div className="modal-back" onClick={() => setCardAt(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                  <b>🗂️ بطاقة ({cardAt + 1} من {body.length}) <span className="readonly-tag">👁️ للاطلاع فقط</span></b>
                  <button type="button" className="btn secondary sm" onClick={() => setCardAt(null)}>✕ إغلاق</button>
                </div>
                <dl className="detail-grid xl-card">
                  {head.map((h, i) => <div key={i}><dt>{h}</dt><dd>{String(card[i] ?? "") || <span className="muted">—</span>}</dd></div>)}
                </dl>
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
                  <button type="button" className="btn secondary" disabled={cardAt === 0} onClick={() => setCardAt(cardAt - 1)}>→ السابق</button>
                  <button type="button" className="btn secondary" disabled={cardAt >= body.length - 1} onClick={() => setCardAt(cardAt + 1)}>التالي ←</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// تبويب الشكاوى: تصفية بالحالة وبحث، ثم جدول الشكاوى
function AdminComplaints({ secret, rows, onSaved, reload, onOpen, initialSearch = "", initialFilter = "الكل" }) {
  // التصفية والبحث (قد يبدآن بقيمة من الرئيسية)، وحالة التصدير الكامل
  const [filter, setFilter] = useState(initialFilter);
  const [search, setSearch] = useState(initialSearch);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState("");
  const [viewing, setViewing] = useState(false);   // نافذة استعراض نسخة محفوظة

  // الموسم المعروض: يبدأ بالموسم الحالي من الإعدادات ("" = كل المواسم)
  const [season, setSeason] = useState("");
  const [current, setCurrent] = useState("");
  useEffect(() => {
    sb.rpc("admin_get_season", { p_secret: secret }).then(({ data }) => { if (data && data.current) { setCurrent(data.current); setSeason(data.current); } });
  }, [secret]);
  const seasons = [...new Set([current, ...(rows || []).map(c => c.season)].filter(Boolean))].sort().reverse();
  // التصنيف المعروض ("" = كل التصنيفات)
  const [klass, setKlass] = useState("");
  const klasses = [...new Set([...CLASSIFICATIONS, ...(rows || []).map(c => c.classification)].filter(Boolean))];
  const inSeason = (rows || []).filter(c => (!season || c.season === season) && (!klass || c.classification === klass));

  // تصدير كل الجداول (الشكاوى، الجلسات، السجل، الإحالة) إلى ملف Excel واحد
  async function exportAll() {
    setExporting(true); setExportErr("");
    try { await exportAllToExcel(secret, inSeason); }
    catch (e) { setExportErr(e.message || NET_ERR); }
    setExporting(false);
  }

  // التصفية بالحالة ونص البحث (الرقم، الأسماء، الموضوع، الرموز)
  const term = search.trim();
  const visible = inSeason.filter(c =>
    (filter === "الكل" || c.status === filter) &&
    (!term || [c.complaint_number, c.title, c.complainant_name, c.complainant_role, c.accused_role, c.classification, c.phone_number, c.contact_number, c.accused_name, c.subject, c.tracking_code, c.access_code, c.referred_to].some(v => (v || "").includes(term))));
  const count = s => inSeason.filter(c => s === "الكل" || c.status === s).length;

  // العرض: أزرار التصفية مع الأعداد، البحث، ثم الجدول
  return (
    <div>
      <div className="row season-row">
        {seasons.length > 0 && (
          <select value={season} onChange={e => setSeason(e.target.value)} aria-label="الموسم">
            <option value="">كل المواسم</option>
            {seasons.map(x => <option key={x} value={x}>موسم {x}{x === current ? " (الحالي)" : ""}</option>)}
          </select>
        )}
        <select value={klass} onChange={e => setKlass(e.target.value)} aria-label="التصنيف">
          <option value="">كل التصنيفات</option>
          {klasses.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="chips">
        {["الكل", ...STATUSES].map(s => (
          <button key={s} className={filter === s ? "active" : ""} onClick={() => setFilter(s)}>{s} ({count(s)})</button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="grow" type="text" placeholder="بحث بالرقم أو الاسم أو الهاتف أو الموضوع أو الجهة…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn secondary" onClick={reload}>🔄 تحديث</button>
        <button className="btn gold" disabled={exporting || !rows} onClick={exportAll} title="الشكاوى + الجلسات (للموسم المختار)">{exporting ? "جارٍ التصدير…" : "📥 تصدير كل الجداول (Excel)"}</button>
        <button className="btn secondary" onClick={() => setViewing(true)}>📂 استعراض نسخة محفوظة</button>
      </div>
      {viewing && <ExcelViewer onClose={() => setViewing(false)} />}
      {exportErr && <Alert type="error">{exportErr}</Alert>}
      {rows === null ? <Loading /> : <ComplaintsTable secret={secret} rows={visible} onSaved={onSaved} onOpen={onOpen} />}
    </div>
  );
}

// تفاصيل شكوى واحدة (في النافذة): البيانات + التصنيف، الترحيل، الحالة، النتائج الثلاث، الإغلاق، التنبيه،
// والاعتراض والجلسات والسجل. fromDue: فُتحت من «المطلوب» فيظهر في أعلاها طلب تحديد التنبيه القادم
function ComplaintCard({ secret, complaint: c, onSaved, onSessionsChanged, fromDue }) {
  // القيم القابلة للتعديل وحالة الحفظ
  // (الحالة والنتيجة والإغلاق للعرض فقط: تأتي من آخر جلسة)
  const [vState, setV] = useState({
    classification: c.classification || "",
    referred_to: c.referred_to || "",
    complainant_result: c.complainant_result || "",
    accused_result: c.accused_result || "",
    reminder: toDateTimeInput(c.reminder_at),
    reminder_note: c.reminder_note || "",
  });
  const [closeReq, setCloseReq] = useState(0);   // طلب «إغلاق عبر جلسة» من مربع «المطلوب»
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const v = vState;
  const set = key => e => { setV(x => ({ ...x, [key]: e.target.value })); setMsg(null); };

  // الحفظ عبر admin_update_complaint (التصنيف، الإحالة، نتيجتا المشتكي والمعترض، والتنبيه)؛
  // الحالة والنتيجة والإغلاق تُرسل كما هي ولا تتغيّر (تأتي من الجلسات)
  async function save(overrides) {
    const v = { ...vState, ...(overrides || {}) };
    if (overrides) setV(v);
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_update_complaint", {
      p_secret: secret, p_id: c.id, p_classification: v.classification, p_referred_to: v.referred_to,
      p_status: c.status, p_result: c.result, p_complainant_result: v.complainant_result, p_accused_result: v.accused_result,
      p_closed_date: c.closed_date,
      p_reminder_at: dateTimeInputToIso(v.reminder), p_reminder_note: v.reminder_note,
    });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر الحفظ، يرجى المحاولة مرة أخرى." });
    onSaved(data[0]);
    setMsg({ type: "ok", text: "تم الحفظ." });
  }

  // حفظ التنبيه القادم من مربع «المطلوب»: التاريخ والمطلوب إلزاميان
  function saveReminder() {
    if (!v.reminder || !v.reminder_note.trim())
      return setMsg({ type: "error", text: "حدّد تاريخ ووقت التنبيه القادم، واكتب المطلوب عنده — أو اضغط «إغلاق عبر جلسة»." });
    if (new Date(v.reminder) <= new Date())
      return setMsg({ type: "error", text: "موعد التنبيه القادم يجب أن يكون في المستقبل." });
    save();
  }

  // بعد إضافة جلسة أو تعديلها: تحديث الشكوى في القائمة والإحالة المعروضة (الإغلاق يمسح التنبيه اليدوي)
  function applyFromSession(u) {
    onSaved(u);
    setV(x => ({ ...x, referred_to: u.referred_to || "", complainant_result: u.complainant_result || "", accused_result: u.accused_result || "" }));
  }

  // تصدير ملف الشكوى الكامل إلى Word (قابل للتعديل)
  const [wordBusy, setWordBusy] = useState(false);
  async function exportWord() {
    setWordBusy(true); setMsg(null);
    try { await exportComplaintWord(secret, c); }
    catch (e) { setMsg({ type: "error", text: e.message || NET_ERR }); }
    setWordBusy(false);
  }

  // هل أُغلقت نهائياً بعد الاعتراض؟ (تُقفل ولا يبقى إلا تعديل الجلسات)
  const finalClosed = c.status === CLOSED_OBJ;

  // التنبيهات الذكية للشكوى كما هي محفوظة
  const alerts = smartAlerts(c);

  // العرض: الرأس، التنبيهات، البيانات، الموضوع، ثم حقول الإدارة وزر الحفظ
  return (
    <div className={`card status-card ${stClass(c.status)}`}>
      <div className="c-head">
        <div>
          <div className="c-no">{c.complaint_number}</div>
          <div className="meta">
            <span>📅 {fmtDateTime(c.received_date)}</span>
            <span>🔖 رمز المتابعة: <span dir="ltr">{c.tracking_code || "—"}</span></span>
            {c.access_code && <span>🔑 <span dir="ltr">{c.access_code}</span></span>}
          </div>
        </div>
        <StatusBadge value={c.status} />
      </div>
      {alerts.map((a, i) => <div key={i} className={`reminder-bar ${a.level}`}>{a.level === "later" ? "🗓️" : "⏰"} {a.text}</div>)}
      <div className="meta" style={{ fontSize: 14.5, color: "var(--ink)" }}>
        <span>👤 المشتكي: <b>{c.complainant_name}</b>{c.complainant_role && <span className="muted"> ({c.complainant_role})</span>}</span>
        <span>📞 <b dir="ltr">{c.phone_number || "—"}</b></span>
        {c.contact_number && <span>💬 واتس/تلغرام: <b dir="ltr">{c.contact_number}</b></span>}
        <span>⚠️ المشتكى عليه: <b>{c.accused_name || "—"}</b>{c.accused_role && <span className="muted"> ({c.accused_role})</span>}</span>
      </div>
      {c.title && <div className="c-title">📝 {c.title}</div>}
      <div className="subject">{c.subject}</div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {fromDue && !isClosed(c.status) && (
        <div className="due-prompt">
          <b>⏰ حدّد موعد التنبيه القادم والمطلوب عنده</b>
          <small className="muted" style={{ display: "block", marginBottom: 10 }}>حتى تعود هذه الشكوى إلى «المطلوب» في موعدها ولا تُنسى. وإن انتهت متابعتها فأغلقها بجلسة إغلاق.</small>
          <div className="grid">
            <Field label="تاريخ ووقت التنبيه" required>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="datetime-local" value={v.reminder} onChange={set("reminder")} />
                {v.reminder && <button type="button" className="btn danger-text" onClick={() => setV(x => ({ ...x, reminder: "", reminder_note: "" }))}>مسح</button>}
              </div>
            </Field>
            <Field label="المطلوب عند التنبيه" required><input type="text" value={v.reminder_note} onChange={set("reminder_note")} maxLength={500} placeholder="مثال: الاتصال بمسؤول السكن" /></Field>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
            <button type="button" className="btn" disabled={busy} onClick={saveReminder}>{busy ? "جارٍ الحفظ…" : "حفظ التنبيه والتعديلات"}</button>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => setCloseReq(n => n + 1)}>🔒 إغلاق عبر جلسة</button>
          </div>
        </div>
      )}
      <div className="grid">
        <Field label="التصنيف">
          <select value={v.classification} onChange={set("classification")}>
            <option value="">— اختر —</option>
            {CLASSIFICATIONS.map(x => <option key={x}>{x}</option>)}
            {v.classification && !CLASSIFICATIONS.includes(v.classification) && <option>{v.classification}</option>}
          </select>
        </Field>
        <Field label="ترحيل / مُحالة إلى"><input type="text" value={v.referred_to} onChange={set("referred_to")} maxLength={200} placeholder="الجهة أو الشخص" /></Field>
        <Field label="الحالة" hint="تتغيّر تلقائياً من الجلسات">
          <div className="readonly-field"><StatusBadge value={c.status} />{c.closed_date && <span className="muted"> · أُغلقت {fmtDate(c.closed_date)}</span>}</div>
        </Field>
        {!fromDue && (
          <>
            <Field label="⏰ تنبيه يدوي (اختياري)" hint="يظهر في «المطلوب» في يومه">
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="datetime-local" value={v.reminder} onChange={set("reminder")} />
                {v.reminder && <button type="button" className="btn danger-text" onClick={() => setV(x => ({ ...x, reminder: "", reminder_note: "" }))}>مسح</button>}
              </div>
            </Field>
            <Field label="المطلوب عند التنبيه"><input type="text" value={v.reminder_note} onChange={set("reminder_note")} maxLength={500} placeholder="مثال: الاتصال بمسؤول السكن" /></Field>
          </>
        )}
        <Field label="👤 النتيجة التي يراها المشتكي" hint="تظهر للمشتكي في صفحة «نتيجة الشكوى» — لا تأتي من الجلسات" full>
          <textarea style={{ minHeight: 70 }} value={v.complainant_result} onChange={set("complainant_result")} maxLength={2000} />
        </Field>
        <Field label="⚖️ النتيجة التي يراها المعترض" hint="تظهر للمشتكى عليه في صفحة الاعتراض — لا تأتي من الجلسات" full>
          <textarea style={{ minHeight: 70 }} value={v.accused_result} onChange={set("accused_result")} maxLength={2000} />
        </Field>
      </div>
      <ResultBox c={c} />
      <ReferralsLine secret={secret} id={c.id} version={c.updated_at} />
      <button className="btn block" style={{ marginTop: 14 }} disabled={busy} onClick={() => save()}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      <SessionsSection secret={secret} complaint={c} onApplied={applyFromSession} onChanged={() => (onSessionsChanged || (() => {}))()} closeReq={closeReq} />
      <ObjectionSection secret={secret} complaint={c} onSaved={onSaved} />
      {finalClosed && <div className="locked-note">🔒 أُغلقت الشكوى نهائياً بعد الاعتراض — يمكن تعديل الجلسات فقط.</div>}
      <button type="button" className="btn secondary block" style={{ marginTop: 14 }} disabled={wordBusy} onClick={exportWord}>
        {wordBusy ? "جارٍ تجهيز الملف…" : "📄 تصدير ملف الشكوى (Word)"}
      </button>
    </div>
  );
}

// «نتيجة الشكوى» للعرض فقط: من آخر جلسة؛ بعد الاعتراض تظهر علامة ⚖️ والنتيجة قبل الاعتراض تحتها
function ResultBox({ c }) {
  const afterObjection = !!c.objection_at;
  return (
    <div className="result-box">
      <div className="field-label">
        📋 نتيجة الشكوى {afterObjection && <span className="obj-tag">⚖️ بعد الاعتراض</span>}
        <small className="muted"> — من آخر جلسة (لا تُكتب يدوياً)</small>
      </div>
      <div className="subject">{c.result || <span className="muted">لم تصدر بعد — تُضاف من الجلسات</span>}</div>
      {afterObjection && c.result_before_objection && (
        <div className="muted" style={{ fontSize: 13.5, marginTop: 6 }}>النتيجة قبل الاعتراض: {c.result_before_objection}</div>
      )}
    </div>
  );
}

// سطر «الإحالات السابقة» في تفاصيل الشكوى: إلى من أُحيلت ومتى (من جدول الإحالات الصغير)
function ReferralsLine({ secret, id, version }) {
  // الإحالات (لا شيء يظهر إن لم توجد، أو إن لم يُنفَّذ القسم 25 بعد)
  const [list, setList] = useState([]);
  useEffect(() => {
    sb.rpc("admin_complaint_referrals", { p_secret: secret, p_id: id }).then(({ data }) => setList(data || []));
  }, [secret, id, version]);
  if (!list.length) return null;
  return (
    <div className="ref-line">
      <b>↗️ الإحالات:</b>{" "}
      {list.map((r, i) => <span key={i}>{i > 0 && " ← "}{r.referred_to} <small className="muted">({fmtDate(r.referred_at)})</small></span>)}
    </div>
  );
}

// ---------------------------------------------------------------------
// اعتراض المشتكى عليه (في تفاصيل الشكوى): عرض الاعتراض إن وصل، توليد رمز الاعتراض مع الملخص
// وآخر موعد، وتمديد استثنائي للمهلة بسبب إلزامي
// ---------------------------------------------------------------------
const OBJECTION_DAYS = Number(cfg.OBJECTION_DAYS) || 3;
const defaultDeadline = () => { const d = new Date(); d.setDate(d.getDate() + OBJECTION_DAYS); return toDateTimeInput(d); };

function ObjectionSection({ secret, complaint: c, onSaved }) {
  // الملخص، آخر موعد، وضع النموذج (generate / extend)، بيانات التمديد، والرسائل
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [mode, setMode] = useState(null);
  const [ext, setExt] = useState({ at: defaultDeadline(), reason: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // هل انتهت المهلة؟
  const expired = c.objection_deadline && new Date(c.objection_deadline) < new Date();

  // توليد الرمز عبر admin_set_objection_code (إعادة التوليد تُبطل الرمز القديم)
  async function generate() {
    if (!deadline || new Date(deadline) <= new Date()) return setMsg({ type: "error", text: "آخر موعد للاعتراض يجب أن يكون في المستقبل." });
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_objection_code", { p_secret: secret, p_id: c.id, p_summary: c.title || "", p_deadline: dateTimeInputToIso(deadline) });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر توليد الرمز، يرجى المحاولة مرة أخرى." });
    onSaved(data[0]);
    setMode(null);
    setMsg({ type: "ok", text: "تم توليد رمز الاعتراض. انسخ الرسالة وأرسلها للمشتكى عليه." });
  }

  // تمديد استثنائي عبر admin_set_objection_deadline (السبب إلزامي ويُحفظ مع الشكوى)
  async function extend() {
    if (!ext.reason.trim()) return setMsg({ type: "error", text: "اكتب سبب التمديد الاستثنائي." });
    if (!ext.at || new Date(ext.at) <= new Date()) return setMsg({ type: "error", text: "الموعد الجديد يجب أن يكون في المستقبل." });
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_objection_deadline", { p_secret: secret, p_id: c.id, p_deadline: dateTimeInputToIso(ext.at), p_reason: ext.reason });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر التمديد، يرجى المحاولة مرة أخرى." });
    onSaved(data[0]);
    setMode(null);
    setExt({ at: defaultDeadline(), reason: "" });
    setMsg({ type: "ok", text: "تم التمديد الاستثنائي، وحُفظ سببه مع الشكوى." });
  }

  // نص الرسالة للمشتكى عليه (مع آخر موعد)
  const text = `للاطلاع على الشكوى المقدّمة بحقك وتقديم اعتراضك (مرة واحدة) افتح الرابط:\n${siteUrl()}#/objection\nرقم الشكوى: ${c.complaint_number}\nرمز الاعتراض: ${c.objection_code}\nآخر موعد للاعتراض: ${fmtDateTime(c.objection_deadline)}`;

  // العرض: الاعتراض المقدَّم، أو الرمز الحالي مع المهلة وأزراره، أو زر التوليد؛ ثم النموذج المفتوح
  return (
    <div className="sessions">
      <h3>⚖️ اعتراض المشتكى عليه</h3>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {c.objection_at ? (
        <>
          <div className="muted" style={{ fontSize: 13.5 }}>قُدّم في {fmtDateTime(c.objection_at)}</div>
          <div className="subject" style={{ marginTop: 6 }}>{c.objection_text}</div>
        </>
      ) : c.objection_code && !mode ? (
        <>
          <p className="muted" style={{ margin: "0 0 4px" }}>لم يقدّم المشتكى عليه اعتراضه بعد. رمز الاعتراض:</p>
          <div className="big-code" style={{ fontSize: 28 }}>{c.objection_code}</div>
          <div className={`deadline ${expired ? "over" : ""}`}>
            ⏳ آخر موعد للاعتراض: <b>{fmtDateTime(c.objection_deadline)}</b> {expired ? "— انتهت المهلة" : ""}
            {c.objection_extension_reason && <div style={{ fontSize: 13.5, marginTop: 4 }}>سبب التمديد الاستثنائي: {c.objection_extension_reason}</div>}
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <button type="button" className="btn secondary" onClick={async () => setMsg(await copyText(text) ? { type: "ok", text: "تم نسخ الرسالة." } : { type: "error", text: "تعذّر النسخ." })}>📋 نسخ الرسالة</button>
            <button type="button" className={`btn ${expired ? "gold" : "secondary"}`} onClick={() => { setMode("extend"); setMsg(null); }}>⏳ تمديد استثنائي</button>
          </div>
          <button type="button" className="btn danger-text" style={{ marginTop: 6 }} onClick={() => { setMode("generate"); setMsg(null); }}>🔄 رمز جديد / تعديل الملخص</button>
        </>
      ) : !mode && c.status !== CLOSED ? (
        <p className="muted" style={{ marginTop: 0 }}>يصبح الاعتراض متاحاً بعد إغلاق الشكوى.</p>
      ) : !mode ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>أُغلقت الشكوى — يمكنك الآن إرسال رمز اعتراض للمشتكى عليه (مرة واحدة).</p>
          <button type="button" className="btn block" onClick={() => setMode("generate")}>⚖️ توليد رمز اعتراض للمشتكى عليه</button>
        </>
      ) : null}

      {mode === "generate" && !c.objection_at && (
        <div className="session-form">
          <div className="readonly-field" style={{ marginBottom: 6 }}>سيرى المشتكى عليه عنوان الاعتراض فقط: <b>«{c.title || "—"}»</b></div>
          <div style={{ marginTop: 10 }}>
            <Field label="آخر موعد للاعتراض" hint={`الافتراضي بعد ${OBJECTION_DAYS} أيام؛ بعده يُرفض الاعتراض إلا بتمديد استثنائي`}>
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </Field>
          </div>
          {c.objection_code && <small className="hint" style={{ display: "block", marginTop: 6 }}>توليد رمز جديد يُبطل الرمز السابق.</small>}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
            <button type="button" className="btn" disabled={busy} onClick={generate}>{busy ? "جارٍ التوليد…" : "توليد الرمز"}</button>
            <button type="button" className="btn secondary" onClick={() => setMode(null)}>تراجع</button>
          </div>
        </div>
      )}

      {mode === "extend" && !c.objection_at && (
        <div className="session-form">
          <div className="field-label" style={{ marginBottom: 8 }}>⏳ تمديد استثنائي لمهلة الاعتراض</div>
          <div className="grid">
            <Field label="الموعد الجديد" required><input type="datetime-local" value={ext.at} onChange={e => setExt(x => ({ ...x, at: e.target.value }))} /></Field>
            <Field label="سبب الاستثناء" required full><textarea style={{ minHeight: 70 }} value={ext.reason} onChange={e => setExt(x => ({ ...x, reason: e.target.value }))} maxLength={500} placeholder="مثال: كان المشتكى عليه في المشاعر ولم يتمكن من الاطلاع" /></Field>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
            <button type="button" className="btn" disabled={busy} onClick={extend}>{busy ? "جارٍ الحفظ…" : "تمديد"}</button>
            <button type="button" className="btn secondary" onClick={() => setMode(null)}>تراجع</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// الجلسات
// ---------------------------------------------------------------------
// قسم الجلسات داخل تفاصيل الشكوى: سجل جلساتها + إضافة جلسة أو تعديلها (لا حذف)؛
// قيم أحدث جلسة تُرحَّل إلى الشكوى، والنتيجة إلى «نتيجة الشكوى» الداخلية فقط
// حالات الجلسة: «جاري المتابعة» (أو «جاري متابعة الاعتراض» للجلسة بعد الاعتراض)، أو إغلاق الشكوى
const sessionStatuses = (complaint, at) =>
  complaint.objection_at && (!at || new Date(at) >= new Date(complaint.objection_at))
    ? ["جاري متابعة الاعتراض", CLOSED_OBJ] : ["جاري المتابعة", CLOSED];
const sessionStatus = (complaint, s, at) => sessionStatuses(complaint, at)[isClosed(s) ? 1 : 0];

function SessionsSection({ secret, complaint, onApplied, onChanged, closeReq = 0 }) {
  // سجل الجلسات، النموذج (جلسة جديدة أو تعديل جلسة: editId)، والرسائل
  const blank = () => ({ at: toDateTimeInput(new Date()), title: "", topic: "", referred_to: complaint.referred_to || "", result: "",
                         status: sessionStatus(complaint, complaint.status),
                         cresult: complaint.complainant_result || "", aresult: complaint.accused_result || "" });
  const [list, setList] = useState(null);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = key => e => { setForm(f => ({ ...f, [key]: e.target.value })); setMsg(null); };

  // جلب جلسات هذه الشكوى
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("admin_list_sessions", { p_secret: secret, p_complaint_id: complaint.id });
    if (error) { setList([]); return setMsg({ type: "error", text: NET_ERR }); }
    setList(data || []);
  }, [secret, complaint.id]);
  useEffect(() => { load(); }, [load]);

  // بدء تعديل جلسة: تعبئة النموذج بقيمها
  function startEdit(s) {
    setEditId(s.id);
    setForm({ at: toDateTimeInput(s.session_at), title: s.title || "", topic: s.topic || "", referred_to: s.referred_to || "", result: s.result || "",
              status: sessionStatus(complaint, s.status, s.session_at),
              cresult: complaint.complainant_result || "", aresult: complaint.accused_result || "" });
    setMsg(null);
  }

  // طلب «إغلاق عبر جلسة» من مربع «المطلوب»: نموذج جلسة جديدة بحالة «مغلقة» والصعود إليه
  const formRef = React.useRef(null);
  useEffect(() => {
    if (!closeReq) return;
    setEditId(null); setForm(f => ({ ...blank(), title: f.title, topic: f.topic, result: f.result, status: sessionStatuses(complaint)[1] }));
    setTimeout(() => formRef.current && formRef.current.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, [closeReq]);

  // الشكوى المغلقة: لا جلسات جديدة (إلا بعد اعتراض)، والتعديل متاح
  const closed = isClosed(complaint.status);

  // إلغاء التعديل والعودة لنموذج جلسة جديدة
  function cancelEdit() { setEditId(null); setForm(blank()); setMsg(null); }

  // حفظ: إضافة جلسة (admin_add_session) أو تعديلها (admin_update_session)؛ تُرجع الشكوى بعد الترحيل
  async function submit(e) {
    e.preventDefault();
    if (!form.at) return setMsg({ type: "error", text: "حدّد تاريخ ووقت الجلسة." });
    const closing = isClosed(form.status);
    if (closing && !form.cresult.trim()) return setMsg({ type: "error", text: "اكتب النص الذي يظهر للمشتكي في صفحة «نتيجة الشكوى» قبل الإغلاق." });
    setBusy(true); setMsg(null);
    const args = { p_secret: secret, p_session_at: dateTimeInputToIso(form.at), p_title: form.title, p_topic: form.topic,
                   p_referred_to: form.referred_to, p_result: form.result, p_status: form.status };
    const { data, error } = editId
      ? await sb.rpc("admin_update_session", { ...args, p_id: editId })
      : await sb.rpc("admin_add_session", { ...args, p_complaint_id: complaint.id });
    setBusy(false);
    if (error && /مغلقة/.test(error.message || "")) return setMsg({ type: "error", text: "الشكوى مغلقة: يمكن تعديل جلساتها فقط." });
    if (error || !data || !data.length) return setMsg({ type: "error", text: editId ? "تعذّر تعديل الجلسة، يرجى المحاولة مرة أخرى." : "تعذّر إضافة الجلسة، يرجى المحاولة مرة أخرى." });
    // عند الإغلاق: حفظ ما يراه المشتكي (والمعترض) في الشكوى، والتنبيه اليدوي يُلغى
    let u = data[0];
    if (closing) {
      const r2 = await sb.rpc("admin_update_complaint", {
        p_secret: secret, p_id: u.id, p_classification: u.classification, p_referred_to: u.referred_to, p_status: u.status,
        p_result: u.result, p_complainant_result: form.cresult, p_accused_result: complaint.objection_at ? form.aresult : u.accused_result,
        p_closed_date: u.closed_date, p_reminder_at: null, p_reminder_note: null,
      });
      if (r2.data && r2.data.length) u = r2.data[0];
    }
    onApplied(u);
    setMsg({ type: "ok", text: editId ? "تم تعديل الجلسة." : "تمت إضافة الجلسة، ورُحِّل المحال إليه ونتيجة الجلسة والحالة إلى الشكوى (إن كانت أحدث جلسة)." });
    setEditId(null); setForm(blank());
    load(); onChanged();
  }

  // العرض: عنوان القسم، سجل الجلسات (مع زر تعديل)، ثم النموذج
  return (
    <div className="sessions">
      <h3>🗓️ الجلسات {list && `(${list.length})`}</h3>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {list === null ? <Loading /> : list.length === 0 ? <p className="muted" style={{ marginTop: 0 }}>لا توجد جلسات لهذه الشكوى بعد.</p> : (
        <div className="table-wrap" style={{ maxHeight: 280, marginBottom: 12, border: "1px solid var(--line)" }}>
          <table className="sheet">
            <thead><tr><th>التاريخ والوقت</th><th>عنوان الجلسة</th><th>موضوع الجلسة</th><th>ترحيل / مُحالة إلى</th><th>نتيجة الجلسة</th><th>حالة الشكوى</th><th></th></tr></thead>
            <tbody>
              {list.map(s => (
                <tr key={s.id} className={`status-row ${stClass(s.status)} ${editId === s.id ? "selected" : ""}`} style={{ cursor: "default" }}>
                  <td>{fmtDateTime(s.session_at)}</td>
                  <td><b>{s.title || <span className="muted">—</span>}</b></td>
                  <td className="wrap">{s.topic || <span className="muted">—</span>}</td>
                  <td>{s.referred_to || <span className="muted">—</span>}</td>
                  <td className="wrap">{s.result || <span className="muted">—</span>}</td>
                  <td><StatusBadge value={s.status} /></td>
                  <td><button className="btn danger-text" style={{ color: "var(--brand)" }} onClick={() => startEdit(s)}>✏️ تعديل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {closed && !editId ? (
        <p className="muted" style={{ fontSize: 13.5 }}>🔒 الشكوى مغلقة — لا تُضاف جلسات جديدة{complaint.objection_at ? "" : " إلا بعد وصول اعتراض"}. يمكن تعديل أي جلسة بزر «✏️ تعديل».</p>
      ) : (
      <form onSubmit={submit} className="session-form" ref={formRef}>
        <div className="field-label" style={{ marginBottom: 8 }}>{editId ? "✏️ تعديل الجلسة" : "➕ جلسة جديدة"}</div>
        <div className="grid">
          <Field label="التاريخ والوقت" required><input type="datetime-local" value={form.at} onChange={set("at")} /></Field>
          <Field label="عنوان الجلسة"><input type="text" value={form.title} onChange={set("title")} maxLength={200} placeholder="مثال: جلسة استماع للطرفين" /></Field>
          <Field label="ترحيل / مُحالة إلى"><input type="text" value={form.referred_to} onChange={set("referred_to")} maxLength={200} placeholder="الجهة أو الشخص" /></Field>
          <Field label="حالة الشكوى بعد الجلسة" required hint="«مغلقة» تغلق الشكوى بتاريخ الجلسة">
            <select value={form.status} onChange={set("status")}>{sessionStatuses(complaint, editId ? form.at : null).map(x => <option key={x}>{x}</option>)}</select>
          </Field>
          <Field label="موضوع الجلسة" full><textarea style={{ minHeight: 60 }} value={form.topic} onChange={set("topic")} maxLength={2000} placeholder="ما الذي نوقش في الجلسة" /></Field>
          <Field label="نتيجة الجلسة" full><textarea style={{ minHeight: 70 }} value={form.result} onChange={set("result")} maxLength={2000} /></Field>
          {isClosed(form.status) && (
            <Field label="📩 النص الذي يظهر للمشتكي في نتيجة الشكوى" required hint="يراه المشتكي برقم الشكوى ورمز المتابعة" full>
              <textarea style={{ minHeight: 70 }} value={form.cresult} onChange={set("cresult")} maxLength={2000} />
            </Field>
          )}
          {isClosed(form.status) && complaint.objection_at && (
            <Field label="⚖️ النص الذي يظهر للمعترض" hint="اختياري — يراه المشتكى عليه في صفحة الاعتراض" full>
              <textarea style={{ minHeight: 60 }} value={form.aresult} onChange={set("aresult")} maxLength={2000} />
            </Field>
          )}
        </div>
        {editId ? (
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
            <button className="btn" disabled={busy}>{busy ? "جارٍ الحفظ…" : "💾 حفظ التعديل"}</button>
            <button type="button" className="btn secondary" onClick={cancelEdit}>إلغاء التعديل</button>
          </div>
        ) : (
          <button className="btn block" style={{ marginTop: 12 }} disabled={busy}>{busy ? "جارٍ الإضافة…" : "➕ إضافة الجلسة وترحيلها إلى الشكوى"}</button>
        )}
        <small className="hint" style={{ display: "block", marginTop: 6 }}>
          آخر جلسة تحدّد حالة الشكوى ونتيجتها والمحال إليه (النتيجة إلى «نتيجة الشكوى» الداخلية فقط، لا إلى ما يراه المشتكي أو المعترض)؛ الحقل الفارغ لا يمسح قيمة الشكوى. الجلسات لا تُحذف، ويمكن تعديلها.
        </small>
      </form>
      )}
    </div>
  );
}

// تبويب «الجلسات»: كل الجلسات (اليوم / القادمة / السابقة / الكل) مع بحث؛ الضغط على صف يفتح شكواه
function AdminSessions({ secret, version, onOpen }) {
  // الجلسات، التصفية، البحث، والخطأ
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState("today");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // جلب كل الجلسات (يُعاد عند إضافة أو حذف جلسة من نافذة الشكوى)
  const load = useCallback(async () => {
    setError("");
    const { data, error } = await sb.rpc("admin_list_sessions", { p_secret: secret, p_complaint_id: null });
    if (error) { setList([]); return setError(NET_ERR); }
    setList(data || []);
  }, [secret]);
  useEffect(() => { load(); }, [load, version]);

  // التصفية حسب الفترة، ثم البحث بالرقم أو الاسم أو الجهة أو النتيجة؛ القادمة مرتّبة من الأقرب
  const now = new Date(), sod = new Date(now); sod.setHours(0, 0, 0, 0);
  const eod = new Date(sod); eod.setDate(eod.getDate() + 1);
  const inFilter = s => {
    const t = new Date(s.session_at);
    return filter === "today" ? t >= sod && t < eod : filter === "upcoming" ? t >= now : filter === "past" ? t < now : true;
  };
  const term = search.trim();
  let visible = (list || []).filter(s => inFilter(s) &&
    (!term || [s.complaint_number, s.complainant_name, s.title, s.topic, s.referred_to, s.result].some(v => (v || "").includes(term))));
  if (filter === "upcoming") visible = [...visible].sort((a, b) => new Date(a.session_at) - new Date(b.session_at));
  const count = f => (list || []).filter(s => { const t = new Date(s.session_at);
    return f === "today" ? t >= sod && t < eod : f === "upcoming" ? t >= now : f === "past" ? t < now : true; }).length;

  // العرض: أزرار التصفية مع الأعداد، البحث، ثم جدول الجلسات
  return (
    <div>
      <div className="chips">
        {[["today", "اليوم"], ["upcoming", "القادمة"], ["past", "السابقة"], ["all", "الكل"]].map(([k, t]) => (
          <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{t} ({count(k)})</button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="grow" type="text" placeholder="بحث برقم الشكوى أو الاسم أو عنوان الجلسة أو النتيجة…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn secondary" onClick={() => { setList(null); load(); }}>🔄 تحديث</button>
      </div>
      <p className="muted" style={{ fontSize: 13.5, marginTop: 0 }}>لإضافة جلسة: افتح الشكوى من تبويب «الشكاوى» ثم قسم «الجلسات» أسفلها. اضغط على أي صف هنا لفتح شكواه.</p>
      {error && <Alert type="error">{error}</Alert>}
      <div className="card" style={{ padding: 0 }}>
        {list === null ? <Loading /> : visible.length === 0 ? <div className="empty">لا توجد جلسات</div> : (
          <div className="table-wrap">
            <table className="sheet">
              <thead><tr><th>رقم الشكوى</th><th>المشتكي</th><th>التاريخ والوقت</th><th>عنوان الجلسة</th><th>ترحيل / مُحالة إلى</th><th>نتيجة الجلسة</th><th>حالة الشكوى</th></tr></thead>
              <tbody>
                {visible.map(s => (
                  <tr key={s.id} className={`status-row ${stClass(s.status)}`} onClick={() => onOpen({ id: s.complaint_id })}>
                    <td><b dir="ltr">{s.complaint_number}</b></td>
                    <td>{s.complainant_name}</td>
                    <td>{fmtDateTime(s.session_at)}</td>
                    <td><b>{s.title || <span className="muted">—</span>}</b></td>
                    <td>{s.referred_to || <span className="muted">—</span>}</td>
                    <td className="wrap"><span className="clip">{s.result || "—"}</span></td>
                    <td><StatusBadge value={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// القرارات الإدارية: قائمة القرارات مع بحث متقدم وتصفية بالتصنيف والتاريخ وفرز؛ الضغط على قرار يعرض
// تفاصيله ورابطه. المدير يضيف ويعدّل ويحذف، والموظف يطّلع ويبحث فقط
// ---------------------------------------------------------------------
// أعمدة الفرز: المفتاح، العنوان، وقيمة المقارنة
const DECISION_SORTS = {
  number: { label: "رقم القرار", get: d => d.decision_number || "" },
  date: { label: "التاريخ", get: d => d.decision_date || "" },
  title: { label: "العنوان", get: d => d.title || "" },
  classification: { label: "التصنيف", get: d => d.classification || "" },
};

function AdminDecisions({ secret, isManager }) {
  // القرارات، أدوات البحث والتصفية والفرز، القرار المعروض، نموذج الإضافة/التعديل، والرسائل
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [klass, setKlass] = useState("");
  const [adv, setAdv] = useState(false);                        // لوحة البحث المتقدم
  const [field, setField] = useState("all");                    // البحث في: الكل / الرقم / العنوان / الموضوع
  const [range, setRange] = useState({ from: "", to: "" });
  const [sort, setSort] = useState({ key: "date", dir: -1 });
  const [shown, setShown] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب القرارات
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("admin_list_decisions", { p_secret: secret });
    if (error) { setList([]); return setMsg({ type: "error", text: "تعذّر جلب القرارات (نفّذ القسم 27 من schema.sql في Supabase)." }); }
    setList(data || []);
  }, [secret]);
  useEffect(() => { load(); }, [load]);

  // البحث (في كل الحقول أو حقل محدد) ← التصنيف ← الفترة ← الفرز (الأرقام تُفرز كأرقام)
  const term = q.trim();
  const inField = d => field === "number" ? [d.decision_number] : field === "title" ? [d.title] : field === "subject" ? [d.subject]
    : [d.decision_number, d.title, d.subject, d.classification];
  const base = (list || []).filter(d =>
    (!term || inField(d).some(v => (v || "").includes(term))) &&
    (!range.from || (d.decision_date || "") >= range.from) &&
    (!range.to || ((d.decision_date || "") !== "" && d.decision_date <= range.to)));
  const count = k => base.filter(d => !k || d.classification === k).length;
  const visible = base.filter(d => !klass || d.classification === klass).sort((a, b) =>
    DECISION_SORTS[sort.key].get(a).localeCompare(DECISION_SORTS[sort.key].get(b), "ar", { numeric: true }) * sort.dir);
  const classes = [...new Set([...DECISION_CLASSES, ...(list || []).map(d => d.classification)].filter(Boolean))];

  // الضغط على عنوان عمود: فرز تصاعدي ← تنازلي
  const toggleSort = key => setSort(s => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const arrow = key => sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "";

  // نموذج فارغ، أو تعبئته من قرار للتعديل
  const blank = () => ({ id: null, number: "", date: toDateInput(new Date()), title: "", subject: "", url: "", classification: "" });
  const editOf = d => ({ id: d.id, number: d.decision_number, date: d.decision_date || "", title: d.title, subject: d.subject || "", url: d.url || "", classification: d.classification || "" });
  const setF = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  // الحفظ عبر admin_save_decision (إضافة أو تعديل)
  async function save(e) {
    e.preventDefault();
    if (!form.number.trim() || !form.title.trim()) return setMsg({ type: "error", text: "رقم القرار وعنوانه إلزاميان." });
    if (form.url.trim() && !/^https?:\/\//i.test(form.url.trim())) return setMsg({ type: "error", text: "الرابط يجب أن يبدأ بـ https://" });
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_save_decision", {
      p_secret: secret, p_id: form.id, p_number: form.number, p_date: form.date || null, p_title: form.title,
      p_subject: form.subject, p_url: form.url, p_classification: form.classification,
    });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر الحفظ، يرجى المحاولة مرة أخرى." });
    setMsg({ type: "ok", text: form.id ? "✅ تم تعديل القرار." : "✅ أُضيف القرار." });
    setForm(null); setShown(data[0]); load();
  }

  // حذف قرار بعد التأكيد
  async function remove(d) {
    if (!window.confirm(`حذف القرار رقم ${d.decision_number}؟`)) return;
    const { data } = await sb.rpc("admin_delete_decision", { p_secret: secret, p_id: d.id });
    if (!data) return setMsg({ type: "error", text: "تعذّر الحذف." });
    setShown(null); setMsg({ type: "ok", text: "حُذف القرار." }); load();
  }

  // تصدير القرارات الظاهرة إلى Excel (مقفول للعرض فقط)
  function exportXl() {
    saveWorkbook([{ name: "القرارات الإدارية", headers: ["رقم القرار", "التاريخ", "العنوان", "التصنيف", "الموضوع", "الرابط"],
      rows: visible.map(d => [d.decision_number, d.decision_date, d.title, d.classification, d.subject, d.url]) }],
      `القرارات-الإدارية-${toDateInput(new Date())}.xlsx`).catch(e => setMsg({ type: "error", text: e.message || NET_ERR }));
  }

  // العرض: أزرار الإضافة والتصدير، البحث والبحث المتقدم، شرائح التصنيفات، الجدول، ثم نافذتا التفاصيل والنموذج
  return (
    <div>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      <div className="row" style={{ marginBottom: 10 }}>
        {isManager && <button type="button" className="btn" onClick={() => { setForm(blank()); setMsg(null); }}>➕ إضافة قرار</button>}
        <button type="button" className="btn secondary" disabled={!visible.length} onClick={exportXl}>⬇ تصدير Excel</button>
      </div>
      <div className="row" style={{ flexWrap: "nowrap", marginBottom: 8 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ابحث برقم القرار أو العنوان أو الموضوع" />
        <button type="button" className={`btn ${adv ? "" : "secondary"}`} onClick={() => setAdv(v => !v)}>⚙️ بحث متقدم</button>
      </div>
      {adv && (
        <div className="card adv-search">
          <div className="grid">
            <Field label="البحث في">
              <select value={field} onChange={e => setField(e.target.value)}>
                <option value="all">كل الحقول</option>
                <option value="number">رقم القرار</option>
                <option value="title">العنوان</option>
                <option value="subject">الموضوع</option>
              </select>
            </Field>
            <Field label="التصنيف">
              <select value={klass} onChange={e => setKlass(e.target.value)}>
                <option value="">كل التصنيفات</option>
                {classes.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="من تاريخ"><input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></Field>
            <Field label="إلى تاريخ"><input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></Field>
            <Field label="الترتيب حسب">
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <select value={sort.key} onChange={e => setSort(s => ({ ...s, key: e.target.value }))}>
                  {Object.keys(DECISION_SORTS).map(k => <option key={k} value={k}>{DECISION_SORTS[k].label}</option>)}
                </select>
                <select value={sort.dir} onChange={e => setSort(s => ({ ...s, dir: Number(e.target.value) }))}>
                  <option value={-1}>تنازلي</option>
                  <option value={1}>تصاعدي</option>
                </select>
              </div>
            </Field>
          </div>
          <button type="button" className="btn danger-text" style={{ marginTop: 8 }}
            onClick={() => { setQ(""); setField("all"); setKlass(""); setRange({ from: "", to: "" }); setSort({ key: "date", dir: -1 }); }}>مسح كل التصفيات</button>
        </div>
      )}
      <div className="chips">
        <button className={!klass ? "active" : ""} onClick={() => setKlass("")}>الكل ({count("")})</button>
        {classes.map(k => <button key={k} className={klass === k ? "active" : ""} onClick={() => setKlass(k)}>{k} ({count(k)})</button>)}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {list === null ? <Loading /> : visible.length === 0 ? <div className="empty">لا توجد قرارات{term || klass || range.from || range.to ? " مطابقة" : ""}</div> : (
          <div className="table-wrap">
            <table className="sheet">
              <thead><tr>
                {Object.keys(DECISION_SORTS).map(k => <th key={k} className="sortable" onClick={() => toggleSort(k)}>{DECISION_SORTS[k].label}{arrow(k)}</th>)}
                <th>الموضوع</th><th>الرابط</th>
              </tr></thead>
              <tbody>
                {visible.map(d => (
                  <tr key={d.id} className="clickable" onClick={() => setShown(d)}>
                    <td><b dir="ltr">{d.decision_number}</b></td>
                    <td>{d.decision_date ? fmtDate(d.decision_date) : "—"}</td>
                    <td><b>{d.title}</b></td>
                    <td>{d.classification ? <span className="badge dec-tag">{d.classification}</span> : "—"}</td>
                    <td className="wrap"><span className="clip">{d.subject || "—"}</span></td>
                    <td>{d.url ? <a href={d.url} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}>🔗 فتح</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {list && list.length > 0 && <p className="muted center" style={{ fontSize: 13 }}>{visible.length} من {list.length} قرار · اضغط على أي قرار لعرض تفاصيله</p>}

      {shown && !form && (
        <div className="modal-back" onClick={() => setShown(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-close"><button className="btn secondary sm" onClick={() => setShown(null)}>✕ إغلاق</button></div>
            <div className="card">
              <div className="c-head">
                <div><div className="c-no">📑 قرار رقم {shown.decision_number}</div>
                  <div className="meta"><span>📅 {shown.decision_date ? fmtDate(shown.decision_date) : "بلا تاريخ"}</span></div></div>
                {shown.classification && <span className="badge dec-tag">{shown.classification}</span>}
              </div>
              <div className="c-title" style={{ marginTop: 0 }}>{shown.title}</div>
              <div className="field-label" style={{ marginTop: 10 }}>موضوع القرار</div>
              <div className="subject">{shown.subject || <span className="muted">—</span>}</div>
              {shown.url && <a className="btn block" href={shown.url} target="_blank" rel="noopener" style={{ marginTop: 12 }}>🔗 فتح القرار</a>}
              {isManager && (
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
                  <button type="button" className="btn secondary" onClick={() => { setForm(editOf(shown)); setMsg(null); }}>✏️ تعديل</button>
                  <button type="button" className="btn secondary" style={{ color: "var(--danger)" }} onClick={() => remove(shown)}>🗑️ حذف</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="modal-back" onClick={() => setForm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-close"><button className="btn secondary sm" onClick={() => setForm(null)}>✕ إغلاق</button></div>
            <form className="card" onSubmit={save}>
              <h2>{form.id ? "✏️ تعديل قرار" : "➕ قرار إداري جديد"}</h2>
              {msg && msg.type === "error" && <Alert type="error">{msg.text}</Alert>}
              <div className="grid">
                <Field label="رقم القرار الإداري" required><input type="text" dir="ltr" value={form.number} onChange={setF("number")} maxLength={60} /></Field>
                <Field label="تاريخ القرار"><input type="date" value={form.date} onChange={setF("date")} /></Field>
                <Field label="عنوان القرار" required full><input type="text" value={form.title} onChange={setF("title")} maxLength={300} /></Field>
                <Field label="التصنيف">
                  <select value={form.classification} onChange={setF("classification")}>
                    <option value="">— اختر —</option>
                    {classes.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </Field>
                <Field label="رابط القرار" hint="رابط ملف القرار على Drive أو غيره">
                  <input type="url" dir="ltr" value={form.url} onChange={setF("url")} maxLength={1000} placeholder="https://" />
                </Field>
                <Field label="موضوع القرار" full><textarea style={{ minHeight: 100 }} value={form.subject} onChange={setF("subject")} maxLength={5000} /></Field>
              </div>
              <button className="btn block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ الحفظ…" : "💾 حفظ القرار"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// تبويب الروابط: كل روابط المنصة في مكان واحد، مع رسالة جاهزة للنسخ لكل من يتواصل
//   مشتكٍ ← الرابط + كلمة المرور (خاصة تُولَّد بضغطة، أو العامة المحفوظة)
//   الإدارة ← رابط التقارير + كلمة مرور الشخص المختار
// ---------------------------------------------------------------------
function AdminLinks({ secret, isManager = true }) {
  // إعدادات الدخول، أصحاب كلمات مرور الإدارة، ملاحظة المشتكي، الشخص المختار، الرسالة الجاهزة، والحالة
  const [access, setAccess] = useState(null);
  const [viewers, setViewers] = useState(null);
  const [note, setNote] = useState("");
  const [viewerId, setViewerId] = useState("");
  const [ready, setReady] = useState(null);      // { title, text, copied }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // جلب نوع كلمة مرور المشتكين وقائمة كلمات مرور الإدارة الفعّالة
  useEffect(() => {
    sb.rpc("admin_get_access", { p_secret: secret }).then(({ data, error }) => {
      if (error || !data || !data.length) return setErr(NET_ERR);
      setAccess(data[0]);
    });
    if (isManager) sb.rpc("admin_list_viewers", { p_secret: secret }).then(({ data }) => setViewers((data || []).filter(v => v.active)));
  }, [secret, isManager]);

  // تجهيز الرسالة: تظهر في مربع أعلى الصفحة (مع الصعود إليه)، وتُنسخ مباشرة
  // (وإن منع المتصفح النسخ يبقى زر «نسخ مرة أخرى» في المربع)
  async function prepare(title, text) {
    const copied = await copyText(text);
    setReady({ title, text, copied });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // مشتكٍ بكلمة مرور خاصة: توليد كلمة جديدة (4 أرقام لمرة واحدة) ثم تجهيز رسالتها
  async function forComplainant() {
    setErr("");
    if (access.mode === "general") {
      if (!access.general_password) return setErr("لم تُحفظ كلمة مرور عامة بعد (تبويب «دخول المشتكين»).");
      return prepare("رسالة المشتكي", `لتقديم شكوى إلى إدارة الحج والعمرة (قسم الشكاوى) افتح الرابط:\n${siteUrl()}\nكلمة المرور: ${access.general_password}`);
    }
    setBusy(true);
    const { data, error } = await sb.rpc("admin_create_code", { p_secret: secret, p_note: note });
    setBusy(false);
    if (error || !data || !data.length) return setErr("تعذّر توليد كلمة المرور، يرجى المحاولة مرة أخرى.");
    setNote("");
    prepare(`رسالة المشتكي — كلمة المرور ${data[0].code}`, `لتقديم شكواك إلى إدارة الحج والعمرة (قسم الشكاوى) افتح الرابط:\n${siteUrl()}\nكلمة المرور الخاصة بك: ${data[0].code}`);
  }

  // الإدارة: رابط التقارير مع كلمة مرور الشخص المختار
  function forViewer() {
    setErr("");
    const v = (viewers || []).find(x => x.id === viewerId);
    if (!v) return setErr("اختر الشخص أولاً.");
    prepare(`رسالة التقارير — ${v.name}`, `رابط تقارير قسم الشكاوى — إدارة الحج والعمرة:\n${siteUrl()}#/reports\nكلمة المرور الخاصة بك: ${v.code}`);
  }

  // الروابط الأخرى (نسخ الرابط وحده)
  const OTHER = [
    ["📝 صفحة تقديم الشكوى", siteUrl()],
    ["🔎 صفحة نتيجة الشكوى", `${siteUrl()}#/result`],
    ["⚖️ صفحة الاعتراض", `${siteUrl()}#/objection`],
    ["📊 صفحة التقارير", `${siteUrl()}#/reports`],
    ["🛠️ صفحة الأدمن (لك فقط)", `${siteUrl()}#/admin`],
  ];

  // العرض: الرسالة الجاهزة أعلى الصفحة، ثم بطاقة المشتكي، بطاقة الإدارة، وقائمة الروابط
  if (!access) return err ? <Alert type="error">{err}</Alert> : <Loading />;
  return (
    <div>
      {err && <Alert type="error">{err}</Alert>}
      {ready && (
        <div className="card ready-msg">
          <h2>{ready.copied ? "✅ تم نسخ الرسالة — الصقها في المحادثة" : "📋 الرسالة جاهزة"}</h2>
          <div className="muted" style={{ marginBottom: 6 }}>{ready.title}</div>
          <textarea readOnly rows={4} value={ready.text} onFocus={e => e.target.select()} />
          <button type="button" className="btn secondary block" style={{ marginTop: 8 }}
            onClick={async () => { const copied = await copyText(ready.text); setReady(r => ({ ...r, copied })); }}>
            📋 نسخ مرة أخرى
          </button>
        </div>
      )}

      <div className="card">
        <h2>👤 تواصل معي شخص يريد تقديم شكوى</h2>
        {access.mode === "general" ? (
          <p className="muted">الوضع الحالي: كلمة مرور عامة — تُرسل له الرابط مع الكلمة العامة.</p>
        ) : (
          <Field label="لمن؟ (اختياري)" hint="اسم الشخص أو رقمه، للتذكير في قائمة كلمات المرور">
            <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
          </Field>
        )}
        <button type="button" className="btn gold block" style={{ marginTop: 12 }} disabled={busy} onClick={forComplainant}>
          {busy ? "جارٍ التوليد…" : access.mode === "general" ? "📋 نسخ الرابط مع كلمة المرور" : "🔑 توليد كلمة مرور ونسخ الرسالة"}
        </button>
      </div>

      {isManager && <div className="card">
        <h2>🏢 تواصلت معي الإدارة (رابط التقارير)</h2>
        {viewers === null ? <Loading /> : viewers.length === 0 ? (
          <p className="muted">لا توجد كلمات مرور إدارة فعّالة. أضف الشخص أولاً من «كلمات مرور الإدارة» في الرئيسية.</p>
        ) : (
          <>
            <Field label="الشخص">
              <select value={viewerId} onChange={e => setViewerId(e.target.value)}>
                <option value="">— اختر —</option>
                {viewers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <button type="button" className="btn gold block" style={{ marginTop: 12 }} onClick={forViewer}>📋 نسخ رابط التقارير مع كلمة المرور</button>
          </>
        )}
      </div>}

      <div className="card">
        <h2>🔗 روابط المنصة</h2>
        <ul className="list">
          {OTHER.map(([t, u]) => (
            <li key={u}>
              <div style={{ minWidth: 0 }}>
                <b>{t}</b>
                <div className="muted link-url" dir="ltr">{u}</div>
              </div>
              <button type="button" className="btn secondary sm" onClick={() => prepare(t, u)}>📋 نسخ</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// تبويب دخول المشتكين: نوع كلمة المرور (عامة / خاصة)، مفتاح زر التقديم المباشر، وإدارة كلمات المرور
// ---------------------------------------------------------------------
function AdminAccess({ secret }) {
  // الإعدادات المحفوظة، النوع المختار، كلمة المرور العامة، زر المباشر، والرسائل
  const [saved, setSaved] = useState(null);
  const [mode, setMode] = useState("private");
  const [general, setGeneral] = useState("");
  const [direct, setDirect] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب الإعدادات الحالية
  useEffect(() => {
    sb.rpc("admin_get_access", { p_secret: secret }).then(({ data, error }) => {
      if (error || !data || !data.length) return setMsg({ type: "error", text: NET_ERR });
      setSaved(data[0]); setMode(data[0].mode); setGeneral(data[0].general_password || ""); setDirect(!!data[0].direct);
    });
  }, [secret]);

  // حفظ النوع وكلمة المرور العامة وزر المباشر
  async function save() {
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_access", {
      p_secret: secret, p_mode: mode, p_general_password: mode === "general" || general.trim() ? general.trim() : null, p_direct: null,
    });
    setBusy(false);
    if (error) return setMsg({ type: "error", text: error.message.includes("4") ? "كلمة المرور العامة يجب ألا تقل عن 4 أحرف أو أرقام." : "تعذّر الحفظ، يرجى المحاولة مرة أخرى." });
    setSaved(data[0]);
    setMsg({ type: "ok", text: "تم حفظ إعدادات الدخول." });
  }

  // مفتاح زر التقديم المباشر: يُحفظ فوراً عند الضغط (دون انتظار زر «حفظ»)
  async function toggleDirect(on) {
    setDirect(on); setMsg(null);
    const { data, error } = await sb.rpc("admin_set_access", { p_secret: secret, p_mode: null, p_general_password: null, p_direct: on });
    if (error || !data || !data.length) { setDirect(!on); return setMsg({ type: "error", text: "تعذّر حفظ المفتاح، يرجى المحاولة مرة أخرى." }); }
    setSaved(data[0]);
    setMsg({ type: "ok", text: on ? "تم الحفظ: زر «تقديم شكوى مباشرة» ظاهر الآن للمشتكين." : "تم الحفظ: زر «تقديم شكوى مباشرة» مخفي الآن." });
  }

  // توليد كلمة مرور عامة عشوائية من 6 أرقام
  const generate = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); setGeneral(String(a[0] % 1000000).padStart(6, "0")); };

  // خيارات نوع كلمة المرور
  const MODES = [
    ["general", "🔑 كلمة مرور عامة", "كلمة واحدة للجميع، تغيّرها متى شئت"],
    ["private", "🔐 كلمة مرور خاصة", "4 أرقام لكل شخص، تُستخدم مرة واحدة"],
  ];

  // العرض: مفتاح زر المباشر، بطاقات النوع، كلمة المرور العامة (عند اختيارها)، زر الحفظ، ثم الكلمات الخاصة
  if (!saved) return msg ? <Alert type={msg.type}>{msg.text}</Alert> : <Loading />;
  return (
    <div>
      <div className="card">
        <h2>دخول المشتكين</h2>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}
        <label className={`switch-row ${direct ? "on" : ""}`}>
          <input type="checkbox" checked={direct} onChange={e => toggleDirect(e.target.checked)} />
          <span className="switch" aria-hidden="true"></span>
          <span>
            <b>إظهار زر «📝 تقديم شكوى مباشرة»</b>
            <small className="muted" style={{ display: "block" }}>{direct ? "ظاهر: يستطيع أي زائر التقديم بلا كلمة مرور" : "مخفي: لا يقدّم إلا من لديه كلمة مرور"}</small>
          </span>
        </label>
        <div className="field-label" style={{ margin: "14px 0 8px" }}>نوع كلمة المرور في الصفحة الأولى</div>
        <div className="modes">
          {MODES.map(([k, t, d]) => (
            <button key={k} type="button" className={`mode ${mode === k ? "active" : ""}`} onClick={() => { setMode(k); setMsg(null); }}>
              <b>{t}{saved.mode === k && <span className="muted" style={{ fontSize: 12.5 }}> · الحالي</span>}</b><span>{d}</span>
            </button>
          ))}
        </div>
        {mode === "general" && (
          <div style={{ marginTop: 14 }}>
            <Field label="كلمة المرور العامة" hint="4 أحرف أو أرقام على الأقل؛ تغييرها يوقف القديمة فوراً">
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input type="text" dir="ltr" className="code-input" style={{ fontSize: 20 }} value={general} onChange={e => setGeneral(e.target.value)} maxLength={30} />
                <button type="button" className="btn secondary" onClick={generate}>🎲 توليد</button>
              </div>
            </Field>
            {saved.general_password && (
              <button type="button" className="btn secondary sm" style={{ marginTop: 10 }}
                onClick={async () => setMsg(await copyText(`لتقديم شكوى إلى إدارة الحج والعمرة (قسم الشكاوى) افتح الرابط:\n${siteUrl()}\nكلمة المرور: ${saved.general_password}`) ? { type: "ok", text: "تم نسخ الرابط وكلمة المرور." } : { type: "error", text: "تعذّر النسخ." })}>
                📋 نسخ الرابط مع كلمة المرور المحفوظة
              </button>
            )}
          </div>
        )}
        <button className="btn block" style={{ marginTop: 16 }} disabled={busy} onClick={() => save()}>{busy ? "جارٍ الحفظ…" : "حفظ نوع كلمة المرور"}</button>
      </div>
      {saved.mode === "private" && <AdminCodes secret={secret} />}
      {mode === "private" && saved.mode !== "private" && <Alert type="info">احفظ الوضع «كلمة مرور خاصة» لتظهر أدوات توليد كلمات المرور.</Alert>}
    </div>
  );
}

// كلمات المرور الخاصة: توليد كلمة لشخص، نسخ رسالتها، وقائمة الكلمات السابقة
function AdminCodes({ secret }) {
  // الملاحظة (لمن؟)، الكلمة المولّدة الأخيرة، القائمة، والرسائل
  const [note, setNote] = useState("");
  const [created, setCreated] = useState(null);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب آخر 100 كلمة مرور
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("admin_list_codes", { p_secret: secret });
    if (error) return setMsg({ type: "error", text: NET_ERR });
    setList(data || []);
  }, [secret]);
  useEffect(() => { load(); }, [load]);

  // توليد كلمة مرور جديدة (4 أرقام، لمرة واحدة)
  async function generate(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_create_code", { p_secret: secret, p_note: note });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر التوليد، يرجى المحاولة مرة أخرى." });
    setCreated({ code: data[0].code, note: note.trim() });
    setNote("");
    load();
  }

  // إلغاء كلمة مرور لم تُستخدم
  async function remove(id) {
    const { data } = await sb.rpc("admin_delete_code", { p_secret: secret, p_id: id });
    if (data) load();
  }

  // نص الرسالة للمشتكي
  const text = c => `لتقديم شكواك إلى إدارة الحج والعمرة (قسم الشكاوى) افتح الرابط:\n${siteUrl()}\nكلمة المرور الخاصة بك: ${c}`;

  // العرض: نموذج التوليد، الكلمة الجديدة وزر النسخ، ثم القائمة
  return (
    <div>
      <form className="card" onSubmit={generate}>
        <h2>كلمة مرور خاصة لمشتكٍ</h2>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}
        <Field label="لمن؟ (اختياري)" hint="اسم الشخص أو رقمه، للتذكير فقط">
          <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={200} />
        </Field>
        <button className="btn gold block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ التوليد…" : "🔑 توليد كلمة مرور"}</button>
        {created && (
          <div style={{ marginTop: 16 }}>
            <div className="muted center">كلمة المرور{created.note ? ` لـ ${created.note}` : ""}</div>
            <div className="big-code">{created.code}</div>
            <button type="button" className="btn secondary block" onClick={async () => setMsg(await copyText(text(created.code)) ? { type: "ok", text: "تم نسخ الرسالة." } : { type: "error", text: "تعذّر النسخ." })}>📋 نسخ الرسالة</button>
          </div>
        )}
      </form>
      <div className="card">
        <h2>كلمات المرور الخاصة السابقة</h2>
        {list === null ? <Loading /> : list.length === 0 ? <p className="muted">لا توجد كلمات مرور بعد.</p> : (
          <ul className="list">
            {list.map(r => (
              <li key={r.id}>
                <div>
                  <span className="mono">{r.code}</span> {r.note && <span className="muted">· {r.note}</span>}
                  <div className="muted" style={{ fontSize: 13 }}>
                    {r.used_at ? <>استُخدمت {fmtDate(r.used_at)} · شكوى <span dir="ltr">{r.complaint_number || "—"}</span></> : <>لم تُستخدم بعد · وُلّدت {fmtDate(r.created_at)}</>}
                  </div>
                </div>
                {r.used_at ? <span className="badge st-closed">مستخدمة</span> : <button className="btn danger-text" onClick={() => remove(r.id)}>إلغاء</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// تبويب كلمات مرور الإدارة (صفحة التقارير): إضافة شخص، نسخ رسالته، وإيقاف/تفعيل
// ---------------------------------------------------------------------
function AdminViewers({ secret }) {
  // اسم الشخص الجديد، الكلمة المولّدة الأخيرة، القائمة، والرسائل
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // جلب أصحاب كلمات المرور
  const load = useCallback(async () => {
    const { data, error } = await sb.rpc("admin_list_viewers", { p_secret: secret });
    if (error) return setMsg({ type: "error", text: NET_ERR });
    setList(data || []);
  }, [secret]);
  useEffect(() => { load(); }, [load]);

  // إضافة شخص وتوليد كلمة مروره
  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return setMsg({ type: "error", text: "يرجى كتابة اسم الشخص." });
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("admin_create_viewer", { p_secret: secret, p_name: name });
    setBusy(false);
    if (error || !data || !data.length) return setMsg({ type: "error", text: "تعذّر الإضافة، يرجى المحاولة مرة أخرى." });
    setCreated(data[0]);
    setName("");
    load();
  }

  // إيقاف كلمة مرور أو إعادة تفعيلها
  async function toggle(r) {
    const { data } = await sb.rpc("admin_set_viewer_active", { p_secret: secret, p_id: r.id, p_active: !r.active });
    if (data) load();
  }

  // نص الرسالة لصاحب كلمة المرور
  const text = r => `رابط تقارير قسم الشكاوى — إدارة الحج والعمرة:\n${siteUrl()}#/reports\nكلمة المرور الخاصة بك: ${r.code}`;

  // العرض: مفتاح بطاقة التقارير، نموذج الإضافة، الكلمة الجديدة وزر النسخ، ثم القائمة
  return (
    <div>
      <ReportCardSwitch secret={secret} />
      <form className="card" onSubmit={create}>
        <h2>كلمة مرور إدارة لشخص جديد</h2>
        {msg && <Alert type={msg.type}>{msg.text}</Alert>}
        <Field label="الاسم"><input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={200} /></Field>
        <button className="btn gold block" style={{ marginTop: 14 }} disabled={busy}>{busy ? "جارٍ الإضافة…" : "📊 توليد كلمة مرور"}</button>
        {created && (
          <div style={{ marginTop: 16 }}>
            <div className="muted center">كلمة مرور {created.name}</div>
            <div className="big-code">{created.code}</div>
            <button type="button" className="btn secondary block" onClick={async () => setMsg(await copyText(text(created)) ? { type: "ok", text: "تم نسخ الرسالة." } : { type: "error", text: "تعذّر النسخ." })}>📋 نسخ الرسالة</button>
          </div>
        )}
      </form>
      <div className="card">
        <h2>أصحاب كلمات مرور الإدارة</h2>
        {list === null ? <Loading /> : list.length === 0 ? <p className="muted">لم تُضف أي شخص بعد.</p> : (
          <ul className="list">
            {list.map(r => (
              <li key={r.id}>
                <div>
                  <b>{r.name}</b> · <span className="mono">{r.code}</span>
                  <div className="muted" style={{ fontSize: 13 }}>آخر دخول: {fmtDateTime(r.last_seen_at)}</div>
                </div>
                <button className={`btn sm ${r.active ? "secondary" : ""}`} onClick={() => toggle(r)}>{r.active ? "إيقاف" : "تفعيل"}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// مفتاح «إظهار بطاقة الشكوى في التقارير» (للاطلاع فقط): يُحفظ فوراً عند الضغط
function ReportCardSwitch({ secret }) {
  // الحالة المحفوظة (null = قيد التحميل) والرسالة
  const [on, setOn] = useState(null);
  const [msg, setMsg] = useState(null);

  // جلب الحالة الحالية
  useEffect(() => {
    sb.rpc("admin_get_report_card", { p_secret: secret }).then(({ data, error }) => {
      if (error) return setMsg({ type: "error", text: NET_ERR });
      setOn(data === true);
    });
  }, [secret]);

  // الحفظ عند الضغط؛ يعود المفتاح لوضعه إن فشل الحفظ
  async function toggle(v) {
    setOn(v); setMsg(null);
    const { error } = await sb.rpc("admin_set_report_card", { p_secret: secret, p_on: v });
    if (error) { setOn(!v); return setMsg({ type: "error", text: "تعذّر حفظ المفتاح، يرجى المحاولة مرة أخرى." }); }
    setMsg({ type: "ok", text: v ? "تم الحفظ: أصحاب كلمات مرور الإدارة يرون بطاقة الشكوى (للاطلاع فقط)." : "تم الحفظ: بطاقة الشكوى مخفية في التقارير." });
  }

  // العرض: بطاقة فيها المفتاح ووصف حالته
  return (
    <div className="card">
      <h2>بطاقة الشكوى في التقارير</h2>
      {msg && <Alert type={msg.type}>{msg.text}</Alert>}
      {on === null ? (!msg && <Loading />) : (
        <label className={`switch-row ${on ? "on" : ""}`}>
          <input type="checkbox" checked={on} onChange={e => toggle(e.target.checked)} />
          <span className="switch" aria-hidden="true"></span>
          <span>
            <b>إظهار بطاقة الشكوى في التقارير 👁️</b>
            <small className="muted" style={{ display: "block" }}>{on ? "ظاهرة: الضغط على شكوى في التقارير يعرض تفاصيلها وجلساتها وسجلها للاطلاع فقط" : "مخفية: التقارير تعرض الجدول والأعداد فقط"}</small>
          </span>
        </label>
      )}
    </div>
  );
}

// =====================================================================
// الصفحة 4: التقارير (‎#/reports)
// =====================================================================
// أعداد الشكاوى خلال فترة + جدول الشكاوى
function ReportsPage({ code, viewerName }) {
  // الفترة (افتراضياً من أول الشهر حتى اليوم)، البيانات، والخطأ
  const now = new Date();
  const [range, setRange] = useState({ from: "", to: "" });
  // الموسم: القائمة من الخادم، والمختار (يبدأ بالموسم الحالي؛ "" = كل المواسم)
  const [seasonInfo, setSeasonInfo] = useState(null);
  const [season, setSeason] = useState(null);
  useEffect(() => {
    sb.rpc("viewer_seasons", { p_code: code }).then(({ data }) => {
      setSeasonInfo(data || { current: "", seasons: [] });
      setSeason(data && data.current ? data.current : "");
    });
  }, [code]);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  // بطاقة الشكوى: هل سمح الأدمن بعرضها؟ ورقم الشكوى المفتوحة
  const [cardOn, setCardOn] = useState(false);
  const [openNum, setOpenNum] = useState(null);
  const [viewing, setViewing] = useState(false);   // نافذة استعراض نسخة محفوظة
  useEffect(() => {
    sb.rpc("viewer_card_enabled", { p_code: code }).then(({ data }) => setCardOn(data === true));
  }, [code]);

  // جلب شكاوى الفترة عبر viewer_report؛ نهاية الفترة تشمل اليوم الأخير كاملاً
  const load = useCallback(async () => {
    setError("");
    if (range.from && range.to && range.from > range.to) return setError("تاريخ البداية يجب أن يسبق تاريخ النهاية.");
    if (season === null) return;
    setRows(null);
    const pFrom = range.from ? new Date(`${range.from}T00:00:00`).toISOString() : null;
    let pTo = null;
    if (range.to) { const d = new Date(`${range.to}T00:00:00`); d.setDate(d.getDate() + 1); pTo = d.toISOString(); }
    let { data, error } = await sb.rpc("viewer_report", { p_code: code, p_from: pFrom, p_to: pTo, p_season: season || null });
    // قاعدة لم يُنفَّذ فيها القسم 21 بعد: النسخة القديمة بلا موسم
    if (error) ({ data, error } = await sb.rpc("viewer_report", { p_code: code, p_from: pFrom, p_to: pTo }));
    if (error) return setError(NET_ERR);
    setRows(data || []);
  }, [code, range, season]);
  useEffect(() => { load(); }, [load]);

  // أزرار الفترات السريعة
  function preset(kind) {
    const t = new Date();
    if (kind === "month") setRange({ from: toDateInput(new Date(t.getFullYear(), t.getMonth(), 1)), to: toDateInput(t) });
    if (kind === "30") { const f = new Date(t); f.setDate(f.getDate() - 29); setRange({ from: toDateInput(f), to: toDateInput(t) }); }
    if (kind === "all") setRange({ from: "", to: "" });
  }

  // الأعداد: الإجمالي، المغلقة، والمفتوحة (كل ما لم يُغلق)
  const total = rows ? rows.length : 0;
  const closed = rows ? rows.filter(r => isClosed(r.status)).length : 0;

  // العرض: الفلتر، بطاقات الأعداد، ثم الجدول (يتحول لبطاقات على الجوال)
  return (
    <div>
      <div className="page-head">
        <h1>تقارير الشكاوى</h1>
        <p>أهلاً {viewerName}</p>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filters">
          {seasonInfo && (
            <Field label="الموسم">
              <select value={season || ""} onChange={e => setSeason(e.target.value)}>
                <option value="">كل المواسم</option>
                {[...new Set([seasonInfo.current, ...seasonInfo.seasons].filter(Boolean))].map(x =>
                  <option key={x} value={x}>{x}{x === seasonInfo.current ? " (الحالي)" : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="من تاريخ"><input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /></Field>
          <Field label="إلى تاريخ"><input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></Field>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn secondary sm" onClick={() => preset("month")}>هذا الشهر</button>
          <button className="btn secondary sm" onClick={() => preset("30")}>آخر 30 يوماً</button>
          <button className="btn secondary sm" onClick={() => preset("all")}>كل الفترات</button>
          <button className="btn secondary sm" onClick={() => setViewing(true)}>📂 استعراض نسخة محفوظة</button>
        </div>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      {rows === null ? (!error && <Loading />) : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="label">إجمالي الشكاوى</div><div className="value">{total}</div></div>
            <div className="kpi closed"><div className="label">المغلقة</div><div className="value">{closed}</div></div>
            <div className="kpi open"><div className="label">المفتوحة</div><div className="value">{total - closed}</div></div>
          </div>
          <div className="card" style={{ padding: 0 }}>
            {rows.length === 0 ? <div className="empty">لا توجد شكاوى في هذه الفترة</div> : (
              <div className="table-wrap" style={{ maxHeight: "none" }}>
                <table className="stack">
                  <thead>
                    <tr><th>الحالة</th><th>رقم الشكوى</th><th>العنوان</th><th>التصنيف</th><th>اسم المشتكي</th><th>المشتكى عليه</th><th>الموضوع</th><th>النتيجة</th><th>تاريخ الإغلاق</th></tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.complaint_number} className={`status-row ${stClass(r.status)} ${cardOn ? "clickable" : ""}`}
                        onClick={cardOn ? () => setOpenNum(r.complaint_number) : undefined} title={cardOn ? "اضغط لعرض بطاقة الشكوى" : undefined}>
                        <td data-label="الحالة"><StatusBadge value={r.status} /></td>
                        <td data-label="رقم الشكوى"><b dir="ltr">{r.complaint_number}</b></td>
                        <td data-label="العنوان"><b>{r.title || "—"}</b></td>
                        <td data-label="التصنيف">{r.classification || "—"}</td>
                        <td data-label="اسم المشتكي"><NameRole name={r.complainant_name} role={r.complainant_role} /></td>
                        <td data-label="المشتكى عليه">{r.accused_name ? <NameRole name={r.accused_name} role={r.accused_role} /> : "—"}</td>
                        <td data-label="الموضوع" className="subj">{r.subject}</td>
                        <td data-label="النتيجة" className="subj">{r.result || "—"}</td>
                        <td data-label="تاريخ الإغلاق">{fmtDate(r.closed_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {cardOn && rows.length > 0 && <p className="muted center" style={{ fontSize: 13.5 }}>👁️ اضغط على أي شكوى لعرض بطاقتها (للاطلاع فقط)</p>}
          {rows.length > 0 && (
            <div className="center" style={{ marginTop: 12 }}>
              <button className="btn secondary" onClick={() => saveWorkbook([{ name: "تقرير الشكاوى",
                headers: ["الموسم", "الحالة", "رقم الشكوى", "تاريخ الشكوى", "العنوان", "التصنيف", "اسم المشتكي", "صفة المشتكي", "المشتكى عليه", "صفة المشتكى عليه", "الموضوع", "النتيجة", "تاريخ الإغلاق"],
                rows: rows.map(r => [r.season, r.status, r.complaint_number, xlDate(r.received_date), r.title, r.classification, r.complainant_name, r.complainant_role, r.accused_name, r.accused_role, r.subject, r.result, xlDate(r.closed_date)]) }],
                `تقرير-الشكاوى-${season ? "موسم-" + season + "-" : ""}${range.from || "الكل"}-${range.to || ""}.xlsx`).catch(e => setError(e.message || NET_ERR))}>⬇ تصدير التقرير (Excel)</button>
            </div>
          )}
        </>
      )}
      {openNum && <ReportCard code={code} number={openNum} onClose={() => setOpenNum(null)} />}
      {viewing && <ExcelViewer onClose={() => setViewing(false)} />}
    </div>
  );
}

// بطاقة شكوى في التقارير (للاطلاع فقط): التفاصيل، الاعتراض، والجلسات — بلا أي تعديل
function ReportCard({ code, number, onClose }) {
  // بيانات البطاقة ورسالة الخطأ
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");

  // جلب البطاقة عبر viewer_complaint_card (لا شيء إن أوقف الأدمن البطاقات)
  useEffect(() => {
    sb.rpc("viewer_complaint_card", { p_code: code, p_number: number }).then(({ data, error }) => {
      if (error) return setError(NET_ERR);
      if (!data) return setError("عرض بطاقة الشكوى غير متاح حالياً.");
      setCard(data);
    });
  }, [code, number]);

  // سطر بيانات: عنوان وقيمة
  const Row = ({ label, children }) => <div><dt>{label}</dt><dd>{children || <span className="muted">—</span>}</dd></div>;
  const c = card && card.complaint;

  // العرض: نافذة فوق الصفحة فيها البطاقة للقراءة فقط
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-close"><button className="btn secondary sm" onClick={onClose}>✕ إغلاق</button></div>
        {error ? <Alert type="error">{error}</Alert> : !card ? <div className="card"><Loading /></div> : (
          <div className={`card status-card ${stClass(c.status)}`}>
            <div className="c-head">
              <div>
                <div className="c-no">{c.complaint_number}</div>
                <div className="meta"><span>📅 {fmtDateTime(c.received_date)}</span><span className="readonly-tag">👁️ للاطلاع فقط</span></div>
              </div>
              <StatusBadge value={c.status} />
            </div>
            <dl className="detail-grid">
              <Row label="اسم المشتكي">{c.complainant_name}</Row>
              <Row label="صفة المشتكي">{c.complainant_role}</Row>
              <Row label="رقم الهاتف"><span dir="ltr">{c.phone_number}</span></Row>
              <Row label="واتس / تلغرام"><span dir="ltr">{c.contact_number}</span></Row>
              <Row label="المشتكى عليه">{c.accused_name}</Row>
              <Row label="صفة المشتكى عليه">{c.accused_role}</Row>
              <Row label="التصنيف">{c.classification}</Row>
              <Row label="ترحيل / مُحالة إلى">{c.referred_to}</Row>
              <Row label="تاريخ الإغلاق">{c.closed_date && fmtDate(c.closed_date)}</Row>
            </dl>
            {c.title && <div className="c-title" style={{ marginTop: 0, marginBottom: 8 }}>📝 {c.title}</div>}
            <div className="field-label">نص الشكوى</div>
            <div className="subject">{c.subject}</div>
            <div className="field-label">📋 نتيجة الشكوى</div>
            <div className="subject">{c.result || <span className="muted">لم تصدر بعد</span>}</div>
            <div className="field-label">👤 النتيجة التي يراها المشتكي</div>
            <div className="subject">{c.complainant_result || <span className="muted">—</span>}</div>
            <div className="field-label">⚖️ النتيجة التي يراها المعترض</div>
            <div className="subject">{c.accused_result || <span className="muted">—</span>}</div>
            {c.objection_at && (
              <div className="sessions">
                <h3>⚖️ اعتراض المشتكى عليه</h3>
                <div className="muted" style={{ fontSize: 13.5 }}>قُدّم في {fmtDateTime(c.objection_at)}</div>
                <div className="subject" style={{ marginTop: 6 }}>{c.objection_text}</div>
              </div>
            )}
            <div className="sessions">
              <h3>🗓️ الجلسات ({card.sessions.length})</h3>
              {card.sessions.length === 0 ? <p className="muted" style={{ margin: 0 }}>لا توجد جلسات.</p> : (
                <div className="table-wrap" style={{ maxHeight: 280, border: "1px solid var(--line)" }}>
                  <table className="sheet">
                    <thead><tr><th>التاريخ والوقت</th><th>عنوان الجلسة</th><th>موضوع الجلسة</th><th>ترحيل / مُحالة إلى</th><th>نتيجة الجلسة</th><th>الحالة</th></tr></thead>
                    <tbody>
                      {card.sessions.map((s, i) => (
                        <tr key={i} className={`status-row ${stClass(s.status)}`} style={{ cursor: "default" }}>
                          <td>{fmtDateTime(s.session_at)}</td>
                          <td><b>{s.title || <span className="muted">—</span>}</b></td>
                          <td className="wrap">{s.topic || <span className="muted">—</span>}</td>
                          <td>{s.referred_to || <span className="muted">—</span>}</td>
                          <td className="wrap">{s.result || <span className="muted">—</span>}</td>
                          <td><StatusBadge value={s.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// التطبيق الرئيسي
// =====================================================================
// يختار الصفحة حسب الرابط: ‎#/admin، ‎#/reports، ‎#/result، وغير ذلك ← المشتكي
function App() {
  // الرابط الحالي، وكلمتا الأدمن والإدارة المحفوظتان للنافذة الحالية
  const hash = useHash();
  const readSaved = key => storeGet(sessionStorage, key) || storeGet(localStorage, key);
  const [adminSecret, setAdminSecret] = useState(() => readSaved("hajj_admin"));
  const [viewer, setViewer] = useState(() => { try { return JSON.parse(readSaved("hajj_viewer")); } catch { return null; } });

  // حفظ كلمات المرور أو حذفها عند الخروج
  // الحفظ: «تذكّرني» ← على الجهاز (يبقى بعد إغلاق المتصفح)، وإلا للنافذة الحالية فقط؛ الخروج يمسح الاثنين
  const keepValue = (key, value, remember) => {
    storeSet(sessionStorage, key, value); storeSet(localStorage, key, null);
    if (value != null && remember) storeSet(localStorage, key, value);
  };
  const setAdmin = (s, remember) => { keepValue("hajj_admin", s, remember); setAdminSecret(s); };
  const setView = (v, remember) => { keepValue("hajj_viewer", v ? JSON.stringify(v) : null, remember); setViewer(v); };

  // التحقق من كلمة مرور الأدمن عبر admin_login
  async function verifyAdmin(value) {
    const { data, error } = await sb.rpc("admin_login", { p_secret: value });
    if (error) return NET_ERR;
    return data === "ok" ? null : "كلمة مرور الأدمن غير صحيحة.";
  }

  // التحقق من كلمة مرور الإدارة عبر viewer_login (تُرجع اسم الشخص)
  let viewerName = "";
  async function verifyViewer(value) {
    const { data, error } = await sb.rpc("viewer_login", { p_code: value });
    if (error) return NET_ERR;
    if (!data || data === "LOCKED") return "كلمة المرور غير صحيحة أو موقوفة.";
    viewerName = data;
    return null;
  }

  // اختيار الصفحة والشريط العلوي
  let page, label = "", logout = null;
  if (!sb) page = <SetupNotice />;
  else if (hash === "#/admin") {
    label = "الأدمن";
    if (adminSecret) { page = <AdminPage secret={adminSecret} />; logout = () => setAdmin(null); }
    else page = <GatePage title="صفحة الأدمن" label="كلمة مرور الأدمن" secret account="admin" remember verify={verifyAdmin} onPass={setAdmin}
                  footer={cfg.ACTIVATE_URL && <div className="below-link"><a href={cfg.ACTIVATE_URL} target="_blank" rel="noopener">⚡ المنصة لا تعمل؟ تنشيط قاعدة البيانات</a></div>} />;
  } else if (hash === "#/reports") {
    label = "التقارير";
    if (viewer) { page = <ReportsPage code={viewer.code} viewerName={viewer.name} />; logout = () => setView(null); }
    else page = <GatePage title="تقارير الشكاوى" sub="أدخل كلمة مرور الإدارة الخاصة بك" label="كلمة مرور الإدارة" secret
                  account="reports" remember verify={verifyViewer} onPass={(code, remember) => setView({ code, name: viewerName }, remember)} />;
  } else if (hash === "#/result") { label = "نتيجة الشكوى"; page = <ResultPage />; }
  else if (hash === "#/objection") { label = "الاعتراض"; page = <ObjectionPage />; }
  else page = <ComplainantPage />;

  // العرض: الشريط العلوي ثم الصفحة المختارة
  return (
    <>
      <Header label={label} onLogout={logout} />
      <main className="container">{page}</main>
    </>
  );
}

// تشغيل التطبيق داخل العنصر ‎#root
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
