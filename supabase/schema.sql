-- =====================================================================
--  الملف: supabase/schema.sql
--  المشروع: منصة شكاوى لجنة الحج — قاعدة البيانات (Supabase / PostgreSQL)
--  التنفيذ: انسخ الملف كاملاً إلى Supabase → SQL Editor ثم Run.
--           ⚠️ القسم 0 يحذف كل الجداول والدوال ويبدأ من جديد (تضيع البيانات الحالية).
--           إن ظهر تحذير "destructive operation" اضغط "Run this query".
--
--  الجداول:
--    1) complaints       الشكاوى (رمز متابعة للمشتكي، تنبيه متابعة، وقت آخر تعديل)
--    1ب) sessions        جلسات الشكوى؛ أحدث جلسة تُرحِّل المحال إليه والنتيجة والحالة إلى الشكوى
--    1ج) complaint_log   سجل الشكوى (كل حدث بوقته ومن قام به)؛ أسطر field = referred_to هي «سجل الإحالة»
--    2) access_passwords كلمات المرور: أدمن / إدارة (التقارير) / مشتكي (خاصة، 4 أرقام، مرة واحدة)
--    3) app_settings     الإعدادات: وضع دخول المشتكين وكلمة المرور العامة
--
--  دخول المشتكين (يتحكم به الأدمن):
--    الصفحة الأولى دائماً خانة كلمة المرور، ونوعها:
--      general — كلمة مرور عامة واحدة للجميع
--      private — كلمة مرور خاصة لكل شخص (4 أرقام، تُستخدم مرة واحدة)
--    وزر «تقديم شكوى مباشرة» (بلا كلمة مرور) يظهر أو يختفي حسب الإعداد direct_enabled.
--  بعد التقديم يحصل المشتكي على رقم الشكوى ورمز متابعة (6 أرقام) لمعرفة النتيجة.
--
--  ملاحظات:
--    - الموقع لا يقرأ أي جدول مباشرة؛ كل العمليات عبر دوال تتحقق من المدخلات داخلها.
--    - رقم الشكوى: الموسم-الرقم، مثل 1448-00006 (يبدأ من 1 في كل موسم).
--    - الحالات: جديد (البداية) / قيد المراجعة / جاري المتابعة / مغلقة (يُسجَّل تاريخ الإغلاق).
--    - إيقاف المحاولات الخاطئة مُلغى بطلب الإدارة (ip_locked تُرجع false دائماً).
--
--  سجل التعديلات:
--    2026-09-24  الإصدار الأول، ثم عدة إعادات تصميم انتهت بثلاث صفحات وجدول كلمات مرور موحّد.
--    2026-09-24  تنبيه متابعة يدوي (reminder_at/reminder_note) ووقت آخر تعديل (updated_at).
--    2026-09-24  الحالات: جديد / قيد المراجعة / جاري المتابعة / مغلقة. رمز متابعة للمشتكي
--                (tracking_code) ودالة track_complaint لمعرفة النتيجة.
--    2026-09-24  وضع دخول المشتكين قابل للتحكم (مفتوح / عامة / خاصة) من صفحة الأدمن،
--                وتعديل جماعي لعدة شكاوى (admin_bulk_update).
--    2026-09-24  صفحة كلمة المرور تبقى أولاً مع زر «تقديم شكوى مباشرة» يتحكم الأدمن بإظهاره
--                (direct_enabled)؛ إلغاء الوضع open. إضافة رقم التواصل إلى نموذج الشكوى.
--    2026-09-27  حذف سجل المحاولات (جدول login_attempts والدالتين request_ip و log_attempt) بطلب الإدارة.
--    2026-09-29  جدول الجلسات (sessions): رقم الشكوى، التاريخ والوقت، المحال إليه، نتيجة الجلسة، الحالة؛
--                أحدث جلسة تُرحِّل المحال إليه والنتيجة والحالة إلى جدول الشكاوى (مشغّل sessions_after_insert).
--    2026-09-29  اعتراض المشتكى عليه: رمز اعتراض يولّده الأدمن مع ملخص، وصفحة عامة يقدّم فيها اعتراضه
--                مرة واحدة (objection_view / submit_objection / admin_set_objection_code).
--    2026-09-29  القسم 12: سجل الشكوى وسجل الإحالة (complaint_log + مشغّلات)، ومهلة الاعتراض
--                (objection_deadline) مع تمديد استثنائي بسبب إلزامي؛ الاعتراض بعد المهلة يُرفض (EXPIRED).
--    2026-09-29  القسم 10ب: بطاقة الشكوى في التقارير للاطلاع فقط (تفاصيل + جلسات + سجل)، يتحكم الأدمن
--                بإظهارها عبر الإعداد report_card_enabled.
--    2026-09-29  admin_export_log: سجل كل الشكاوى للتصدير إلى ملف Excel.
--    2026-09-29  القسم 14: عنوان الاعتراض (title)، رقم الهاتف للاتصال (phone_number)، وcontact_number صار
--                «واتس / تلغرام» (اختياري)؛ normalize_phone تحذف 00 من بداية الأرقام.
--    2026-09-29  القسم 16: ثلاث نتائج (نتيجة الشكوى الداخلية، ما يراه المشتكي، ما يراه المعترض)؛ الجلسات
--                تُرحِّل إلى الداخلية فقط؛ تعديل الجلسات (admin_update_session) وإلغاء حذفها.
--    2026-09-29  القسم 18: تغيير الحالة تلقائياً — فتح «جديد» ← «قيد المراجعة»، الجلسات ← «جاري المتابعة»،
--                الاعتراض على «مغلقة» ← «قيد المراجعة».
--    2026-09-30  القسم 20: رقم الشكوى بلا «HJ-» (2026-00006) مع تحويل الأرقام الحالية وقبول الصيغتين في البحث؛
--                تصفير المنصة برمز خاص (set_reset_code / admin_reset_platform).
--    2026-09-30  القسم 21: المواسم — رقم الشكوى = الموسم-الرقم (1448-00001) ويبدأ من 1 في كل موسم؛
--                الموسم الحالي يحدده الأدمن (admin_get_season / admin_set_season)، وتصفية التقارير بالموسم.
--    2026-09-30  القسم 22: كلمة مرور قفل ملفات Excel (admin_get_excel_lock / admin_set_excel_lock).
--    2026-09-30  القسم 23: صفة المشتكي وصفة المشتكى عليه؛ عنوان الجلسة وموضوعها؛ قائمتا التصنيفات والصفات
--                يعدّلهما الأدمن؛ إلغاء سجل الشكوى وسجل الإحالة (حذف complaint_log)؛ سبب التمديد في الشكوى.
--    2026-09-30  القسم 24: صلاحيتان «مدير» و«موظف» (admin_whoami، كلمات مرور الموظفين، دوال المدير فقط).
--    2026-09-30  القسم الأخير: إعادة القيمة المثالية لكلمة مرور الأدمن الأولى (المستودع عام).
--    2026-09-30  القسم 25: الأرشفة على Drive — جدول الإحالات، «النتيجة قبل الاعتراض»، مفتاح الأرشفة و archive_export.
--    2026-09-30  القسم 26: تسلسل الشكوى — حالتا «قيد مراجعة الاعتراض» و«جاري متابعة الاعتراض»، الحالة والنتيجة من
--                آخر جلسة فقط، رمز الاعتراض بعد الإغلاق فقط، المعترض يرى العنوان فقط، ومنع الجلسات على المغلقة.
--    2026-09-30  القسم 27: القرارات الإدارية (جدول decisions ودوال العرض والحفظ والحذف) وقائمة «تصنيفات القرارات».
--    2026-09-30  القسم 28: حالة «مغلقة بعد الاعتراض» (جلسة الإغلاق بعد الاعتراض) وتحويل الشكاوى الموجودة إليها.
--    2026-09-30  القسم 29: إلغاء الأرشفة على Google Drive (حذف archive_export و set_archive_key من القسم 25 ومن القاعدة).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) البدء من جديد: حذف كل ما أُنشئ سابقاً
-- ---------------------------------------------------------------------
-- حذف الجداول (cascade يحذف ما يعتمد عليها)
drop table if exists public.access_passwords cascade;
drop table if exists public.login_attempts   cascade;
drop table if exists public.app_settings     cascade;
drop table if exists public.access_codes     cascade;
drop table if exists public.report_viewers   cascade;
drop table if exists public.admin_attempts   cascade;
drop table if exists public.code_attempts    cascade;
drop table if exists public.referrals        cascade;
drop table if exists public.complaints       cascade;
drop sequence if exists public.complaint_number_seq;

-- حذف الدوال بكل صيغها السابقة
drop function if exists public.complaints_before_insert() cascade;
drop function if exists public.complaints_before_update() cascade;
drop function if exists public.set_admin_password(text);
drop function if exists public.admin_verify(text);
drop function if exists public.admin_login(text);
drop function if exists public.admin_current_password(text);
drop function if exists public.admin_new_password(text);
drop function if exists public.admin_generate_code(text, text, int);
drop function if exists public.admin_list_complaints(text);
drop function if exists public.admin_update_complaint(text, uuid, text, text, text, text, timestamptz);
drop function if exists public.admin_update_complaint(text, uuid, text, text, text, text, timestamptz, timestamptz, text);
drop function if exists public.admin_bulk_update(text, uuid[], text, text, text, timestamptz);
drop function if exists public.admin_create_code(text, text);
drop function if exists public.admin_list_codes(text);
drop function if exists public.admin_delete_code(text, uuid);
drop function if exists public.admin_get_access(text);
drop function if exists public.admin_set_access(text, text, text);
drop function if exists public.admin_set_access(text, text, text, boolean);
drop function if exists public.admin_create_viewer(text, text);
drop function if exists public.admin_list_viewers(text);
drop function if exists public.admin_set_viewer_active(text, uuid, boolean);
drop function if exists public.viewer_verify(text);
drop function if exists public.viewer_login(text);
drop function if exists public.viewer_report(text, timestamptz, timestamptz);
drop function if exists public.get_access_mode();
drop function if exists public.get_access_config();
drop function if exists public.check_access_code(text);
drop function if exists public.code_valid(text);
drop function if exists public.submit_complaint(text, text, text);
drop function if exists public.submit_complaint(text, text, text, text);
drop function if exists public.submit_complaint(text, text, text, text, text);
drop function if exists public.track_complaint(text, text);
drop function if exists public.password_check(text);
drop function if exists public.password_matches(text);
drop function if exists public.normalize_code(text);
drop function if exists public.normalize_viewer_code(text);
drop function if exists public.request_ip();
drop function if exists public.ip_locked();
drop function if exists public.log_attempt(boolean);
drop function if exists public.track_by_tokens(uuid[]);
drop function if exists public.complaint_stats(timestamptz, timestamptz);
drop function if exists public.verify_password(text, text);
drop function if exists public.random_password(int, boolean);
drop table if exists public.sessions cascade;
drop function if exists public.sessions_after_insert() cascade;
drop function if exists public.admin_list_sessions(text, uuid);
drop function if exists public.admin_add_session(text, uuid, timestamptz, text, text, text);
drop function if exists public.admin_delete_session(text, uuid);
drop function if exists public.objection_view(text, text);
drop function if exists public.submit_objection(text, text, text);
drop function if exists public.admin_set_objection_code(text, uuid, text);
drop function if exists public.admin_set_objection_code(text, uuid, text, timestamptz);
drop function if exists public.admin_set_objection_deadline(text, uuid, timestamptz, text);
drop function if exists public.admin_complaint_log(text, uuid);
drop function if exists public.complaints_log_insert() cascade;
drop function if exists public.complaints_log_update() cascade;
drop function if exists public.sessions_after_delete() cascade;
drop function if exists public.log_complaint(uuid, text, text, text, text, text, text);
drop function if exists public.fmt_ts(timestamptz);
drop table if exists public.complaint_log cascade;
drop function if exists public.admin_export_log(text);
drop function if exists public.submit_complaint(text, text, text, text, text, text, text);
drop function if exists public.normalize_phone(text);
drop function if exists public.admin_update_session(text, uuid, timestamptz, text, text, text);
drop function if exists public.sessions_after_update() cascade;
drop function if exists public.admin_open_complaint(text, uuid);
drop function if exists public.sessions_before_write() cascade;
drop function if exists public.normalize_number(text);
drop function if exists public.set_reset_code(text);
drop function if exists public.admin_reset_platform(text, text);
drop function if exists public.admin_update_complaint(text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, text);
drop function if exists public.viewer_card_enabled(text);
drop function if exists public.viewer_complaint_card(text, text);
drop function if exists public.admin_get_report_card(text);
drop function if exists public.admin_set_report_card(text, boolean);
drop function if exists public.setting(text);
drop function if exists public.viewer_report(text, timestamptz, timestamptz, text);
drop function if exists public.admin_get_season(text);
drop function if exists public.admin_set_season(text, text);
drop function if exists public.viewer_seasons(text);
drop table if exists public.season_counters cascade;
drop function if exists public.admin_get_excel_lock(text);
drop function if exists public.admin_set_excel_lock(text, text);
drop function if exists public.get_form_lists();
drop function if exists public.admin_get_lists(text);
drop function if exists public.admin_set_list(text, text, text[]);
drop function if exists public.admin_whoami(text);
drop function if exists public.admin_create_staff(text, text);
drop function if exists public.admin_list_staff(text);
drop function if exists public.admin_set_staff_active(text, uuid, boolean);
drop table if exists public.referrals cascade;
drop function if exists public.admin_complaint_referrals(text, uuid);
drop function if exists public.admin_list_referrals(text);
drop function if exists public.set_archive_key(text);
drop function if exists public.archive_export(text);
drop table if exists public.decisions cascade;
drop function if exists public.admin_list_decisions(text);
drop function if exists public.admin_save_decision(text, uuid, text, date, text, text, text, text);
drop function if exists public.admin_delete_decision(text, uuid);
drop function if exists public.submit_complaint(text, text, text, text, text, text, text, text, text);
drop function if exists public.admin_add_session(text, uuid, timestamptz, text, text, text, text, text);
drop function if exists public.admin_update_session(text, uuid, timestamptz, text, text, text, text, text);

-- تفعيل pgcrypto لتوليد أرقام عشوائية آمنة
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) جدول الشكاوى
-- ---------------------------------------------------------------------
-- عدّاد لتوليد رقم الشكوى (HJ-السنة-00001)
create sequence public.complaint_number_seq;

-- جدول الشكاوى
create table public.complaints (
  id                uuid primary key default gen_random_uuid(),
  complaint_number  text unique,                          -- رقم الشكوى (تلقائي)
  tracking_code     text,                                 -- رمز المتابعة للمشتكي، 6 أرقام (تلقائي)
  access_code       text,                                 -- كلمة المرور الخاصة التي قُدّمت بها (إن وُجدت)
  received_date     timestamptz not null default now(),   -- تاريخ الشكوى (تلقائي)
  complainant_name  text not null,                        -- اسم المشتكي
  contact_number    text,                                 -- رقم التواصل
  accused_name      text not null,                        -- اسم المشتكى عليه
  subject           text not null,                        -- نص الاعتراض
  classification    text,                                 -- التصنيف (الأدمن)
  referred_to       text,                                 -- الترحيل / مُحالة إلى (الأدمن)
  status            text not null default 'جديد'          -- الحالة (الأدمن)
                    check (status in ('جديد', 'قيد المراجعة', 'جاري المتابعة', 'مغلقة')),
  result            text,                                 -- النتيجة (الأدمن؛ يراها المشتكي)
  closed_date       timestamptz,                          -- تاريخ الإغلاق (الأدمن)
  reminder_at       timestamptz,                          -- تنبيه متابعة يدوي (الأدمن)
  reminder_note     text,                                 -- المطلوب عند التنبيه (الأدمن)
  updated_at        timestamptz not null default now(),   -- آخر تعديل (تلقائي؛ للتنبيهات الذكية)
  objection_code    text,                                 -- رمز اعتراض المشتكى عليه، 6 أرقام (يولّده الأدمن)
  objection_summary text,                                 -- الملخص الذي يراه المشتكى عليه (يكتبه الأدمن)
  objection_text    text,                                 -- نص اعتراض المشتكى عليه (مرة واحدة)
  objection_at      timestamptz,                          -- وقت تقديم الاعتراض
  created_at        timestamptz not null default now()
);

-- فهارس: التقارير حسب التاريخ، وقائمة «المطلوب»
create index complaints_received_date_idx on public.complaints (received_date);
create index complaints_reminder_at_idx on public.complaints (reminder_at) where reminder_at is not null;

-- ---------------------------------------------------------------------
-- 1ب) جدول الجلسات: كل جلسة لشكوى، وآخر جلسة تُرحِّل المحال إليه والنتيجة والحالة إلى الشكوى
-- ---------------------------------------------------------------------
-- جدول الجلسات (يُحذف مع شكواه)
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  complaint_id  uuid not null references public.complaints (id) on delete cascade,  -- الشكوى (ومنها رقمها)
  session_at    timestamptz not null default now(),       -- تاريخ ووقت الجلسة
  referred_to   text,                                     -- ترحيل / مُحالة إلى
  result        text,                                     -- نتيجة الجلسة
  status        text not null                             -- حالة الشكوى بعد الجلسة
                check (status in ('جديد', 'قيد المراجعة', 'جاري المتابعة', 'مغلقة')),
  created_at    timestamptz not null default now()
);

-- فهرس لتسريع جلب جلسات شكوى معيّنة بالترتيب الزمني
create index sessions_complaint_idx on public.sessions (complaint_id, session_at desc);

-- ---------------------------------------------------------------------
-- 2) جدول كلمات المرور (أدمن / إدارة / مشتكي)
-- ---------------------------------------------------------------------
-- كل صف = كلمة مرور لشخص، ونوعها يحدد الصفحة التي تفتحها
create table public.access_passwords (
  id            uuid primary key default gen_random_uuid(),
  role          text not null check (role in ('أدمن', 'إدارة', 'مشتكي')),  -- نوع كلمة المرور
  password      text not null,                            -- كلمة المرور
  holder_name   text,                                     -- اسم صاحبها
  active        boolean not null default true,            -- إيقاف/تفعيل
  created_at    timestamptz not null default now(),
  used_at       timestamptz,                              -- للمشتكي: وقت تقديم الشكوى (تتوقف بعده)
  complaint_id  uuid references public.complaints (id) on delete set null,  -- للمشتكي: شكواه
  last_seen_at  timestamptz,                              -- آخر دخول
  -- المشتكي 4 أرقام؛ الأدمن والإدارة 6 أحرف على الأقل
  constraint access_passwords_format check (
    (role = 'مشتكي' and password ~ '^[0-9]{4}$') or
    (role <> 'مشتكي' and length(password) >= 6)
  )
);

-- لا تتكرر كلمة مرور صالحة داخل النوع نفسه
create unique index access_passwords_valid_idx
  on public.access_passwords (role, password) where active and used_at is null;

-- ---------------------------------------------------------------------
-- 3) الإعدادات
-- ---------------------------------------------------------------------
-- access_mode: general / private — general_password: كلمة المرور العامة —
-- direct_enabled: on / off (إظهار زر «تقديم شكوى مباشرة» بلا كلمة مرور)
create table public.app_settings (
  key    text primary key,
  value  text not null
);

-- الافتراضي: كلمة مرور خاصة، وزر التقديم المباشر ظاهر
insert into public.app_settings (key, value) values ('access_mode', 'private'), ('direct_enabled', 'on'), ('report_card_enabled', 'on');

-- ---------------------------------------------------------------------
-- 5) دوال مساعدة (داخلية — لا تُستدعى من الموقع)
-- ---------------------------------------------------------------------
-- إيقاف المحاولات مُلغى بطلب الإدارة: تُرجع «غير موقوف» دائماً
create function public.ip_locked()
returns boolean language sql stable security definer set search_path = public as $$
  select false;
$$;

-- قراءة إعداد
create function public.setting(p_key text)
returns text language sql stable security definer set search_path = public as $$
  select value from public.app_settings where key = p_key;
$$;

-- توحيد كلمة مرور مُدخلة: تحويل الأرقام العربية ٠-٩، وإزالة المسافات، وأحرف كبيرة
create function public.normalize_code(p_code text)
returns text language sql immutable as $$
  select upper(regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\s', '', 'g'));
$$;

-- التحقق من كلمة مرور أدمن/إدارة مفعّلة: يُرجع معرّفها أو null، ويسجّل وقت آخر دخول
create function public.verify_password(p_role text, p_password text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pw text := translate(btrim(coalesce(p_password, '')), '٠١٢٣٤٥٦٧٨٩', '0123456789');
  v_id uuid;
begin
  if public.ip_locked() then
    return null;
  end if;
  if p_role = 'إدارة' then
    v_pw := upper(v_pw);
  end if;
  update public.access_passwords
     set last_seen_at = now()
   where role = p_role and password = v_pw and active and used_at is null
  returning id into v_id;
  return v_id;
end $$;

-- توليد رمز عشوائي: أرقام بطول معيّن، أو أحرف وأرقام بلا تشابه (بلا O/0 و I/1/L)
create function public.random_password(p_length int, p_digits_only boolean)
returns text
language plpgsql set search_path = public, extensions as $$
declare
  v_alphabet text := case when p_digits_only then '0123456789' else 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' end;
  v_bytes    bytea := gen_random_bytes(p_length);
  v_out      text := '';
  i int;
begin
  for i in 0..p_length - 1 loop
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  return v_out;
end $$;

-- هل يُسمح بالدخول؟ بلا كلمة مرور ← فقط إن كان زر التقديم المباشر مفعّلاً؛
-- وإلا تُطابق كلمة المرور حسب النوع (عامة / خاصة غير مستخدمة)
create function public.code_valid(p_code text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_mode text := coalesce(public.setting('access_mode'), 'private');
  v_code text := public.normalize_code(p_code);
begin
  if v_code = '' then
    return coalesce(public.setting('direct_enabled'), 'off') = 'on';
  elsif v_mode = 'general' then
    return v_code = public.normalize_code(public.setting('general_password'));
  else
    return exists (select 1 from public.access_passwords
                   where role = 'مشتكي' and password = v_code and active and used_at is null);
  end if;
end $$;

-- منع الموقع من استدعاء الدوال الداخلية
revoke all on function public.ip_locked()                    from public, anon, authenticated;
revoke all on function public.setting(text)                  from public, anon, authenticated;
revoke all on function public.verify_password(text, text)    from public, anon, authenticated;
revoke all on function public.random_password(int, boolean)  from public, anon, authenticated;
revoke all on function public.code_valid(text)               from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6) المشغّلات
-- ---------------------------------------------------------------------
-- عند الإدخال: رقم الشكوى ورمز المتابعة والتاريخ تلقائياً، والحالة «جديد»
create function public.complaints_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.complaint_number := 'HJ-' || to_char(now(), 'YYYY') || '-'
                          || lpad(nextval('public.complaint_number_seq')::text, 5, '0');
  new.tracking_code    := public.random_password(6, true);
  new.received_date    := now();
  new.updated_at       := now();
  new.status           := 'جديد';
  new.closed_date      := null;
  return new;
end $$;

-- ربطها بجدول الشكاوى قبل كل إدخال
create trigger trg_complaints_before_insert
  before insert on public.complaints
  for each row execute function public.complaints_before_insert();

-- عند التعديل: منع تغيير الرقم والرمز؛ تسجيل وقت آخر تعديل؛
-- «مغلقة» بلا تاريخ ← تاريخ اليوم؛ غير «مغلقة» ← بلا تاريخ إغلاق
create function public.complaints_before_update()
returns trigger language plpgsql as $$
begin
  new.complaint_number := old.complaint_number;
  new.tracking_code    := old.tracking_code;
  new.updated_at       := now();
  if new.status = 'مغلقة' then
    new.closed_date := coalesce(new.closed_date, now());
  else
    new.closed_date := null;
  end if;
  return new;
end $$;

-- ربطها بجدول الشكاوى قبل كل تعديل
create trigger trg_complaints_before_update
  before update on public.complaints
  for each row execute function public.complaints_before_update();

-- بعد إضافة جلسة: ترحيل المحال إليه ونتيجة الجلسة وحالة الشكوى إلى جدول الشكاوى الرئيسي
-- (فقط إن كانت أحدث جلسة للشكوى؛ الحقل الفارغ في الجلسة لا يمسح قيمة الشكوى؛
--  وعند «مغلقة» يصبح تاريخ الإغلاق هو تاريخ الجلسة)
create function public.sessions_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.sessions s
             where s.complaint_id = new.complaint_id and s.session_at > new.session_at and s.id <> new.id) then
    return new;
  end if;
  update public.complaints set
    status      = new.status,
    referred_to = coalesce(nullif(btrim(new.referred_to), ''), referred_to),
    result      = coalesce(nullif(btrim(new.result), ''), result),
    closed_date = case when new.status = 'مغلقة' then new.session_at end
  where id = new.complaint_id;
  return new;
end $$;

-- ربطها بجدول الجلسات بعد كل إضافة
create trigger trg_sessions_after_insert
  after insert on public.sessions
  for each row execute function public.sessions_after_insert();

-- ---------------------------------------------------------------------
-- 7) الصلاحيات: لا وصول مباشر للجداول من الموقع
-- ---------------------------------------------------------------------
-- تفعيل الحماية على مستوى الصفوف
alter table public.complaints       enable row level security;
alter table public.access_passwords enable row level security;
alter table public.app_settings     enable row level security;
alter table public.sessions         enable row level security;

-- سحب أي صلاحية مباشرة من الموقع
revoke all on public.complaints, public.access_passwords, public.app_settings, public.sessions
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 8) صفحة المشتكي
-- ---------------------------------------------------------------------
-- إعدادات صفحة المشتكي: نوع كلمة المرور (general / private) وهل يظهر زر التقديم المباشر
create function public.get_access_config()
returns table (mode text, direct boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(public.setting('access_mode'), 'private'),
         coalesce(public.setting('direct_enabled'), 'off') = 'on';
$$;

-- التحقق من كلمة المرور في الصفحة الأولى: 'ok' أو 'wrong'
create function public.check_access_code(p_code text)
returns text
language sql stable security definer set search_path = public as $$
  select case when public.code_valid(p_code) then 'ok' else 'wrong' end;
$$;

-- تقديم الشكوى: بلا كلمة مرور (إن كان التقديم المباشر مفعّلاً) أو بكلمة مرور صحيحة
-- (الخاصة تُستهلك)؛ تُرجع رقم الشكوى ورمز المتابعة؛ دخول غير مسموح ← خطأ INVALID_CODE
create function public.submit_complaint(
  p_code             text,
  p_complainant_name text,
  p_contact_number   text,
  p_accused_name     text,
  p_subject          text
) returns table (complaint_number text, tracking_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_mode  text := coalesce(public.setting('access_mode'), 'private');
  v_code  text := public.normalize_code(p_code);
  v_pw_id uuid;
  v_id    uuid;
begin
  -- التحقق من الحقول الأربعة وأطوالها
  if coalesce(btrim(p_complainant_name), '') = ''
     or coalesce(btrim(p_contact_number), '') = ''
     or coalesce(btrim(p_accused_name), '') = ''
     or coalesce(btrim(p_subject), '') = '' then
    raise exception 'الحقول الإلزامية ناقصة';
  end if;
  if length(p_complainant_name) > 200 or length(p_contact_number) > 30
     or length(p_accused_name) > 200 or length(p_subject) > 5000 then
    raise exception 'تجاوزت البيانات الطول المسموح';
  end if;

  -- التحقق من الدخول؛ كلمة المرور الخاصة تُستهلك (مرة واحدة)
  if not public.code_valid(p_code) then
    raise exception 'INVALID_CODE';
  end if;
  if v_code <> '' and v_mode = 'private' then
    update public.access_passwords set used_at = now()
     where role = 'مشتكي' and password = v_code and active and used_at is null
    returning id into v_pw_id;
    if v_pw_id is null then
      raise exception 'INVALID_CODE';
    end if;
  end if;

  -- تسجيل الشكوى (الرقم والرمز والتاريخ من المشغّل)
  insert into public.complaints as c (complainant_name, contact_number, accused_name, subject, access_code)
  values (btrim(p_complainant_name), btrim(p_contact_number), btrim(p_accused_name), btrim(p_subject),
          case when v_pw_id is not null then v_code end)
  returning c.id, c.complaint_number, c.tracking_code into v_id, complaint_number, tracking_code;
  if v_pw_id is not null then
    update public.access_passwords set complaint_id = v_id where id = v_pw_id;
  end if;
  return next;
end $$;

-- معرفة النتيجة: رقم الشكوى + رمز المتابعة ← الحالة والنتيجة وتاريخ الإغلاق فقط
create function public.track_complaint(p_number text, p_code text)
returns table (complaint_number text, status text, result text, received_date timestamptz, closed_date timestamptz)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.status, c.result, c.received_date, c.closed_date
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.tracking_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- ---------------------------------------------------------------------
-- 8ب) اعتراض المشتكى عليه (مرة واحدة، برقم الشكوى + رمز الاعتراض)
-- ---------------------------------------------------------------------
-- ما يراه المشتكى عليه: رقم الشكوى وتاريخها والملخص الذي كتبه الأدمن، واعتراضه إن قدّمه (دون بيانات المشتكي)
create function public.objection_view(p_number text, p_code text)
returns table (complaint_number text, received_date timestamptz, summary text, objection_text text, objection_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.received_date, c.objection_summary, c.objection_text, c.objection_at
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- تقديم الاعتراض: 'OK' عند النجاح، 'INVALID' إن كان الرقم أو الرمز خاطئاً، 'ALREADY' إن سبق تقديمه
create function public.submit_objection(p_number text, p_code text, p_text text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  v_done timestamptz;
begin
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'نص الاعتراض فارغ';
  end if;
  if length(p_text) > 5000 then
    raise exception 'تجاوز النص الطول المسموح';
  end if;
  select c.id, c.objection_at into v_id, v_done
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g')
  for update;
  if v_id is null then
    return 'INVALID';
  end if;
  if v_done is not null then
    return 'ALREADY';
  end if;
  update public.complaints set objection_text = btrim(p_text), objection_at = now() where id = v_id;
  return 'OK';
end $$;

-- السماح للموقع باستدعاء دالتي الاعتراض
grant execute on function public.objection_view(text, text)         to anon, authenticated;
grant execute on function public.submit_objection(text, text, text) to anon, authenticated;

-- السماح للموقع باستدعاء دوال المشتكي
grant execute on function public.get_access_config()                           to anon, authenticated;
grant execute on function public.check_access_code(text)                        to anon, authenticated;
grant execute on function public.submit_complaint(text, text, text, text, text) to anon, authenticated;
grant execute on function public.track_complaint(text, text)              to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9) صفحة الأدمن (كل دالة تتحقق من كلمة مرور الأدمن أولاً)
-- ---------------------------------------------------------------------
-- دخول الأدمن: 'ok' أو 'wrong' أو 'locked'
create function public.admin_login(p_secret text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if public.ip_locked() then
    return 'locked';
  end if;
  return case when public.verify_password('أدمن', p_secret) is not null then 'ok' else 'wrong' end;
end $$;

-- قائمة كل الشكاوى (الأحدث أولاً)
create function public.admin_list_complaints(p_secret text)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query select * from public.complaints order by received_date desc;
end $$;

-- تحديث شكوى واحدة: التصنيف، الترحيل، الحالة، النتيجة، تاريخ الإغلاق، وتنبيه المتابعة
create function public.admin_update_complaint(
  p_secret text, p_id uuid, p_classification text, p_referred_to text, p_status text,
  p_result text, p_closed_date timestamptz, p_reminder_at timestamptz, p_reminder_note text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.complaints set
    classification = nullif(btrim(p_classification), ''),
    referred_to    = nullif(btrim(p_referred_to), ''),
    status         = p_status,
    result         = nullif(btrim(p_result), ''),
    closed_date    = case when p_status = 'مغلقة' then p_closed_date end,
    reminder_at    = p_reminder_at,
    reminder_note  = nullif(btrim(left(p_reminder_note, 500)), '')
  where id = p_id;
  return query select * from public.complaints where id = p_id;
end $$;

-- تعديل جماعي لعدة شكاوى: كل حقل فارغ (null) يبقى كما هو
create function public.admin_bulk_update(
  p_secret text, p_ids uuid[], p_status text, p_classification text, p_referred_to text, p_closed_date timestamptz
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.complaints set
    status         = coalesce(p_status, status),
    classification = coalesce(nullif(btrim(p_classification), ''), classification),
    referred_to    = coalesce(nullif(btrim(p_referred_to), ''), referred_to),
    closed_date    = case when coalesce(p_status, status) = 'مغلقة' then coalesce(p_closed_date, closed_date) end
  where id = any (p_ids);
  return query select * from public.complaints where id = any (p_ids);
end $$;

-- إعدادات دخول المشتكين: نوع كلمة المرور، كلمة المرور العامة، وزر التقديم المباشر
create function public.admin_get_access(p_secret text)
returns table (mode text, general_password text, direct boolean)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  mode := coalesce(public.setting('access_mode'), 'private');
  general_password := public.setting('general_password');
  direct := coalesce(public.setting('direct_enabled'), 'off') = 'on';
  return next;
end $$;

-- تغيير الإعدادات (القيمة null ← تبقى كما هي)
create function public.admin_set_access(p_secret text, p_mode text, p_general_password text, p_direct boolean)
returns table (mode text, general_password text, direct boolean)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if p_mode is not null then
    if p_mode not in ('general', 'private') then
      raise exception 'نوع غير معروف';
    end if;
    insert into public.app_settings (key, value) values ('access_mode', p_mode)
      on conflict (key) do update set value = excluded.value;
  end if;
  if p_general_password is not null then
    if length(btrim(p_general_password)) < 4 then
      raise exception 'كلمة المرور العامة يجب ألا تقل عن 4 أحرف أو أرقام';
    end if;
    insert into public.app_settings (key, value) values ('general_password', btrim(p_general_password))
      on conflict (key) do update set value = excluded.value;
  end if;
  if p_direct is not null then
    insert into public.app_settings (key, value) values ('direct_enabled', case when p_direct then 'on' else 'off' end)
      on conflict (key) do update set value = excluded.value;
  end if;
  -- لا يُسمح بالنوع العام بلا كلمة مرور
  if public.setting('access_mode') = 'general' and coalesce(public.setting('general_password'), '') = '' then
    raise exception 'حدد كلمة المرور العامة أولاً';
  end if;
  mode := public.setting('access_mode');
  general_password := public.setting('general_password');
  direct := coalesce(public.setting('direct_enabled'), 'off') = 'on';
  return next;
end $$;

-- توليد كلمة مرور خاصة لمشتكٍ: 4 أرقام لا تتكرر مع الكلمات الصالحة
create function public.admin_create_code(p_secret text, p_note text)
returns table (code text)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_try  int := 0;
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  loop
    v_try := v_try + 1;
    v_code := public.random_password(4, true);
    exit when not exists (select 1 from public.access_passwords a
                          where a.role = 'مشتكي' and a.password = v_code and a.active and a.used_at is null);
    if v_try > 200 then raise exception 'تعذّر توليد كلمة مرور فريدة'; end if;
  end loop;
  insert into public.access_passwords (role, password, holder_name)
  values ('مشتكي', v_code, nullif(btrim(left(p_note, 200)), ''));
  code := v_code;
  return next;
end $$;

-- آخر 100 كلمة مرور خاصة مع حالتها ورقم الشكوى المقدّمة بها
create function public.admin_list_codes(p_secret text)
returns table (id uuid, code text, note text, created_at timestamptz, used_at timestamptz, complaint_number text)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select a.id, a.password, a.holder_name, a.created_at, a.used_at, c.complaint_number
    from public.access_passwords a
    left join public.complaints c on c.id = a.complaint_id
    where a.role = 'مشتكي'
    order by a.created_at desc
    limit 100;
end $$;

-- إلغاء كلمة مرور خاصة لم تُستخدم
create function public.admin_delete_code(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return false;
  end if;
  delete from public.access_passwords where id = p_id and role = 'مشتكي' and used_at is null;
  return found;
end $$;

-- توليد كلمة مرور إدارة لشخص (8 أحرف وأرقام)
create function public.admin_create_viewer(p_secret text, p_name text)
returns table (id uuid, name text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'يرجى كتابة اسم الشخص';
  end if;
  loop
    v_code := public.random_password(8, false);
    exit when not exists (select 1 from public.access_passwords a where a.role = 'إدارة' and a.password = v_code);
  end loop;
  insert into public.access_passwords as a (role, password, holder_name)
  values ('إدارة', v_code, btrim(left(p_name, 200)))
  returning a.id, a.holder_name, a.password into id, name, code;
  return next;
end $$;

-- قائمة أصحاب كلمات مرور الإدارة
create function public.admin_list_viewers(p_secret text)
returns table (id uuid, name text, code text, active boolean, created_at timestamptz, last_seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select a.id, a.holder_name, a.password, a.active, a.created_at, a.last_seen_at
    from public.access_passwords a
    where a.role = 'إدارة'
    order by a.created_at desc;
end $$;

-- إيقاف كلمة مرور إدارة أو إعادة تفعيلها
create function public.admin_set_viewer_active(p_secret text, p_id uuid, p_active boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return false;
  end if;
  update public.access_passwords set active = p_active where id = p_id and role = 'إدارة';
  return found;
end $$;

-- توليد رمز اعتراض للمشتكى عليه (6 أرقام) وحفظ الملخص الذي سيراه؛ تُرجع الشكوى بعد التحديث
-- (إعادة التوليد تُبطل الرمز القديم، ولا تمسح اعتراضاً سبق تقديمه)
create function public.admin_set_objection_code(p_secret text, p_id uuid, p_summary text)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_summary), '') = '' then
    raise exception 'يرجى كتابة الملخص الذي سيراه المشتكى عليه';
  end if;
  update public.complaints
     set objection_code = public.random_password(6, true),
         objection_summary = btrim(left(p_summary, 5000))
   where id = p_id;
  return query select * from public.complaints where id = p_id;
end $$;

-- قائمة الجلسات: لشكوى معيّنة (p_complaint_id)، أو كل الجلسات إن كان فارغاً (الأحدث أولاً)
create function public.admin_list_sessions(p_secret text, p_complaint_id uuid)
returns table (id uuid, complaint_id uuid, complaint_number text, complainant_name text,
               session_at timestamptz, referred_to text, result text, status text)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select s.id, s.complaint_id, c.complaint_number, c.complainant_name,
           s.session_at, s.referred_to, s.result, s.status
    from public.sessions s
    join public.complaints c on c.id = s.complaint_id
    where p_complaint_id is null or s.complaint_id = p_complaint_id
    order by s.session_at desc
    limit 2000;
end $$;

-- إضافة جلسة لشكوى؛ المشغّل يرحّل قيمها إلى الشكوى؛ تُرجع الشكوى بعد التحديث
create function public.admin_add_session(
  p_secret text, p_complaint_id uuid, p_session_at timestamptz,
  p_referred_to text, p_result text, p_status text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  insert into public.sessions (complaint_id, session_at, referred_to, result, status)
  values (p_complaint_id, coalesce(p_session_at, now()),
          nullif(btrim(left(p_referred_to, 200)), ''), nullif(btrim(left(p_result, 2000)), ''), p_status);
  return query select * from public.complaints where id = p_complaint_id;
end $$;

-- حذف جلسة سُجّلت بالخطأ (لا يُرجع قيم الشكوى السابقة؛ تُعدَّل الشكوى يدوياً إن لزم)
create function public.admin_delete_session(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return false;
  end if;
  delete from public.sessions where id = p_id;
  return found;
end $$;

-- السماح للموقع باستدعاء دوال الأدمن (محمية بكلمة مرور الأدمن داخلها)
grant execute on function public.admin_set_objection_code(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_list_sessions(text, uuid)           to anon, authenticated;
grant execute on function public.admin_add_session(text, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.admin_delete_session(text, uuid)          to anon, authenticated;
grant execute on function public.admin_login(text)                         to anon, authenticated;
grant execute on function public.admin_list_complaints(text)               to anon, authenticated;
grant execute on function public.admin_update_complaint(text, uuid, text, text, text, text, timestamptz, timestamptz, text) to anon, authenticated;
grant execute on function public.admin_bulk_update(text, uuid[], text, text, text, timestamptz) to anon, authenticated;
grant execute on function public.admin_get_access(text)                    to anon, authenticated;
grant execute on function public.admin_set_access(text, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_create_code(text, text)             to anon, authenticated;
grant execute on function public.admin_list_codes(text)                    to anon, authenticated;
grant execute on function public.admin_delete_code(text, uuid)             to anon, authenticated;
grant execute on function public.admin_create_viewer(text, text)           to anon, authenticated;
grant execute on function public.admin_list_viewers(text)                  to anon, authenticated;
grant execute on function public.admin_set_viewer_active(text, uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10) صفحة التقارير (كلمة مرور الإدارة)
-- ---------------------------------------------------------------------
-- دخول التقارير: يُرجع اسم صاحب كلمة المرور، أو 'LOCKED'، أو لا شيء
create function public.viewer_login(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.ip_locked() then
    return 'LOCKED';
  end if;
  v_id := public.verify_password('إدارة', p_code);
  return (select coalesce(holder_name, 'الإدارة') from public.access_passwords where id = v_id);
end $$;

-- شكاوى الفترة المحددة للتقرير
create function public.viewer_report(p_code text, p_from timestamptz, p_to timestamptz)
returns table (complaint_number text, status text, complainant_name text, accused_name text,
               subject text, result text, received_date timestamptz, closed_date timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('إدارة', p_code) is null then
    return;
  end if;
  return query
    select c.complaint_number, c.status, c.complainant_name, c.accused_name,
           c.subject, c.result, c.received_date, c.closed_date
    from public.complaints c
    where (p_from is null or c.received_date >= p_from)
      and (p_to   is null or c.received_date <  p_to)
    order by c.received_date desc;
end $$;

-- السماح للموقع باستدعاء دالتي التقارير
grant execute on function public.viewer_login(text)                            to anon, authenticated;
grant execute on function public.viewer_report(text, timestamptz, timestamptz) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10ب) بطاقة الشكوى في التقارير (للاطلاع فقط) — يتحكم الأدمن بإظهارها (report_card_enabled)
-- ---------------------------------------------------------------------
-- هل البطاقة مفعّلة؟ (لكلمة مرور إدارة صحيحة فقط)
create or replace function public.viewer_card_enabled(p_code text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('إدارة', p_code) is null then
    return false;
  end if;
  return coalesce(public.setting('report_card_enabled'), 'off') = 'on';
end $$;

-- بطاقة شكوى للاطلاع: التفاصيل + الجلسات + السجل (JSON)؛ لا شيء إن كانت البطاقة موقوفة
create or replace function public.viewer_complaint_card(p_code text, p_number text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.verify_password('إدارة', p_code) is null
     or coalesce(public.setting('report_card_enabled'), 'off') <> 'on' then
    return null;
  end if;
  select id into v_id from public.complaints where complaint_number = p_number;
  if v_id is null then
    return null;
  end if;
  return json_build_object(
    'complaint', (select row_to_json(x) from (
        select complaint_number, received_date, complainant_name, contact_number, accused_name, subject,
               classification, referred_to, status, result, closed_date, objection_text, objection_at
        from public.complaints where id = v_id) x),
    'sessions', coalesce((select json_agg(s order by s.session_at desc) from (
        select session_at, referred_to, result, status from public.sessions where complaint_id = v_id) s), '[]'::json),
    'log', coalesce((select json_agg(l order by l.at desc) from (
        select at, event, field, old_value, new_value, actor, source, note
        from public.complaint_log where complaint_id = v_id) l), '[]'::json)
  );
end $$;

-- الأدمن: قراءة مفتاح البطاقة وتغييره
create or replace function public.admin_get_report_card(p_secret text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return null;
  end if;
  return coalesce(public.setting('report_card_enabled'), 'off') = 'on';
end $$;

create or replace function public.admin_set_report_card(p_secret text, p_on boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return null;
  end if;
  insert into public.app_settings (key, value) values ('report_card_enabled', case when p_on then 'on' else 'off' end)
    on conflict (key) do update set value = excluded.value;
  return p_on;
end $$;

-- السماح للموقع باستدعائها (محمية بكلمة المرور داخلها)
grant execute on function public.viewer_card_enabled(text)             to anon, authenticated;
grant execute on function public.viewer_complaint_card(text, text)     to anon, authenticated;
grant execute on function public.admin_get_report_card(text)           to anon, authenticated;
grant execute on function public.admin_set_report_card(text, boolean)  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 12) سجل الشكوى (ومنه سجل الإحالة) ومهلة الاعتراض
--     هذا القسم يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)،
--     ويستبدل بعض الدوال السابقة بنسخ تكتب في السجل.
-- ---------------------------------------------------------------------
-- آخر موعد لتقديم الاعتراض (بعده يُرفض إلا بتمديد استثنائي من الأدمن)
alter table public.complaints add column if not exists objection_deadline timestamptz;

-- جدول سجل الشكوى: كل حدث على الشكوى بوقته ومن قام به ومصدره
create table if not exists public.complaint_log (
  id            bigint generated always as identity primary key,
  complaint_id  uuid not null references public.complaints (id) on delete cascade,
  at            timestamptz not null default now(),     -- وقت الحدث
  event         text not null,                          -- نوع الحدث (تقديم، إحالة، تغيير الحالة…)
  field         text,                                   -- الحقل المتغيّر (referred_to = سجل الإحالة)
  old_value     text,                                   -- القيمة السابقة
  new_value     text,                                   -- القيمة الجديدة
  actor         text,                                   -- من قام به (اسم صاحب كلمة مرور الأدمن، أو المشتكي/المشتكى عليه)
  source        text,                                   -- من أين (تعديل، تعديل جماعي، جلسة…)
  note          text                                    -- ملاحظة (مثل سبب التمديد الاستثنائي)
);

-- فهرس لتسريع جلب سجل شكوى معيّنة بالترتيب الزمني
create index if not exists complaint_log_idx on public.complaint_log (complaint_id, at desc);

-- حماية السجل من الوصول المباشر
alter table public.complaint_log enable row level security;
revoke all on public.complaint_log from anon, authenticated;

-- تنسيق وقت للسجل بتوقيت مكة (داخلية)
create or replace function public.fmt_ts(p timestamptz)
returns text language sql stable as $$
  select to_char(p at time zone 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI');
$$;

-- إضافة سطر للسجل (داخلية): المنفّذ والمصدر والملاحظة تُقرأ من إعدادات الطلب إن لم تُمرَّر
create or replace function public.log_complaint(
  p_id uuid, p_event text, p_field text, p_old text, p_new text, p_actor text default null, p_note text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.complaint_log (complaint_id, event, field, old_value, new_value, actor, source, note)
  values (p_id, p_event, p_field, p_old, p_new,
          coalesce(p_actor, nullif(current_setting('app.actor', true), '')),
          coalesce(nullif(current_setting('app.source', true), ''), 'تعديل'),
          coalesce(p_note, nullif(current_setting('app.note', true), '')));
$$;

-- منع الموقع من استدعاء الدالتين الداخليتين
revoke all on function public.fmt_ts(timestamptz) from public, anon, authenticated;
revoke all on function public.log_complaint(uuid, text, text, text, text, text, text) from public, anon, authenticated;

-- التحقق من كلمة المرور (نسخة تحفظ اسم صاحبها ليُسجَّل «من قام بالتعديل» في السجل)
create or replace function public.verify_password(p_role text, p_password text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pw   text := translate(btrim(coalesce(p_password, '')), '٠١٢٣٤٥٦٧٨٩', '0123456789');
  v_id   uuid;
  v_name text;
begin
  if public.ip_locked() then
    return null;
  end if;
  if p_role = 'إدارة' then
    v_pw := upper(v_pw);
  end if;
  update public.access_passwords
     set last_seen_at = now()
   where role = p_role and password = v_pw and active and used_at is null
  returning id, holder_name into v_id, v_name;
  if v_id is not null then
    perform set_config('app.actor', coalesce(v_name, p_role), true);
  end if;
  return v_id;
end $$;

-- بعد تقديم شكوى: أول سطر في سجلها
create or replace function public.complaints_log_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_complaint(new.id, 'تقديم الشكوى', 'status', null, new.status, 'المشتكي', null);
  return null;
end $$;

-- ربطها بجدول الشكاوى بعد كل إدخال
drop trigger if exists trg_complaints_log_insert on public.complaints;
create trigger trg_complaints_log_insert
  after insert on public.complaints
  for each row execute function public.complaints_log_insert();

-- بعد تعديل شكوى: سطر في السجل لكل حقل تغيّر (الإحالة، الحالة، التصنيف، النتيجة، الاعتراض…)
create or replace function public.complaints_log_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- الحالة: إغلاق / إعادة فتح / تغيير
  if new.status is distinct from old.status then
    perform public.log_complaint(new.id,
      case when new.status = 'مغلقة' then 'إغلاق الشكوى' when old.status = 'مغلقة' then 'إعادة فتح الشكوى' else 'تغيير الحالة' end,
      'status', old.status, new.status);
  end if;
  -- الإحالة (هذه الأسطر تكوّن «سجل الإحالة»)
  if new.referred_to is distinct from old.referred_to then
    perform public.log_complaint(new.id, 'إحالة', 'referred_to', old.referred_to, new.referred_to);
  end if;
  -- التصنيف والنتيجة
  if new.classification is distinct from old.classification then
    perform public.log_complaint(new.id, 'تغيير التصنيف', 'classification', old.classification, new.classification);
  end if;
  if new.result is distinct from old.result then
    perform public.log_complaint(new.id, 'تحديث النتيجة', 'result', old.result, new.result);
  end if;
  -- تعديل تاريخ الإغلاق لشكوى مغلقة أصلاً (الإغلاق وإعادة الفتح مسجّلان مع الحالة)
  if new.closed_date is distinct from old.closed_date and new.closed_date is not null and old.closed_date is not null then
    perform public.log_complaint(new.id, 'تعديل تاريخ الإغلاق', 'closed_date', public.fmt_ts(old.closed_date), public.fmt_ts(new.closed_date));
  end if;
  -- تنبيه المتابعة اليدوي
  if new.reminder_at is distinct from old.reminder_at then
    perform public.log_complaint(new.id, case when new.reminder_at is null then 'إلغاء تنبيه المتابعة' else 'تنبيه متابعة' end,
      'reminder_at', public.fmt_ts(old.reminder_at), public.fmt_ts(new.reminder_at), null, new.reminder_note);
  end if;
  -- الاعتراض: توليد الرمز، أو تمديد المهلة، أو تقديم الاعتراض
  if new.objection_code is distinct from old.objection_code and new.objection_code is not null then
    perform public.log_complaint(new.id, 'توليد رمز اعتراض', 'objection_deadline', null,
      'آخر موعد: ' || coalesce(public.fmt_ts(new.objection_deadline), '—'));
  elsif new.objection_deadline is distinct from old.objection_deadline then
    perform public.log_complaint(new.id, 'تمديد استثنائي لمهلة الاعتراض', 'objection_deadline',
      public.fmt_ts(old.objection_deadline), public.fmt_ts(new.objection_deadline));
  end if;
  if old.objection_at is null and new.objection_at is not null then
    perform public.log_complaint(new.id, 'تقديم اعتراض', 'objection', null, left(new.objection_text, 300), 'المشتكى عليه', null);
  end if;
  return null;
end $$;

-- ربطها بجدول الشكاوى بعد كل تعديل
drop trigger if exists trg_complaints_log_update on public.complaints;
create trigger trg_complaints_log_update
  after update on public.complaints
  for each row execute function public.complaints_log_update();

-- بعد إضافة جلسة: سطر «جلسة» في السجل، ثم ترحيل قيمها إلى الشكوى (مصدر التغييرات: «جلسة»)
create or replace function public.sessions_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_complaint(new.complaint_id, 'جلسة', 'session', null, new.status, null,
    'موعد الجلسة: ' || public.fmt_ts(new.session_at)
    || coalesce(' — الإحالة: ' || nullif(btrim(new.referred_to), ''), '')
    || coalesce(' — النتيجة: ' || nullif(btrim(new.result), ''), ''));
  if exists (select 1 from public.sessions s
             where s.complaint_id = new.complaint_id and s.session_at > new.session_at and s.id <> new.id) then
    return new;
  end if;
  perform set_config('app.source', 'جلسة', true);
  update public.complaints set
    status      = new.status,
    referred_to = coalesce(nullif(btrim(new.referred_to), ''), referred_to),
    result      = coalesce(nullif(btrim(new.result), ''), result),
    closed_date = case when new.status = 'مغلقة' then new.session_at end
  where id = new.complaint_id;
  return new;
end $$;

-- بعد حذف جلسة: سطر في السجل (إلا إذا حُذفت الشكوى نفسها)
create or replace function public.sessions_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.complaints where id = old.complaint_id) then
    perform public.log_complaint(old.complaint_id, 'حذف جلسة', 'session', old.status, null, null,
      'موعد الجلسة المحذوفة: ' || public.fmt_ts(old.session_at));
  end if;
  return null;
end $$;

-- ربطها بجدول الجلسات بعد كل حذف
drop trigger if exists trg_sessions_after_delete on public.sessions;
create trigger trg_sessions_after_delete
  after delete on public.sessions
  for each row execute function public.sessions_after_delete();

-- التعديل الجماعي (نسخة تجعل مصدر السجل «تعديل جماعي»)
create or replace function public.admin_bulk_update(
  p_secret text, p_ids uuid[], p_status text, p_classification text, p_referred_to text, p_closed_date timestamptz
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  perform set_config('app.source', 'تعديل جماعي', true);
  update public.complaints set
    status         = coalesce(p_status, status),
    classification = coalesce(nullif(btrim(p_classification), ''), classification),
    referred_to    = coalesce(nullif(btrim(p_referred_to), ''), referred_to),
    closed_date    = case when coalesce(p_status, status) = 'مغلقة' then coalesce(p_closed_date, closed_date) end
  where id = any (p_ids);
  return query select * from public.complaints where id = any (p_ids);
end $$;

-- سجل شكوى معيّنة للأدمن (الأحدث أولاً)
create or replace function public.admin_complaint_log(p_secret text, p_complaint_id uuid)
returns table (at timestamptz, event text, field text, old_value text, new_value text, actor text, source text, note text)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select l.at, l.event, l.field, l.old_value, l.new_value, l.actor, l.source, l.note
    from public.complaint_log l
    where l.complaint_id = p_complaint_id
    order by l.at desc, l.id desc;
end $$;

-- سجل كل الشكاوى للتصدير إلى Excel (مع رقم كل شكوى)، الأحدث أولاً
create or replace function public.admin_export_log(p_secret text)
returns table (complaint_number text, at timestamptz, event text, field text, old_value text, new_value text,
               actor text, source text, note text)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select c.complaint_number, l.at, l.event, l.field, l.old_value, l.new_value, l.actor, l.source, l.note
    from public.complaint_log l
    join public.complaints c on c.id = l.complaint_id
    order by l.at desc, l.id desc;
end $$;
grant execute on function public.admin_export_log(text) to anon, authenticated;

-- توليد رمز الاعتراض مع الملخص وآخر موعد للاعتراض (الافتراضي بعد 3 أيام)
drop function if exists public.admin_set_objection_code(text, uuid, text);
drop function if exists public.admin_set_objection_code(text, uuid, text, timestamptz);
create function public.admin_set_objection_code(p_secret text, p_id uuid, p_summary text, p_deadline timestamptz)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_summary), '') = '' then
    raise exception 'يرجى كتابة الملخص الذي سيراه المشتكى عليه';
  end if;
  update public.complaints
     set objection_code     = public.random_password(6, true),
         objection_summary  = btrim(left(p_summary, 5000)),
         objection_deadline = coalesce(p_deadline, now() + interval '3 days')
   where id = p_id;
  return query select * from public.complaints where id = p_id;
end $$;

-- تمديد استثنائي لمهلة الاعتراض: موعد جديد + سبب إلزامي يُسجَّل في السجل
create or replace function public.admin_set_objection_deadline(p_secret text, p_id uuid, p_deadline timestamptz, p_reason text)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'يرجى كتابة سبب التمديد الاستثنائي';
  end if;
  if p_deadline is null or p_deadline <= now() then
    raise exception 'الموعد الجديد يجب أن يكون في المستقبل';
  end if;
  perform set_config('app.note', 'السبب: ' || btrim(left(p_reason, 500)), true);
  update public.complaints set objection_deadline = p_deadline
   where id = p_id and objection_code is not null and objection_at is null;
  return query select * from public.complaints where id = p_id;
end $$;

-- ما يراه المشتكى عليه (نسخة تُرجع آخر موعد للاعتراض)
drop function if exists public.objection_view(text, text);
create function public.objection_view(p_number text, p_code text)
returns table (complaint_number text, received_date timestamptz, summary text, objection_text text,
               objection_at timestamptz, deadline timestamptz)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.received_date, c.objection_summary, c.objection_text, c.objection_at, c.objection_deadline
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- تقديم الاعتراض (نسخة ترفض بعد انتهاء المهلة): 'OK' / 'INVALID' / 'ALREADY' / 'EXPIRED'
create or replace function public.submit_objection(p_number text, p_code text, p_text text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_done     timestamptz;
  v_deadline timestamptz;
begin
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'نص الاعتراض فارغ';
  end if;
  if length(p_text) > 5000 then
    raise exception 'تجاوز النص الطول المسموح';
  end if;
  select c.id, c.objection_at, c.objection_deadline into v_id, v_done, v_deadline
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g')
  for update;
  if v_id is null then
    return 'INVALID';
  end if;
  if v_done is not null then
    return 'ALREADY';
  end if;
  if v_deadline is not null and now() > v_deadline then
    return 'EXPIRED';
  end if;
  update public.complaints set objection_text = btrim(p_text), objection_at = now() where id = v_id;
  return 'OK';
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة والمستبدلة
grant execute on function public.admin_complaint_log(text, uuid)                              to anon, authenticated;
grant execute on function public.admin_set_objection_code(text, uuid, text, timestamptz)      to anon, authenticated;
grant execute on function public.admin_set_objection_deadline(text, uuid, timestamptz, text)  to anon, authenticated;
grant execute on function public.objection_view(text, text)                                   to anon, authenticated;

-- ---------------------------------------------------------------------
-- 14) عنوان الاعتراض، ورقم الهاتف للاتصال، ورقم واتس/تلغرام (مع حذف 00 من بداية الأرقام)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- الحقلان الجديدان: عنوان قصير للاعتراض، ورقم الهاتف للاتصال (contact_number صار «واتس / تلغرام»)
alter table public.complaints add column if not exists title        text;   -- عنوان الاعتراض
alter table public.complaints add column if not exists phone_number text;   -- رقم الهاتف للاتصال

-- توحيد رقم الهاتف: الأرقام العربية ← إنجليزية، أرقام فقط، وحذف 00 من البداية (00963… ← 963…)
create or replace function public.normalize_phone(p text)
returns text language sql immutable as $$
  select nullif(regexp_replace(
           regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g'),
           '^00', ''), '');
$$;

-- تقديم الشكوى (النسخة الجديدة): الاسم، الهاتف (إلزامي)، واتس/تلغرام (اختياري)، المشتكى عليه،
-- عنوان الاعتراض، ونص الاعتراض؛ تُرجع رقم الشكوى ورمز المتابعة
drop function if exists public.submit_complaint(text, text, text, text, text);
drop function if exists public.submit_complaint(text, text, text, text, text, text, text);
create function public.submit_complaint(
  p_code             text,
  p_complainant_name text,
  p_phone_number     text,
  p_contact_number   text,
  p_accused_name     text,
  p_title            text,
  p_subject          text
) returns table (complaint_number text, tracking_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_mode    text := coalesce(public.setting('access_mode'), 'private');
  v_code    text := public.normalize_code(p_code);
  v_phone   text := public.normalize_phone(p_phone_number);
  v_contact text := public.normalize_phone(p_contact_number);
  v_pw_id   uuid;
  v_id      uuid;
begin
  -- الحقول الإلزامية وأطوالها (واتس/تلغرام اختياري)
  if coalesce(btrim(p_complainant_name), '') = '' or v_phone is null
     or coalesce(btrim(p_accused_name), '') = '' or coalesce(btrim(p_title), '') = ''
     or coalesce(btrim(p_subject), '') = '' then
    raise exception 'الحقول الإلزامية ناقصة';
  end if;
  if length(p_complainant_name) > 200 or length(v_phone) > 20 or length(coalesce(v_contact, '')) > 20
     or length(p_accused_name) > 200 or length(p_title) > 150 or length(p_subject) > 5000 then
    raise exception 'تجاوزت البيانات الطول المسموح';
  end if;

  -- التحقق من الدخول؛ كلمة المرور الخاصة تُستهلك (مرة واحدة)
  if not public.code_valid(p_code) then
    raise exception 'INVALID_CODE';
  end if;
  if v_code <> '' and v_mode = 'private' then
    update public.access_passwords set used_at = now()
     where role = 'مشتكي' and password = v_code and active and used_at is null
    returning id into v_pw_id;
    if v_pw_id is null then
      raise exception 'INVALID_CODE';
    end if;
  end if;

  -- تسجيل الشكوى (الرقم والرمز والتاريخ من المشغّل)
  insert into public.complaints as c (complainant_name, phone_number, contact_number, accused_name, title, subject, access_code)
  values (btrim(p_complainant_name), v_phone, v_contact, btrim(p_accused_name), btrim(p_title), btrim(p_subject),
          case when v_pw_id is not null then v_code end)
  returning c.id, c.complaint_number, c.tracking_code into v_id, complaint_number, tracking_code;
  if v_pw_id is not null then
    update public.access_passwords set complaint_id = v_id where id = v_pw_id;
  end if;
  return next;
end $$;

-- معرفة النتيجة (نسخة تُرجع عنوان الاعتراض ليتعرّف المشتكي على شكواه)
drop function if exists public.track_complaint(text, text);
create function public.track_complaint(p_number text, p_code text)
returns table (complaint_number text, title text, status text, result text, received_date timestamptz, closed_date timestamptz)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.title, c.status, c.result, c.received_date, c.closed_date
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.tracking_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- تقرير الإدارة (نسخة تُرجع عنوان الاعتراض)
drop function if exists public.viewer_report(text, timestamptz, timestamptz);
create function public.viewer_report(p_code text, p_from timestamptz, p_to timestamptz)
returns table (complaint_number text, status text, complainant_name text, accused_name text, title text,
               subject text, result text, received_date timestamptz, closed_date timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('إدارة', p_code) is null then
    return;
  end if;
  return query
    select c.complaint_number, c.status, c.complainant_name, c.accused_name, c.title,
           c.subject, c.result, c.received_date, c.closed_date
    from public.complaints c
    where (p_from is null or c.received_date >= p_from)
      and (p_to   is null or c.received_date <  p_to)
    order by c.received_date desc;
end $$;

-- بطاقة التقارير (نسخة تُرجع العنوان ورقمي الهاتف)
create or replace function public.viewer_complaint_card(p_code text, p_number text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.verify_password('إدارة', p_code) is null
     or coalesce(public.setting('report_card_enabled'), 'off') <> 'on' then
    return null;
  end if;
  select id into v_id from public.complaints where complaint_number = p_number;
  if v_id is null then
    return null;
  end if;
  return json_build_object(
    'complaint', (select row_to_json(x) from (
        select complaint_number, received_date, complainant_name, phone_number, contact_number, accused_name, title, subject,
               classification, referred_to, status, result, closed_date, objection_text, objection_at
        from public.complaints where id = v_id) x),
    'sessions', coalesce((select json_agg(s order by s.session_at desc) from (
        select session_at, referred_to, result, status from public.sessions where complaint_id = v_id) s), '[]'::json),
    'log', coalesce((select json_agg(l order by l.at desc) from (
        select at, event, field, old_value, new_value, actor, source, note
        from public.complaint_log where complaint_id = v_id) l), '[]'::json)
  );
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة والمستبدلة
grant execute on function public.submit_complaint(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.track_complaint(text, text)                               to anon, authenticated;
grant execute on function public.viewer_report(text, timestamptz, timestamptz)             to anon, authenticated;

-- ---------------------------------------------------------------------
-- 16) ثلاث نتائج للشكوى، وتعديل الجلسات بدل حذفها
--     result             = نتيجة الشكوى (داخلية: الأدمن والإدارة؛ نتيجة آخر جلسة تنتقل إليها)
--     complainant_result = النتيجة التي يراها المشتكي (يكتبها الأدمن فقط؛ لا تأتي من الجلسات)
--     accused_result     = النتيجة التي يراها المعترض/المشتكى عليه (يكتبها الأدمن فقط)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- الحقلان الجديدان
alter table public.complaints add column if not exists complainant_result text;   -- النتيجة التي يراها المشتكي
alter table public.complaints add column if not exists accused_result     text;   -- النتيجة التي يراها المعترض

-- مرة واحدة: الشكاوى القديمة كان المشتكي يرى result، فتُنسخ إلى complainant_result حتى لا تختفي عنه
-- (المشغّلات موقوفة أثناء النسخ حتى لا يتغيّر «آخر تعديل» ولا يُكتب في السجل)
alter table public.complaints disable trigger user;
update public.complaints set complainant_result = result
 where complainant_result is null and result is not null;
alter table public.complaints enable trigger user;

-- سجل الشكوى (نسخة تسجّل النتائج الثلاث كلٌّ باسمه)
create or replace function public.complaints_log_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- الحالة: إغلاق / إعادة فتح / تغيير
  if new.status is distinct from old.status then
    perform public.log_complaint(new.id,
      case when new.status = 'مغلقة' then 'إغلاق الشكوى' when old.status = 'مغلقة' then 'إعادة فتح الشكوى' else 'تغيير الحالة' end,
      'status', old.status, new.status);
  end if;
  -- الإحالة (هذه الأسطر تكوّن «سجل الإحالة»)
  if new.referred_to is distinct from old.referred_to then
    perform public.log_complaint(new.id, 'إحالة', 'referred_to', old.referred_to, new.referred_to);
  end if;
  -- التصنيف
  if new.classification is distinct from old.classification then
    perform public.log_complaint(new.id, 'تغيير التصنيف', 'classification', old.classification, new.classification);
  end if;
  -- النتائج الثلاث
  if new.result is distinct from old.result then
    perform public.log_complaint(new.id, 'تحديث نتيجة الشكوى', 'result', old.result, new.result);
  end if;
  if new.complainant_result is distinct from old.complainant_result then
    perform public.log_complaint(new.id, 'تحديث النتيجة التي يراها المشتكي', 'complainant_result', old.complainant_result, new.complainant_result);
  end if;
  if new.accused_result is distinct from old.accused_result then
    perform public.log_complaint(new.id, 'تحديث النتيجة التي يراها المعترض', 'accused_result', old.accused_result, new.accused_result);
  end if;
  -- تعديل تاريخ الإغلاق لشكوى مغلقة أصلاً
  if new.closed_date is distinct from old.closed_date and new.closed_date is not null and old.closed_date is not null then
    perform public.log_complaint(new.id, 'تعديل تاريخ الإغلاق', 'closed_date', public.fmt_ts(old.closed_date), public.fmt_ts(new.closed_date));
  end if;
  -- تنبيه المتابعة اليدوي
  if new.reminder_at is distinct from old.reminder_at then
    perform public.log_complaint(new.id, case when new.reminder_at is null then 'إلغاء تنبيه المتابعة' else 'تنبيه متابعة' end,
      'reminder_at', public.fmt_ts(old.reminder_at), public.fmt_ts(new.reminder_at), null, new.reminder_note);
  end if;
  -- الاعتراض: توليد الرمز، أو تمديد المهلة، أو تقديم الاعتراض
  if new.objection_code is distinct from old.objection_code and new.objection_code is not null then
    perform public.log_complaint(new.id, 'توليد رمز اعتراض', 'objection_deadline', null,
      'آخر موعد: ' || coalesce(public.fmt_ts(new.objection_deadline), '—'));
  elsif new.objection_deadline is distinct from old.objection_deadline then
    perform public.log_complaint(new.id, 'تمديد استثنائي لمهلة الاعتراض', 'objection_deadline',
      public.fmt_ts(old.objection_deadline), public.fmt_ts(new.objection_deadline));
  end if;
  if old.objection_at is null and new.objection_at is not null then
    perform public.log_complaint(new.id, 'تقديم اعتراض', 'objection', null, left(new.objection_text, 300), 'المشتكى عليه', null);
  end if;
  return null;
end $$;

-- بعد تعديل جلسة: سطر «تعديل جلسة» في السجل، وإن كانت أحدث جلسة تُرحَّل قيمها إلى الشكوى
-- (النتيجة تُرحَّل إلى «نتيجة الشكوى» الداخلية فقط، لا إلى نتيجة المشتكي أو المعترض)
create or replace function public.sessions_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_complaint(new.complaint_id, 'تعديل جلسة', 'session', old.status, new.status, null,
    'موعد الجلسة: ' || public.fmt_ts(new.session_at)
    || coalesce(' — الإحالة: ' || nullif(btrim(new.referred_to), ''), '')
    || coalesce(' — النتيجة: ' || nullif(btrim(new.result), ''), ''));
  if exists (select 1 from public.sessions s
             where s.complaint_id = new.complaint_id and s.session_at > new.session_at and s.id <> new.id) then
    return null;
  end if;
  perform set_config('app.source', 'تعديل جلسة', true);
  update public.complaints set
    status      = new.status,
    referred_to = coalesce(nullif(btrim(new.referred_to), ''), referred_to),
    result      = coalesce(nullif(btrim(new.result), ''), result),
    closed_date = case when new.status = 'مغلقة' then new.session_at end
  where id = new.complaint_id;
  return null;
end $$;

-- ربطها بجدول الجلسات بعد كل تعديل
drop trigger if exists trg_sessions_after_update on public.sessions;
create trigger trg_sessions_after_update
  after update on public.sessions
  for each row execute function public.sessions_after_update();

-- تعديل جلسة (بدل الحذف)؛ تُرجع الشكوى بعد التحديث
create or replace function public.admin_update_session(
  p_secret text, p_id uuid, p_session_at timestamptz, p_referred_to text, p_result text, p_status text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
declare
  v_cid uuid;
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.sessions set
    session_at  = coalesce(p_session_at, session_at),
    referred_to = nullif(btrim(left(p_referred_to, 200)), ''),
    result      = nullif(btrim(left(p_result, 2000)), ''),
    status      = p_status
  where id = p_id
  returning complaint_id into v_cid;
  return query select * from public.complaints where id = v_cid;
end $$;

-- حذف الجلسات مُلغى بطلب الإدارة (التعديل فقط)
drop function if exists public.admin_delete_session(text, uuid);

-- تحديث الشكوى (نسخة بالنتائج الثلاث)
drop function if exists public.admin_update_complaint(text, uuid, text, text, text, text, timestamptz, timestamptz, text);
drop function if exists public.admin_update_complaint(text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, text);
create function public.admin_update_complaint(
  p_secret text, p_id uuid, p_classification text, p_referred_to text, p_status text,
  p_result text, p_complainant_result text, p_accused_result text,
  p_closed_date timestamptz, p_reminder_at timestamptz, p_reminder_note text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.complaints set
    classification     = nullif(btrim(p_classification), ''),
    referred_to        = nullif(btrim(p_referred_to), ''),
    status             = p_status,
    result             = nullif(btrim(p_result), ''),
    complainant_result = nullif(btrim(p_complainant_result), ''),
    accused_result     = nullif(btrim(p_accused_result), ''),
    closed_date        = case when p_status = 'مغلقة' then p_closed_date end,
    reminder_at        = p_reminder_at,
    reminder_note      = nullif(btrim(left(p_reminder_note, 500)), '')
  where id = p_id;
  return query select * from public.complaints where id = p_id;
end $$;

-- معرفة النتيجة للمشتكي: تُرجع «النتيجة التي يراها المشتكي» فقط (لا نتيجة الشكوى الداخلية)
create or replace function public.track_complaint(p_number text, p_code text)
returns table (complaint_number text, title text, status text, result text, received_date timestamptz, closed_date timestamptz)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.title, c.status, c.complainant_result, c.received_date, c.closed_date
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.tracking_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- ما يراه المعترض (نسخة تُرجع «النتيجة التي يراها المعترض»)
drop function if exists public.objection_view(text, text);
create function public.objection_view(p_number text, p_code text)
returns table (complaint_number text, received_date timestamptz, summary text, objection_text text,
               objection_at timestamptz, deadline timestamptz, result text)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.received_date, c.objection_summary, c.objection_text, c.objection_at,
         c.objection_deadline, c.accused_result
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- بطاقة التقارير (نسخة تُرجع النتائج الثلاث)
create or replace function public.viewer_complaint_card(p_code text, p_number text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.verify_password('إدارة', p_code) is null
     or coalesce(public.setting('report_card_enabled'), 'off') <> 'on' then
    return null;
  end if;
  select id into v_id from public.complaints where complaint_number = p_number;
  if v_id is null then
    return null;
  end if;
  return json_build_object(
    'complaint', (select row_to_json(x) from (
        select complaint_number, received_date, complainant_name, phone_number, contact_number, accused_name, title, subject,
               classification, referred_to, status, result, complainant_result, accused_result, closed_date,
               objection_text, objection_at
        from public.complaints where id = v_id) x),
    'sessions', coalesce((select json_agg(s order by s.session_at desc) from (
        select session_at, referred_to, result, status from public.sessions where complaint_id = v_id) s), '[]'::json),
    'log', coalesce((select json_agg(l order by l.at desc) from (
        select at, event, field, old_value, new_value, actor, source, note
        from public.complaint_log where complaint_id = v_id) l), '[]'::json)
  );
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة والمستبدلة
grant execute on function public.admin_update_session(text, uuid, timestamptz, text, text, text) to anon, authenticated;
grant execute on function public.admin_update_complaint(text, uuid, text, text, text, text, text, text, timestamptz, timestamptz, text) to anon, authenticated;
grant execute on function public.objection_view(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 18) تغيير الحالة تلقائياً
--     1) فتح الأدمن شكوى «جديد»           ← «قيد المراجعة»
--     2) أي جلسة للشكوى                    ← «جاري المتابعة» (أو «مغلقة» إن اختيرت)
--     3) اعتراض على شكوى «مغلقة»           ← «قيد المراجعة» (إعادة فتح لدراستها من جديد)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- 1) فتح شكوى من لوحة الأدمن: «جديد» ← «قيد المراجعة»؛ تُرجع الشكوى (بعد التحديث إن تغيّرت)
create or replace function public.admin_open_complaint(p_secret text, p_id uuid)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  perform set_config('app.source', 'فتح الشكوى', true);
  update public.complaints set status = 'قيد المراجعة' where id = p_id and status = 'جديد';
  return query select * from public.complaints where id = p_id;
end $$;
grant execute on function public.admin_open_complaint(text, uuid) to anon, authenticated;

-- 2) قبل حفظ أي جلسة: الحالة «جديد» أو «قيد المراجعة» تصبح «جاري المتابعة» (بدء الجلسات = بدء المتابعة)
create or replace function public.sessions_before_write()
returns trigger language plpgsql as $$
begin
  if new.status in ('جديد', 'قيد المراجعة') then
    new.status := 'جاري المتابعة';
  end if;
  return new;
end $$;

-- ربطها بجدول الجلسات قبل كل إضافة وتعديل
drop trigger if exists trg_sessions_before_write on public.sessions;
create trigger trg_sessions_before_write
  before insert or update on public.sessions
  for each row execute function public.sessions_before_write();

-- 3) تقديم الاعتراض (نسخة تعيد فتح الشكوى المغلقة إلى «قيد المراجعة» لدراستها من جديد)
create or replace function public.submit_objection(p_number text, p_code text, p_text text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_done     timestamptz;
  v_deadline timestamptz;
begin
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'نص الاعتراض فارغ';
  end if;
  if length(p_text) > 5000 then
    raise exception 'تجاوز النص الطول المسموح';
  end if;
  select c.id, c.objection_at, c.objection_deadline into v_id, v_done, v_deadline
  from public.complaints c
  where upper(c.complaint_number) = upper(btrim(coalesce(p_number, '')))
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g')
  for update;
  if v_id is null then
    return 'INVALID';
  end if;
  if v_done is not null then
    return 'ALREADY';
  end if;
  if v_deadline is not null and now() > v_deadline then
    return 'EXPIRED';
  end if;
  -- المنفّذ والمصدر في سجل الشكوى: المشتكى عليه / اعتراض
  perform set_config('app.actor', 'المشتكى عليه', true);
  perform set_config('app.source', 'اعتراض', true);
  update public.complaints set
    objection_text = btrim(p_text),
    objection_at   = now(),
    status         = case when status = 'مغلقة' then 'قيد المراجعة' else status end
  where id = v_id;
  return 'OK';
end $$;

-- ---------------------------------------------------------------------
-- 20) رقم الشكوى بلا «HJ-» (مثل 2026-00006)، وتصفير المنصة برمز خاص
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة
--     رمز التصفير يُعيَّن مرة واحدة من SQL Editor:  select public.set_reset_code('رمز-طويل-سري');
-- ---------------------------------------------------------------------
-- رقم الشكوى الجديد: السنة-الرقم (2026-00006)
create or replace function public.complaints_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.complaint_number := to_char(now(), 'YYYY') || '-'
                          || lpad(nextval('public.complaint_number_seq')::text, 5, '0');
  new.tracking_code    := public.random_password(6, true);
  new.received_date    := now();
  new.updated_at       := now();
  new.status           := 'جديد';
  new.closed_date      := null;
  return new;
end $$;

-- مرة واحدة: حذف «HJ-» من أرقام الشكاوى الحالية (المشغّلات موقوفة حتى لا يتغيّر «آخر تعديل»)
alter table public.complaints disable trigger user;
update public.complaints set complaint_number = regexp_replace(complaint_number, '^HJ-', '')
 where complaint_number like 'HJ-%';
alter table public.complaints enable trigger user;

-- توحيد رقم شكوى مُدخل: أحرف كبيرة، بلا مسافات، الأرقام العربية ← إنجليزية، وحذف «HJ-» القديمة
create or replace function public.normalize_number(p text)
returns text language sql immutable as $$
  select regexp_replace(upper(regexp_replace(translate(coalesce(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\s', '', 'g')), '^HJ-', '');
$$;

-- معرفة النتيجة (يقبل الرقم بالصيغتين، ومع المسافات)
create or replace function public.track_complaint(p_number text, p_code text)
returns table (complaint_number text, title text, status text, result text, received_date timestamptz, closed_date timestamptz)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.title, c.status, c.complainant_result, c.received_date, c.closed_date
  from public.complaints c
  where c.complaint_number = public.normalize_number(p_number)
    and c.tracking_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- ما يراه المعترض (يقبل الرقم بالصيغتين)
create or replace function public.objection_view(p_number text, p_code text)
returns table (complaint_number text, received_date timestamptz, summary text, objection_text text,
               objection_at timestamptz, deadline timestamptz, result text)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.received_date, c.objection_summary, c.objection_text, c.objection_at,
         c.objection_deadline, c.accused_result
  from public.complaints c
  where c.complaint_number = public.normalize_number(p_number)
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- تقديم الاعتراض (يقبل الرقم بالصيغتين؛ ويعيد فتح الشكوى المغلقة إلى «قيد المراجعة»)
create or replace function public.submit_objection(p_number text, p_code text, p_text text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_done     timestamptz;
  v_deadline timestamptz;
begin
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'نص الاعتراض فارغ';
  end if;
  if length(p_text) > 5000 then
    raise exception 'تجاوز النص الطول المسموح';
  end if;
  select c.id, c.objection_at, c.objection_deadline into v_id, v_done, v_deadline
  from public.complaints c
  where c.complaint_number = public.normalize_number(p_number)
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g')
  for update;
  if v_id is null then
    return 'INVALID';
  end if;
  if v_done is not null then
    return 'ALREADY';
  end if;
  if v_deadline is not null and now() > v_deadline then
    return 'EXPIRED';
  end if;
  perform set_config('app.actor', 'المشتكى عليه', true);
  perform set_config('app.source', 'اعتراض', true);
  update public.complaints set
    objection_text = btrim(p_text),
    objection_at   = now(),
    status         = case when status = 'مغلقة' then 'قيد المراجعة' else status end
  where id = v_id;
  return 'OK';
end $$;

-- تعيين رمز التصفير أو تغييره (من SQL Editor فقط؛ يُحفظ مشفّراً، 8 أحرف على الأقل)
create or replace function public.set_reset_code(p_code text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_code, '')) < 8 then
    raise exception 'رمز التصفير يجب ألا يقل عن 8 أحرف';
  end if;
  insert into public.app_settings (key, value) values ('reset_hash', crypt(p_code, gen_salt('bf')))
    on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.set_reset_code(text) from public, anon, authenticated;

-- تصفير المنصة: كلمة مرور الأدمن + رمز التصفير؛ يحذف كل الشكاوى (ومعها الجلسات والسجل)
-- وكلمات مرور المشتكين الخاصة، ويعيد عدّاد الأرقام إلى 1. لا يمس كلمات مرور الأدمن والإدارة ولا الإعدادات.
-- تُرجع: 'OK' أو 'NO_CODE' (لم يُعيَّن رمز) أو 'WRONG_CODE'
create or replace function public.admin_reset_platform(p_secret text, p_reset_code text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  if public.verify_password('أدمن', p_secret) is null then
    return 'WRONG_CODE';
  end if;
  select value into v_hash from public.app_settings where key = 'reset_hash';
  if v_hash is null then
    return 'NO_CODE';
  end if;
  if crypt(coalesce(p_reset_code, ''), v_hash) <> v_hash then
    return 'WRONG_CODE';
  end if;
  delete from public.complaints where true;
  delete from public.access_passwords where role = 'مشتكي';
  perform setval('public.complaint_number_seq', 1, false);
  return 'OK';
end $$;
grant execute on function public.admin_reset_platform(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 21) المواسم: رقم الشكوى = الموسم-الرقم (1448-00001)، والترقيم يبدأ من 1 في كل موسم
--     الموسم الحالي يحدده الأدمن من تبويب «الإعدادات» (app_settings: season)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- حقل الموسم في الشكوى، والموسم الحالي الافتراضي 1448
alter table public.complaints add column if not exists season text;
insert into public.app_settings (key, value) values ('season', '1448') on conflict (key) do nothing;

-- عدّاد لكل موسم: آخر رقم مُستخدم فيه (زيادته ذرّية فلا يتكرر رقم مع التقديم المتزامن)
create table if not exists public.season_counters (
  season       text primary key,
  last_number  int  not null default 0
);
alter table public.season_counters enable row level security;
revoke all on public.season_counters from anon, authenticated;

-- مرة واحدة: الشكاوى الحالية تُحسب على الموسم الحالي، ويبدأ عدّاده بعد أكبر رقم فيه (إن وُجد)
alter table public.complaints disable trigger user;
update public.complaints set season = public.setting('season') where season is null;
alter table public.complaints enable trigger user;
insert into public.season_counters (season, last_number)
  select c.season, max(nullif(substring(c.complaint_number from '^' || c.season || '-(\d+)$'), '')::int)
  from public.complaints c
  where c.complaint_number ~ ('^' || c.season || '-\d+$')
  group by c.season
on conflict (season) do update set last_number = greatest(public.season_counters.last_number, excluded.last_number);

-- عند إدخال شكوى: الموسم الحالي، ورقمها التالي في هذا الموسم، ورمز المتابعة والتاريخ، والحالة «جديد»
create or replace function public.complaints_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_season text := coalesce(nullif(public.setting('season'), ''), '1448');
  v_n      int;
begin
  insert into public.season_counters (season, last_number) values (v_season, 1)
    on conflict (season) do update set last_number = public.season_counters.last_number + 1
    returning last_number into v_n;
  new.season           := v_season;
  new.complaint_number := v_season || '-' || lpad(v_n::text, 5, '0');
  new.tracking_code    := public.random_password(6, true);
  new.received_date    := now();
  new.updated_at       := now();
  new.status           := 'جديد';
  new.closed_date      := null;
  return new;
end $$;

-- الأدمن: الموسم الحالي + قائمة المواسم مع عدد شكاوى كل موسم
create or replace function public.admin_get_season(p_secret text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return null;
  end if;
  return json_build_object(
    'current', public.setting('season'),
    'seasons', coalesce((select json_agg(x order by x.season desc) from (
        select season, count(*) as total from public.complaints where season is not null group by season) x), '[]'::json));
end $$;

-- الأدمن: تغيير الموسم الحالي (4 أرقام)؛ الشكاوى الجديدة بعدها تُرقَّم في الموسم الجديد من 1
-- تُرجع: 'OK' أو 'INVALID'
create or replace function public.admin_set_season(p_secret text, p_season text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_season text := translate(btrim(coalesce(p_season, '')), '٠١٢٣٤٥٦٧٨٩', '0123456789');
begin
  if public.verify_password('أدمن', p_secret) is null or v_season !~ '^\d{4}$' then
    return 'INVALID';
  end if;
  insert into public.app_settings (key, value) values ('season', v_season)
    on conflict (key) do update set value = excluded.value;
  return 'OK';
end $$;

-- التقارير: قائمة المواسم (الحالي + ما فيه شكاوى) لكلمة مرور إدارة صحيحة
create or replace function public.viewer_seasons(p_code text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('إدارة', p_code) is null then
    return null;
  end if;
  return json_build_object(
    'current', public.setting('season'),
    'seasons', coalesce((select json_agg(s order by s desc) from (
        select distinct season as s from public.complaints where season is not null) x), '[]'::json));
end $$;

-- التقارير: نسخة تُرجع الموسم وتقبل تصفية بالموسم (p_season فارغ = كل المواسم)
drop function if exists public.viewer_report(text, timestamptz, timestamptz);
drop function if exists public.viewer_report(text, timestamptz, timestamptz, text);
create function public.viewer_report(p_code text, p_from timestamptz, p_to timestamptz, p_season text)
returns table (complaint_number text, season text, status text, complainant_name text, accused_name text, title text,
               subject text, result text, received_date timestamptz, closed_date timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('إدارة', p_code) is null then
    return;
  end if;
  return query
    select c.complaint_number, c.season, c.status, c.complainant_name, c.accused_name, c.title,
           c.subject, c.result, c.received_date, c.closed_date
    from public.complaints c
    where (p_from is null or c.received_date >= p_from)
      and (p_to   is null or c.received_date <  p_to)
      and (coalesce(p_season, '') = '' or c.season = p_season)
    order by c.received_date desc;
end $$;

-- التصفير: نسخة تمسح عدّادات المواسم أيضاً (فيبدأ الموسم الحالي من 00001)
create or replace function public.admin_reset_platform(p_secret text, p_reset_code text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  if public.verify_password('أدمن', p_secret) is null then
    return 'WRONG_CODE';
  end if;
  select value into v_hash from public.app_settings where key = 'reset_hash';
  if v_hash is null then
    return 'NO_CODE';
  end if;
  if crypt(coalesce(p_reset_code, ''), v_hash) <> v_hash then
    return 'WRONG_CODE';
  end if;
  delete from public.complaints where true;
  delete from public.access_passwords where role = 'مشتكي';
  delete from public.season_counters where true;
  perform setval('public.complaint_number_seq', 1, false);
  return 'OK';
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة
grant execute on function public.admin_get_season(text)                               to anon, authenticated;
grant execute on function public.admin_set_season(text, text)                         to anon, authenticated;
grant execute on function public.viewer_seasons(text)                                 to anon, authenticated;
grant execute on function public.viewer_report(text, timestamptz, timestamptz, text)  to anon, authenticated;
grant execute on function public.admin_reset_platform(text, text)                     to anon, authenticated;

-- ---------------------------------------------------------------------
-- 22) كلمة مرور قفل ملفات Excel (ملفات التصدير تُقفل للعرض فقط)
--     تُحفظ في app_settings (excel_lock)، ويقرؤها ويغيّرها الأدمن فقط
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- قراءة كلمة مرور القفل (فارغة = قفل بلا كلمة مرور)
create or replace function public.admin_get_excel_lock(p_secret text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return null;
  end if;
  return coalesce(public.setting('excel_lock'), '');
end $$;

-- تغيير كلمة مرور القفل (فارغة = إلغاء كلمة المرور مع بقاء القفل)؛ تُرجع 'OK' أو 'INVALID'
create or replace function public.admin_set_excel_lock(p_secret text, p_password text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null or length(coalesce(p_password, '')) > 50 then
    return 'INVALID';
  end if;
  insert into public.app_settings (key, value) values ('excel_lock', btrim(coalesce(p_password, '')))
    on conflict (key) do update set value = excluded.value;
  return 'OK';
end $$;

-- السماح للموقع باستدعاء الدالتين
grant execute on function public.admin_get_excel_lock(text)       to anon, authenticated;
grant execute on function public.admin_set_excel_lock(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 23) الصفة، عنوان الجلسة وموضوعها، قوائم يعدّلها الأدمن، وإلغاء سجل الشكوى
--     - صفة المشتكي وصفة المشتكى عليه (لتمييز الأسماء المتشابهة)
--     - عنوان الجلسة وموضوعها (قبل نتيجة الجلسة)
--     - قائمتا «التصنيفات» و«الصفات» في app_settings يعدّلهما الأدمن من «الإعدادات»
--     - سجل الشكوى وسجل الإحالة يُلغيان بطلب الإدارة (يُحذف الجدول ويتوقف التسجيل)
--     - سبب التمديد الاستثنائي للاعتراض يُحفظ في الشكوى نفسها (كان في السجل)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (يحذف سجل الشكاوى فقط)
-- ---------------------------------------------------------------------
-- الحقول الجديدة
alter table public.complaints add column if not exists complainant_role text;              -- صفة المشتكي
alter table public.complaints add column if not exists accused_role     text;              -- صفة المشتكى عليه
alter table public.complaints add column if not exists objection_extension_reason text;    -- سبب آخر تمديد استثنائي
alter table public.sessions   add column if not exists title text;                         -- عنوان الجلسة
alter table public.sessions   add column if not exists topic text;                         -- موضوع الجلسة

-- القائمتان الافتراضيتان (نص JSON)؛ لا تُستبدلان إن كانتا موجودتين
insert into public.app_settings (key, value) values
  ('classifications', '["السكن","النقل والتنقلات","الإعاشة والوجبات","التأشيرات والوثائق","الأمور المالية","سلوك وتعامل","الخدمات الصحية","تقييم المجموعات","أخرى"]'),
  ('roles', '["حاج","مرافق","رئيس مجموعة","مشرف","مندوب","موظف","سائق"]')
on conflict (key) do nothing;

-- إلغاء السجل: التسجيل يصبح بلا أثر، وحذف مشغّلي السجل والجدول ودوال عرضه
create or replace function public.log_complaint(
  p_id uuid, p_event text, p_field text, p_old text, p_new text, p_actor text default null, p_note text default null
) returns void language plpgsql as $$
begin
  return;  -- السجل مُلغى بطلب الإدارة
end $$;
drop trigger if exists trg_complaints_log_insert on public.complaints;
drop trigger if exists trg_complaints_log_update on public.complaints;
drop function if exists public.complaints_log_insert();
drop function if exists public.complaints_log_update();
drop function if exists public.admin_complaint_log(text, uuid);
drop function if exists public.admin_export_log(text);
drop table if exists public.complaint_log cascade;

-- قائمة الصفات لنموذج الشكوى (عامة: لا تحتاج كلمة مرور)
create or replace function public.get_form_lists()
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('roles', coalesce(public.setting('roles'), '[]')::json);
$$;

-- الأدمن: القائمتان معاً
create or replace function public.admin_get_lists(p_secret text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return null;
  end if;
  return json_build_object(
    'classifications', coalesce(public.setting('classifications'), '[]')::json,
    'roles',           coalesce(public.setting('roles'), '[]')::json);
end $$;

-- الأدمن: حفظ قائمة (classifications أو roles) — عناصر نصية بلا تكرار، حتى 60 عنصراً و60 حرفاً لكلٍّ
-- تُرجع: 'OK' أو 'INVALID'
create or replace function public.admin_set_list(p_secret text, p_key text, p_items text[])
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_items text[];
begin
  if public.verify_password('أدمن', p_secret) is null or p_key not in ('classifications', 'roles') then
    return 'INVALID';
  end if;
  select coalesce(array_agg(x order by o), '{}') into v_items from (
    select btrim(left(x, 60)) as x, min(o) as o
    from unnest(coalesce(p_items, '{}')) with ordinality as t(x, o)
    where btrim(coalesce(x, '')) <> ''
    group by btrim(left(x, 60))) u;
  if cardinality(v_items) > 60 then
    return 'INVALID';
  end if;
  insert into public.app_settings (key, value) values (p_key, to_json(v_items)::text)
    on conflict (key) do update set value = excluded.value;
  return 'OK';
end $$;

-- تقديم الشكوى (نسخة بالصفتين): الصفتان إلزاميتان
drop function if exists public.submit_complaint(text, text, text, text, text, text, text);
drop function if exists public.submit_complaint(text, text, text, text, text, text, text, text, text);
create function public.submit_complaint(
  p_code             text,
  p_complainant_name text,
  p_complainant_role text,
  p_phone_number     text,
  p_contact_number   text,
  p_accused_name     text,
  p_accused_role     text,
  p_title            text,
  p_subject          text
) returns table (complaint_number text, tracking_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_mode    text := coalesce(public.setting('access_mode'), 'private');
  v_code    text := public.normalize_code(p_code);
  v_phone   text := public.normalize_phone(p_phone_number);
  v_contact text := public.normalize_phone(p_contact_number);
  v_pw_id   uuid;
  v_id      uuid;
begin
  -- الحقول الإلزامية وأطوالها (واتس/تلغرام اختياري)
  if coalesce(btrim(p_complainant_name), '') = '' or coalesce(btrim(p_complainant_role), '') = '' or v_phone is null
     or coalesce(btrim(p_accused_name), '') = '' or coalesce(btrim(p_accused_role), '') = ''
     or coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_subject), '') = '' then
    raise exception 'الحقول الإلزامية ناقصة';
  end if;
  if length(p_complainant_name) > 200 or length(p_complainant_role) > 100 or length(v_phone) > 20
     or length(coalesce(v_contact, '')) > 20 or length(p_accused_name) > 200 or length(p_accused_role) > 100
     or length(p_title) > 150 or length(p_subject) > 5000 then
    raise exception 'تجاوزت البيانات الطول المسموح';
  end if;

  -- التحقق من الدخول؛ كلمة المرور الخاصة تُستهلك (مرة واحدة)
  if not public.code_valid(p_code) then
    raise exception 'INVALID_CODE';
  end if;
  if v_code <> '' and v_mode = 'private' then
    update public.access_passwords set used_at = now()
     where role = 'مشتكي' and password = v_code and active and used_at is null
    returning id into v_pw_id;
    if v_pw_id is null then
      raise exception 'INVALID_CODE';
    end if;
  end if;

  -- تسجيل الشكوى (الرقم والرمز والتاريخ والموسم من المشغّل)
  insert into public.complaints as c (complainant_name, complainant_role, phone_number, contact_number,
                                      accused_name, accused_role, title, subject, access_code)
  values (btrim(p_complainant_name), btrim(p_complainant_role), v_phone, v_contact,
          btrim(p_accused_name), btrim(p_accused_role), btrim(p_title), btrim(p_subject),
          case when v_pw_id is not null then v_code end)
  returning c.id, c.complaint_number, c.tracking_code into v_id, complaint_number, tracking_code;
  if v_pw_id is not null then
    update public.access_passwords set complaint_id = v_id where id = v_pw_id;
  end if;
  return next;
end $$;

-- تمديد استثنائي لمهلة الاعتراض (نسخة تحفظ السبب في الشكوى)
create or replace function public.admin_set_objection_deadline(p_secret text, p_id uuid, p_deadline timestamptz, p_reason text)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'يرجى كتابة سبب التمديد الاستثنائي';
  end if;
  if p_deadline is null or p_deadline <= now() then
    raise exception 'الموعد الجديد يجب أن يكون في المستقبل';
  end if;
  update public.complaints set objection_deadline = p_deadline, objection_extension_reason = btrim(left(p_reason, 500))
   where id = p_id and objection_code is not null and objection_at is null;
  return query select * from public.complaints where id = p_id;
end $$;

-- قائمة الجلسات (نسخة بالعنوان والموضوع)
drop function if exists public.admin_list_sessions(text, uuid);
create function public.admin_list_sessions(p_secret text, p_complaint_id uuid)
returns table (id uuid, complaint_id uuid, complaint_number text, complainant_name text,
               session_at timestamptz, title text, topic text, referred_to text, result text, status text)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select s.id, s.complaint_id, c.complaint_number, c.complainant_name,
           s.session_at, s.title, s.topic, s.referred_to, s.result, s.status
    from public.sessions s
    join public.complaints c on c.id = s.complaint_id
    where p_complaint_id is null or s.complaint_id = p_complaint_id
    order by s.session_at desc
    limit 2000;
end $$;

-- إضافة جلسة (نسخة بالعنوان والموضوع)؛ المشغّل يرحّل قيمها إلى الشكوى
drop function if exists public.admin_add_session(text, uuid, timestamptz, text, text, text);
drop function if exists public.admin_add_session(text, uuid, timestamptz, text, text, text, text, text);
create function public.admin_add_session(
  p_secret text, p_complaint_id uuid, p_session_at timestamptz,
  p_title text, p_topic text, p_referred_to text, p_result text, p_status text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  insert into public.sessions (complaint_id, session_at, title, topic, referred_to, result, status)
  values (p_complaint_id, coalesce(p_session_at, now()),
          nullif(btrim(left(p_title, 200)), ''), nullif(btrim(left(p_topic, 2000)), ''),
          nullif(btrim(left(p_referred_to, 200)), ''), nullif(btrim(left(p_result, 2000)), ''), p_status);
  return query select * from public.complaints where id = p_complaint_id;
end $$;

-- تعديل جلسة (نسخة بالعنوان والموضوع)
drop function if exists public.admin_update_session(text, uuid, timestamptz, text, text, text);
drop function if exists public.admin_update_session(text, uuid, timestamptz, text, text, text, text, text);
create function public.admin_update_session(
  p_secret text, p_id uuid, p_session_at timestamptz,
  p_title text, p_topic text, p_referred_to text, p_result text, p_status text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
declare
  v_cid uuid;
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.sessions set
    session_at  = coalesce(p_session_at, session_at),
    title       = nullif(btrim(left(p_title, 200)), ''),
    topic       = nullif(btrim(left(p_topic, 2000)), ''),
    referred_to = nullif(btrim(left(p_referred_to, 200)), ''),
    result      = nullif(btrim(left(p_result, 2000)), ''),
    status      = p_status
  where id = p_id
  returning complaint_id into v_cid;
  return query select * from public.complaints where id = v_cid;
end $$;

-- بطاقة التقارير (نسخة بالصفتين وعنوان الجلسة وموضوعها، وبلا سجل)
create or replace function public.viewer_complaint_card(p_code text, p_number text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if public.verify_password('إدارة', p_code) is null
     or coalesce(public.setting('report_card_enabled'), 'off') <> 'on' then
    return null;
  end if;
  select id into v_id from public.complaints where complaint_number = p_number;
  if v_id is null then
    return null;
  end if;
  return json_build_object(
    'complaint', (select row_to_json(x) from (
        select complaint_number, received_date, complainant_name, complainant_role, phone_number, contact_number,
               accused_name, accused_role, title, subject, classification, referred_to, status, result,
               complainant_result, accused_result, closed_date, objection_text, objection_at
        from public.complaints where id = v_id) x),
    'sessions', coalesce((select json_agg(s order by s.session_at desc) from (
        select session_at, title, topic, referred_to, result, status from public.sessions where complaint_id = v_id) s), '[]'::json));
end $$;

-- التقارير (نسخة بالصفتين)
drop function if exists public.viewer_report(text, timestamptz, timestamptz, text);
create function public.viewer_report(p_code text, p_from timestamptz, p_to timestamptz, p_season text)
returns table (complaint_number text, season text, status text, complainant_name text, complainant_role text,
               accused_name text, accused_role text, title text, classification text,
               subject text, result text, received_date timestamptz, closed_date timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('إدارة', p_code) is null then
    return;
  end if;
  return query
    select c.complaint_number, c.season, c.status, c.complainant_name, c.complainant_role,
           c.accused_name, c.accused_role, c.title, c.classification,
           c.subject, c.result, c.received_date, c.closed_date
    from public.complaints c
    where (p_from is null or c.received_date >= p_from)
      and (p_to   is null or c.received_date <  p_to)
      and (coalesce(p_season, '') = '' or c.season = p_season)
    order by c.received_date desc;
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة والمستبدلة
grant execute on function public.get_form_lists()                                                    to anon, authenticated;
grant execute on function public.admin_get_lists(text)                                               to anon, authenticated;
grant execute on function public.admin_set_list(text, text, text[])                                  to anon, authenticated;
grant execute on function public.submit_complaint(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_objection_deadline(text, uuid, timestamptz, text)         to anon, authenticated;
grant execute on function public.admin_list_sessions(text, uuid)                                     to anon, authenticated;
grant execute on function public.admin_add_session(text, uuid, timestamptz, text, text, text, text, text)    to anon, authenticated;
grant execute on function public.admin_update_session(text, uuid, timestamptz, text, text, text, text, text) to anon, authenticated;
grant execute on function public.viewer_complaint_card(text, text)                                   to anon, authenticated;
grant execute on function public.viewer_report(text, timestamptz, timestamptz, text)                 to anon, authenticated;

-- ---------------------------------------------------------------------
-- 24) صلاحيتان في صفحة الأدمن: «مدير» و«موظف»
--     - كلمة مرور بدور «أدمن» = مدير (كل شيء)
--     - كلمة مرور بدور «موظف» = الشكاوى والمطلوب والجلسات والروابط فقط
--       (لا: إعدادات الدخول، كلمات مرور الإدارة والموظفين، الموسم، القوائم، قفل Excel، التصفير)
--     - verify_password('أدمن', …) يقبل المدير والموظف، و verify_password('مدير', …) يقبل المدير فقط
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- السماح بالدور الجديد «موظف» في جدول كلمات المرور
alter table public.access_passwords drop constraint if exists access_passwords_role_check;
alter table public.access_passwords add constraint access_passwords_role_check
  check (role in ('أدمن', 'موظف', 'إدارة', 'مشتكي'));

-- التحقق من كلمة المرور: «أدمن» = مدير أو موظف، «مدير» = المدير فقط، وغيرها كما هي
create or replace function public.verify_password(p_role text, p_password text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_pw    text := translate(btrim(coalesce(p_password, '')), '٠١٢٣٤٥٦٧٨٩', '0123456789');
  v_roles text[] := case p_role when 'أدمن' then array['أدمن', 'موظف'] when 'مدير' then array['أدمن'] else array[p_role] end;
  v_id    uuid;
  v_name  text;
begin
  if public.ip_locked() then
    return null;
  end if;
  if p_role = 'إدارة' then
    v_pw := upper(v_pw);
  end if;
  update public.access_passwords
     set last_seen_at = now()
   where role = any (v_roles) and password = v_pw and active and used_at is null
  returning id, holder_name into v_id, v_name;
  if v_id is not null then
    perform set_config('app.actor', coalesce(v_name, p_role), true);
  end if;
  return v_id;
end $$;

-- من الداخل؟ تُرجع {role: 'مدير' أو 'موظف', name} أو null
create or replace function public.admin_whoami(p_secret text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := public.verify_password('أدمن', p_secret);
begin
  if v_id is null then
    return null;
  end if;
  return (select json_build_object('role', case when role = 'أدمن' then 'مدير' else 'موظف' end, 'name', holder_name)
          from public.access_passwords where id = v_id);
end $$;

-- الدوال الخاصة بالمدير: تُعاد كتابتها تلقائياً لتقبل المدير فقط (بدل المدير والموظف)
do $$
declare
  f record;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'admin_set_access', 'admin_list_codes', 'admin_delete_code',
      'admin_create_viewer', 'admin_list_viewers', 'admin_set_viewer_active',
      'admin_get_report_card', 'admin_set_report_card',
      'admin_set_season', 'admin_set_excel_lock', 'admin_set_list', 'admin_reset_platform'])
  loop
    execute replace(pg_get_functiondef(f.oid), 'verify_password(''أدمن''', 'verify_password(''مدير''');
  end loop;
end $$;

-- كلمات مرور الموظفين (للمدير فقط): إضافة موظف بكلمة مرور من 8 أحرف وأرقام
create or replace function public.admin_create_staff(p_secret text, p_name text)
returns table (id uuid, name text, code text)
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if public.verify_password('مدير', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'يرجى كتابة اسم الموظف';
  end if;
  loop
    v_code := public.random_password(8, false);
    exit when not exists (select 1 from public.access_passwords a where a.password = v_code);
  end loop;
  insert into public.access_passwords as a (role, password, holder_name)
  values ('موظف', v_code, btrim(left(p_name, 200)))
  returning a.id, a.holder_name, a.password into id, name, code;
  return next;
end $$;

-- قائمة الموظفين (للمدير فقط)
create or replace function public.admin_list_staff(p_secret text)
returns table (id uuid, name text, code text, active boolean, created_at timestamptz, last_seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('مدير', p_secret) is null then
    return;
  end if;
  return query
    select a.id, a.holder_name, a.password, a.active, a.created_at, a.last_seen_at
    from public.access_passwords a
    where a.role = 'موظف'
    order by a.created_at desc;
end $$;

-- إيقاف موظف أو إعادة تفعيله (للمدير فقط)
create or replace function public.admin_set_staff_active(p_secret text, p_id uuid, p_active boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('مدير', p_secret) is null then
    return false;
  end if;
  update public.access_passwords set active = p_active where id = p_id and role = 'موظف';
  return found;
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة
grant execute on function public.admin_whoami(text)                          to anon, authenticated;
grant execute on function public.admin_create_staff(text, text)              to anon, authenticated;
grant execute on function public.admin_list_staff(text)                      to anon, authenticated;
grant execute on function public.admin_set_staff_active(text, uuid, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 25) الإحالات والنتيجة قبل الاعتراض
--     - جدول صغير للإحالات: إلى من أُحيلت الشكوى ومتى (فقط؛ بلا تغيّر الحالات)
--     - «النتيجة قبل الاعتراض»: تُحفظ تلقائياً لحظة وصول الاعتراض
--     (كانت معها أرشفة Google Drive، وأُلغيت بطلب الإدارة — انظر القسم 29)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- جدول الإحالات: سطر لكل إحالة جديدة
create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints (id) on delete cascade,
  referred_to  text not null,                         -- الجهة أو الشخص
  referred_at  timestamptz not null default now()     -- وقت الإحالة
);
create index if not exists referrals_complaint_idx on public.referrals (complaint_id, referred_at);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

-- حقل «النتيجة قبل الاعتراض»
alter table public.complaints add column if not exists result_before_objection text;

-- مرة واحدة: الإحالات السابقة من الجلسات، ثم الإحالة الحالية لكل شكوى إن لم تكن مسجّلة
insert into public.referrals (complaint_id, referred_to, referred_at)
  select s.complaint_id, btrim(s.referred_to), min(s.session_at)
  from public.sessions s
  where coalesce(btrim(s.referred_to), '') <> ''
    and not exists (select 1 from public.referrals r where r.complaint_id = s.complaint_id)
  group by s.complaint_id, btrim(s.referred_to);
insert into public.referrals (complaint_id, referred_to, referred_at)
  select c.id, btrim(c.referred_to), coalesce(c.updated_at, c.received_date)
  from public.complaints c
  where coalesce(btrim(c.referred_to), '') <> ''
    and not exists (select 1 from public.referrals r where r.complaint_id = c.id and r.referred_to = btrim(c.referred_to));

-- قبل تعديل شكوى: حفظ النتيجة لحظة وصول الاعتراض
create or replace function public.complaints_keep_result_before_objection()
returns trigger language plpgsql as $$
begin
  if old.objection_at is null and new.objection_at is not null then
    new.result_before_objection := old.result;
  end if;
  return new;
end $$;
drop trigger if exists trg_complaints_keep_result on public.complaints;
create trigger trg_complaints_keep_result
  before update on public.complaints
  for each row execute function public.complaints_keep_result_before_objection();

-- بعد تعديل شكوى: إن تغيّرت الجهة المُحال إليها (وليست فارغة) ← سطر إحالة جديد
create or replace function public.complaints_log_referral()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(btrim(new.referred_to), '') <> '' and new.referred_to is distinct from old.referred_to then
    insert into public.referrals (complaint_id, referred_to) values (new.id, btrim(new.referred_to));
  end if;
  return null;
end $$;
drop trigger if exists trg_complaints_log_referral on public.complaints;
create trigger trg_complaints_log_referral
  after update on public.complaints
  for each row execute function public.complaints_log_referral();

-- الأدمن: إحالات شكوى معيّنة (الأقدم أولاً)
create or replace function public.admin_complaint_referrals(p_secret text, p_id uuid)
returns table (referred_to text, referred_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query select r.referred_to, r.referred_at from public.referrals r where r.complaint_id = p_id order by r.referred_at;
end $$;

-- الأدمن: كل الإحالات مع رقم الشكوى (لورقة «الإحالات» في Excel)
create or replace function public.admin_list_referrals(p_secret text)
returns table (complaint_number text, referred_to text, referred_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query
    select c.complaint_number, r.referred_to, r.referred_at
    from public.referrals r join public.complaints c on c.id = r.complaint_id
    order by c.complaint_number, r.referred_at;
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة
grant execute on function public.admin_complaint_referrals(text, uuid) to anon, authenticated;
grant execute on function public.admin_list_referrals(text)            to anon, authenticated;

-- ---------------------------------------------------------------------
-- 26) تسلسل الشكوى الجديد
--     جديد ← (فتح البطاقة) قيد المراجعة ← (جلسة) جاري المتابعة ← (جلسة إغلاق) مغلقة
--       ← (اعتراض) قيد مراجعة الاعتراض ← (جلسة) جاري متابعة الاعتراض ← (جلسة إغلاق) مغلقة نهائياً
--     - الحالة والنتيجة والإغلاق تأتي من آخر جلسة فقط (لا تُكتب يدوياً في الشكوى)
--     - رمز الاعتراض يُولَّد بعد إغلاق الشكوى فقط، والمعترض يرى «عنوان الاعتراض» فقط
--     - الشكوى المغلقة لا تُضاف لها جلسات (إلا بعد وصول اعتراض)؛ تعديل الجلسات متاح دائماً
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- الحالتان الجديدتان في الشكوى والجلسة
alter table public.complaints drop constraint if exists complaints_status_check;
alter table public.complaints add constraint complaints_status_check
  check (status in ('جديد', 'قيد المراجعة', 'جاري المتابعة', 'قيد مراجعة الاعتراض', 'جاري متابعة الاعتراض', 'مغلقة'));
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('جديد', 'قيد المراجعة', 'جاري المتابعة', 'قيد مراجعة الاعتراض', 'جاري متابعة الاعتراض', 'مغلقة'));

-- قبل حفظ جلسة: غير «مغلقة» ← «جاري المتابعة»، أو «جاري متابعة الاعتراض» إن كانت الجلسة بعد الاعتراض
create or replace function public.sessions_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_obj timestamptz;
begin
  select objection_at into v_obj from public.complaints where id = new.complaint_id;
  if new.status <> 'مغلقة' then
    new.status := case when v_obj is not null and new.session_at >= v_obj then 'جاري متابعة الاعتراض' else 'جاري المتابعة' end;
  end if;
  return new;
end $$;

-- إضافة جلسة (نسخة تمنع الإضافة لشكوى مغلقة)
create or replace function public.admin_add_session(
  p_secret text, p_complaint_id uuid, p_session_at timestamptz,
  p_title text, p_topic text, p_referred_to text, p_result text, p_status text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if exists (select 1 from public.complaints where id = p_complaint_id and status = 'مغلقة') then
    raise exception 'الشكوى مغلقة: يمكن تعديل جلساتها فقط';
  end if;
  insert into public.sessions (complaint_id, session_at, title, topic, referred_to, result, status)
  values (p_complaint_id, coalesce(p_session_at, now()),
          nullif(btrim(left(p_title, 200)), ''), nullif(btrim(left(p_topic, 2000)), ''),
          nullif(btrim(left(p_referred_to, 200)), ''), nullif(btrim(left(p_result, 2000)), ''), p_status);
  return query select * from public.complaints where id = p_complaint_id;
end $$;

-- تحديث الشكوى من الأدمن (نسخة لا تغيّر الحالة ولا النتيجة ولا الإغلاق — هذه من الجلسات فقط)
create or replace function public.admin_update_complaint(
  p_secret text, p_id uuid, p_classification text, p_referred_to text, p_status text,
  p_result text, p_complainant_result text, p_accused_result text,
  p_closed_date timestamptz, p_reminder_at timestamptz, p_reminder_note text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.complaints set
    classification     = nullif(btrim(p_classification), ''),
    referred_to        = nullif(btrim(p_referred_to), ''),
    complainant_result = nullif(btrim(p_complainant_result), ''),
    accused_result     = nullif(btrim(p_accused_result), ''),
    reminder_at        = p_reminder_at,
    reminder_note      = nullif(btrim(left(p_reminder_note, 500)), '')
  where id = p_id;
  return query select * from public.complaints where id = p_id;
end $$;

-- التعديل الجماعي (نسخة: التصنيف والإحالة فقط؛ الحالة والإغلاق من الجلسات)
create or replace function public.admin_bulk_update(
  p_secret text, p_ids uuid[], p_status text, p_classification text, p_referred_to text, p_closed_date timestamptz
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  update public.complaints set
    classification = coalesce(nullif(btrim(p_classification), ''), classification),
    referred_to    = coalesce(nullif(btrim(p_referred_to), ''), referred_to)
  where id = any (p_ids);
  return query select * from public.complaints where id = any (p_ids);
end $$;

-- توليد رمز الاعتراض (نسخة: بعد الإغلاق فقط، والملخص = عنوان الاعتراض تلقائياً)
create or replace function public.admin_set_objection_code(p_secret text, p_id uuid, p_summary text, p_deadline timestamptz)
returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if not exists (select 1 from public.complaints where id = p_id and status = 'مغلقة' and objection_at is null) then
    raise exception 'رمز الاعتراض يُولَّد بعد إغلاق الشكوى، ومرة اعتراض واحدة فقط';
  end if;
  update public.complaints
     set objection_code     = public.random_password(6, true),
         objection_summary  = title,
         objection_deadline = coalesce(p_deadline, now() + interval '3 days')
   where id = p_id;
  return query select * from public.complaints where id = p_id;
end $$;

-- ما يراه المعترض (نسخة: عنوان الاعتراض فقط بدل الملخص)
create or replace function public.objection_view(p_number text, p_code text)
returns table (complaint_number text, received_date timestamptz, summary text, objection_text text,
               objection_at timestamptz, deadline timestamptz, result text)
language sql stable security definer set search_path = public as $$
  select c.complaint_number, c.received_date, c.title, c.objection_text, c.objection_at,
         c.objection_deadline, c.accused_result
  from public.complaints c
  where c.complaint_number = public.normalize_number(p_number)
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g');
$$;

-- تقديم الاعتراض (نسخة: الشكوى تصبح «قيد مراجعة الاعتراض»)
create or replace function public.submit_objection(p_number text, p_code text, p_text text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_done     timestamptz;
  v_deadline timestamptz;
begin
  if coalesce(btrim(p_text), '') = '' then
    raise exception 'نص الاعتراض فارغ';
  end if;
  if length(p_text) > 5000 then
    raise exception 'تجاوز النص الطول المسموح';
  end if;
  select c.id, c.objection_at, c.objection_deadline into v_id, v_done, v_deadline
  from public.complaints c
  where c.complaint_number = public.normalize_number(p_number)
    and c.objection_code is not null
    and c.objection_code = regexp_replace(translate(coalesce(p_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '\D', '', 'g')
  for update;
  if v_id is null then
    return 'INVALID';
  end if;
  if v_done is not null then
    return 'ALREADY';
  end if;
  if v_deadline is not null and now() > v_deadline then
    return 'EXPIRED';
  end if;
  update public.complaints set
    objection_text = btrim(p_text),
    objection_at   = now(),
    status         = 'قيد مراجعة الاعتراض'
  where id = v_id;
  return 'OK';
end $$;

-- ---------------------------------------------------------------------
-- 27) القرارات الإدارية: رقم القرار، تاريخه، عنوانه، موضوعه، رابطه، وتصنيفه
--     - المدير والموظف يطّلعان ويبحثان؛ المدير وحده يضيف ويعدّل ويحذف
--     - «تصنيفات القرارات» قائمة يعدّلها المدير من «الإعدادات» (app_settings: decision_classes)
--     يُنفَّذ وحده أيضاً كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- جدول القرارات
create table if not exists public.decisions (
  id               uuid primary key default gen_random_uuid(),
  decision_number  text not null,                        -- رقم القرار الإداري
  decision_date    date,                                 -- تاريخ القرار
  title            text not null,                        -- عنوان القرار
  subject          text,                                 -- موضوع القرار
  url              text,                                 -- رابط القرار (Drive أو غيره)
  classification   text,                                 -- تصنيف القرار
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists decisions_date_idx on public.decisions (decision_date desc);
alter table public.decisions enable row level security;
revoke all on public.decisions from anon, authenticated;

-- قائمة تصنيفات القرارات الافتراضية (لا تُستبدل إن كانت موجودة)
insert into public.app_settings (key, value)
values ('decision_classes', '["تنظيمي","إداري","مالي","تأديبي","تعميم","أخرى"]')
on conflict (key) do nothing;

-- قائمة القرارات (للمدير والموظف)، الأحدث أولاً
create or replace function public.admin_list_decisions(p_secret text)
returns setof public.decisions
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  return query select * from public.decisions order by decision_date desc nulls last, created_at desc;
end $$;

-- إضافة قرار (p_id فارغ) أو تعديله (للمدير فقط)؛ الرابط يجب أن يبدأ بـ http:// أو https://
create or replace function public.admin_save_decision(
  p_secret text, p_id uuid, p_number text, p_date date, p_title text, p_subject text, p_url text, p_classification text
) returns setof public.decisions
language plpgsql security definer set search_path = public as $$
declare
  v_id  uuid := p_id;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if public.verify_password('مدير', p_secret) is null then
    return;
  end if;
  if coalesce(btrim(p_number), '') = '' or coalesce(btrim(p_title), '') = '' then
    raise exception 'رقم القرار وعنوانه إلزاميان';
  end if;
  if v_url is not null and v_url !~* '^https?://' then
    raise exception 'الرابط يجب أن يبدأ بـ https://';
  end if;
  if v_id is null then
    insert into public.decisions (decision_number, decision_date, title, subject, url, classification)
    values (btrim(left(p_number, 60)), p_date, btrim(left(p_title, 300)), nullif(btrim(left(p_subject, 5000)), ''),
            left(v_url, 1000), nullif(btrim(left(p_classification, 60)), ''))
    returning id into v_id;
  else
    update public.decisions set
      decision_number = btrim(left(p_number, 60)), decision_date = p_date, title = btrim(left(p_title, 300)),
      subject = nullif(btrim(left(p_subject, 5000)), ''), url = left(v_url, 1000),
      classification = nullif(btrim(left(p_classification, 60)), ''), updated_at = now()
    where id = v_id;
  end if;
  return query select * from public.decisions where id = v_id;
end $$;

-- حذف قرار (للمدير فقط)
create or replace function public.admin_delete_decision(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('مدير', p_secret) is null then
    return false;
  end if;
  delete from public.decisions where id = p_id;
  return found;
end $$;

-- القوائم للأدمن (نسخة تضيف «تصنيفات القرارات»)
create or replace function public.admin_get_lists(p_secret text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return null;
  end if;
  return json_build_object(
    'classifications',  coalesce(public.setting('classifications'), '[]')::json,
    'roles',            coalesce(public.setting('roles'), '[]')::json,
    'decision_classes', coalesce(public.setting('decision_classes'), '[]')::json);
end $$;

-- حفظ قائمة (نسخة تقبل decision_classes؛ للمدير فقط)
create or replace function public.admin_set_list(p_secret text, p_key text, p_items text[])
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_items text[];
begin
  if public.verify_password('مدير', p_secret) is null or p_key not in ('classifications', 'roles', 'decision_classes') then
    return 'INVALID';
  end if;
  select coalesce(array_agg(x order by o), '{}') into v_items from (
    select btrim(left(x, 60)) as x, min(o) as o
    from unnest(coalesce(p_items, '{}')) with ordinality as t(x, o)
    where btrim(coalesce(x, '')) <> ''
    group by btrim(left(x, 60))) u;
  if cardinality(v_items) > 60 then
    return 'INVALID';
  end if;
  insert into public.app_settings (key, value) values (p_key, to_json(v_items)::text)
    on conflict (key) do update set value = excluded.value;
  return 'OK';
end $$;

-- السماح للموقع باستدعاء الدوال الجديدة
grant execute on function public.admin_list_decisions(text)                                          to anon, authenticated;
grant execute on function public.admin_save_decision(text, uuid, text, date, text, text, text, text)  to anon, authenticated;
grant execute on function public.admin_delete_decision(text, uuid)                                    to anon, authenticated;

-- ---------------------------------------------------------------------
-- 28) حالة «مغلقة بعد الاعتراض»: الإغلاق النهائي بعد الاعتراض حالة مستقلة
--     جلسة إغلاق بعد وقت الاعتراض ← «مغلقة بعد الاعتراض» (وقبله ← «مغلقة»)
--     يحتاج القسمين 24 و26 قبله؛ ويُنفَّذ وحده كتحديث لقاعدة موجودة (لا يحذف بيانات)
-- ---------------------------------------------------------------------
-- الحالة السابعة في الشكوى والجلسة
alter table public.complaints drop constraint if exists complaints_status_check;
alter table public.complaints add constraint complaints_status_check
  check (status in ('جديد', 'قيد المراجعة', 'جاري المتابعة', 'قيد مراجعة الاعتراض', 'جاري متابعة الاعتراض', 'مغلقة', 'مغلقة بعد الاعتراض'));
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('جديد', 'قيد المراجعة', 'جاري المتابعة', 'قيد مراجعة الاعتراض', 'جاري متابعة الاعتراض', 'مغلقة', 'مغلقة بعد الاعتراض'));

-- عند تعديل شكوى: الحالتان المغلقتان تحملان تاريخ إغلاق، وغيرهما بلا تاريخ
create or replace function public.complaints_before_update()
returns trigger language plpgsql as $$
begin
  new.complaint_number := old.complaint_number;
  new.tracking_code    := old.tracking_code;
  new.updated_at       := now();
  if new.status in ('مغلقة', 'مغلقة بعد الاعتراض') then
    new.closed_date := coalesce(new.closed_date, now());
  else
    new.closed_date := null;
  end if;
  return new;
end $$;

-- قبل حفظ جلسة: حالتها حسب وقتها بالنسبة للاعتراض (متابعة أو إغلاق، قبل الاعتراض أو بعده)
create or replace function public.sessions_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_obj   timestamptz;
  v_after boolean;
begin
  select objection_at into v_obj from public.complaints where id = new.complaint_id;
  v_after := v_obj is not null and new.session_at >= v_obj;
  if new.status in ('مغلقة', 'مغلقة بعد الاعتراض') then
    new.status := case when v_after then 'مغلقة بعد الاعتراض' else 'مغلقة' end;
  else
    new.status := case when v_after then 'جاري متابعة الاعتراض' else 'جاري المتابعة' end;
  end if;
  return new;
end $$;

-- بعد إضافة جلسة: إن كانت الأحدث تُرحَّل حالتها ونتيجتها والمحال إليه إلى الشكوى
create or replace function public.sessions_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.sessions s
             where s.complaint_id = new.complaint_id and s.session_at > new.session_at and s.id <> new.id) then
    return new;
  end if;
  update public.complaints set
    status      = new.status,
    referred_to = coalesce(nullif(btrim(new.referred_to), ''), referred_to),
    result      = coalesce(nullif(btrim(new.result), ''), result),
    closed_date = case when new.status in ('مغلقة', 'مغلقة بعد الاعتراض') then new.session_at end
  where id = new.complaint_id;
  return new;
end $$;

-- بعد تعديل جلسة: إن كانت الأحدث تُرحَّل قيمها إلى الشكوى
create or replace function public.sessions_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.sessions s
             where s.complaint_id = new.complaint_id and s.session_at > new.session_at and s.id <> new.id) then
    return null;
  end if;
  update public.complaints set
    status      = new.status,
    referred_to = coalesce(nullif(btrim(new.referred_to), ''), referred_to),
    result      = coalesce(nullif(btrim(new.result), ''), result),
    closed_date = case when new.status in ('مغلقة', 'مغلقة بعد الاعتراض') then new.session_at end
  where id = new.complaint_id;
  return null;
end $$;

-- إضافة جلسة: ممنوعة للشكوى المغلقة (قبل الاعتراض أو بعده)
create or replace function public.admin_add_session(
  p_secret text, p_complaint_id uuid, p_session_at timestamptz,
  p_title text, p_topic text, p_referred_to text, p_result text, p_status text
) returns setof public.complaints
language plpgsql security definer set search_path = public as $$
begin
  if public.verify_password('أدمن', p_secret) is null then
    return;
  end if;
  if exists (select 1 from public.complaints where id = p_complaint_id and status in ('مغلقة', 'مغلقة بعد الاعتراض')) then
    raise exception 'الشكوى مغلقة: يمكن تعديل جلساتها فقط';
  end if;
  insert into public.sessions (complaint_id, session_at, title, topic, referred_to, result, status)
  values (p_complaint_id, coalesce(p_session_at, now()),
          nullif(btrim(left(p_title, 200)), ''), nullif(btrim(left(p_topic, 2000)), ''),
          nullif(btrim(left(p_referred_to, 200)), ''), nullif(btrim(left(p_result, 2000)), ''), p_status);
  return query select * from public.complaints where id = p_complaint_id;
end $$;

-- مرة واحدة: الشكاوى والجلسات المغلقة بعد اعتراض ← «مغلقة بعد الاعتراض» (المشغّلات موقوفة)
alter table public.complaints disable trigger user;
alter table public.sessions disable trigger user;
update public.complaints set status = 'مغلقة بعد الاعتراض' where status = 'مغلقة' and objection_at is not null;
update public.sessions s set status = 'مغلقة بعد الاعتراض'
  from public.complaints c
 where c.id = s.complaint_id and s.status = 'مغلقة' and c.objection_at is not null and s.session_at >= c.objection_at;
alter table public.sessions enable trigger user;
alter table public.complaints enable trigger user;

-- ---------------------------------------------------------------------
-- 29) إلغاء الأرشفة على Google Drive (بطلب الإدارة)
--     حذف دالة التصدير ومفتاح الأرشفة؛ جدول الإحالات و«النتيجة قبل الاعتراض» يبقيان للمنصة
--     يُنفَّذ وحده كتحديث لقاعدة نُفّذ فيها القسم 25 سابقاً (لا يحذف بيانات الشكاوى)
-- ---------------------------------------------------------------------
-- حذف دالتي الأرشفة وقيمة المفتاح المحفوظة
drop function if exists public.archive_export(text);
drop function if exists public.set_archive_key(text);
delete from public.app_settings where key = 'archive_hash';

-- ---------------------------------------------------------------------
-- 30) كلمة مرور الأدمن الأولى — غيّر 'غيّرني-123' قبل التنفيذ (6 أحرف على الأقل)
-- ---------------------------------------------------------------------
insert into public.access_passwords (role, password, holder_name)
values ('أدمن', 'غيّرني-123', 'المدير');
