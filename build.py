# =======================================================================
#  الملف: build.py
#  المشروع: منصة الشكاوى — إدارة الحج والعمرة، قسم الشكاوى
#  الوصف: يحوّل كود التطبيق src/app.jsx (React/JSX) إلى app.js جاهز للتشغيل،
#         حتى لا يحتاج جوال المستخدم إلى تحويله في كل مرة يفتح فيها الصفحة (فتح أسرع بكثير).
#  طريقة الاستخدام:  python build.py
#  ماذا يفعل:
#    1) يقرأ src/app.jsx
#    2) يحوّله بمكتبة Babel داخل متصفح Edge (أو Chrome) المثبّت على الجهاز، بلا تثبيت أي أداة
#    3) يكتب الناتج في app.js مع رأس ملاحظات
#    4) يحدّث رقم النسخة في main.html (app.js?v=...) حتى تتجاهل الجوالات النسخة القديمة المخزّنة
#  ملاحظات:
#    - لا تعدّل app.js يدوياً؛ عدّل src/app.jsx ثم شغّل هذا الملف.
#    - يحتاج اتصالاً بالإنترنت (لتحميل Babel مرة واحدة أثناء التحويل فقط).
#  سجل التعديلات:
#    2026-09-30  الإصدار الأول.
# =======================================================================

import hashlib, html, json, os, re, subprocess, sys, tempfile

# مسارات المشروع
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src", "app.jsx")
OUT = os.path.join(ROOT, "app.js")
PAGE = os.path.join(ROOT, "main.html")

# أماكن المتصفح المحتملة على ويندوز (Edge أولاً ثم Chrome)
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# رأس الملاحظات الذي يُكتب أعلى app.js
HEADER = """// =======================================================================
//  الملف: app.js  (ملف مولَّد تلقائياً — لا تعدّله يدوياً)
//  المصدر: src/app.jsx — عدّل المصدر ثم شغّل: python build.py
//  الوصف: كود تطبيق منصة الشكاوى بعد تحويل JSX إلى JavaScript عادي (فتح أسرع على الجوال).
//  آخر توليد: بصمة المصدر {digest}
// =======================================================================
"""

# صفحة مؤقتة: تحمّل Babel وتحوّل المصدر، وتضع الناتج (أو الخطأ) في عنصر textarea
TEMPLATE = """<!doctype html><meta charset="utf-8">
<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>
<textarea id="out"></textarea>
<script>
  var src = {src};
  var out = document.getElementById("out");
  try {{
    out.textContent = "OK\\n" + Babel.transform(src, {{ presets: ["react"], compact: true, comments: false }}).code;
  }} catch (e) {{
    out.textContent = "ERR\\n" + e.message;
  }}
</script>"""


# البحث عن متصفح مثبّت
def find_browser():
    for b in BROWSERS:
        if os.path.exists(b):
            return b
    sys.exit("لم يُعثر على Edge أو Chrome لتشغيل التحويل.")


# التحويل: يشغّل المتصفح بلا واجهة ويقرأ الناتج من الصفحة
def compile_jsx(source):
    page = TEMPLATE.format(src=json.dumps(source).replace("</", "<\\/"))
    tmp = tempfile.mkdtemp()
    path = os.path.join(tmp, "build.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    dom = subprocess.run(
        [find_browser(), "--headless=new", "--disable-gpu", "--virtual-time-budget=60000",
         "--user-data-dir=" + os.path.join(tmp, "profile"), "--dump-dom", "file:///" + path.replace("\\", "/")],
        capture_output=True, timeout=180).stdout.decode("utf-8", "replace")
    m = re.search(r'<textarea id="out">(.*?)</textarea>', dom, re.S)
    if not m:
        sys.exit("تعذّر التحويل: لم تُحمَّل مكتبة Babel (تحقق من الاتصال بالإنترنت).")
    text = html.unescape(m.group(1))
    status, _, code = text.partition("\n")
    if status.strip() != "OK":
        sys.exit("خطأ في src/app.jsx:\n" + code)
    return code


# التشغيل: تحويل ← كتابة app.js ← تحديث رقم النسخة في main.html
def main():
    with open(SRC, encoding="utf-8") as f:
        source = f.read()
    digest = hashlib.sha1(source.encode("utf-8")).hexdigest()[:10]
    code = compile_jsx(source)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(HEADER.format(digest=digest) + code + "\n")
    with open(PAGE, encoding="utf-8") as f:
        page = f.read()
    page, n = re.subn(r'src="app\.js(\?v=[0-9a-f]*)?"', 'src="app.js?v=' + digest + '"', page)
    if n != 1:
        sys.exit("لم يُعثر على وسم app.js في main.html")
    with open(PAGE, "w", encoding="utf-8", newline="\n") as f:
        f.write(page)
    print("تم: app.js (%d حرف) — النسخة %s" % (len(code), digest))


if __name__ == "__main__":
    main()
