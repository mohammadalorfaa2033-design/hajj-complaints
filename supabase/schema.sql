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
drop function if exists public.setting(text);

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
insert into public.app_settings (key, value) values ('access_mode', 'private'), ('direct_enabled', 'on');

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
-- 11) كلمة مرور الأدمن الأولى — غيّر 'غيّرني-123' قبل التنفيذ (6 أحرف على الأقل)
-- ---------------------------------------------------------------------
insert into public.access_passwords (role, password, holder_name)
values ('أدمن', '12345', 'المدير');
