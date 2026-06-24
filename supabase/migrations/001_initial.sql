-- 外场投诉测试管理平台数据库初始化脚本

-- 用户表扩展（与 Supabase Auth 关联）
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text unique not null,
  role text not null check (role in ('admin', 'tester')),
  status text not null default 'offline' check (status in ('online', 'offline', 'busy')),
  color text,
  created_at timestamptz default now() not null
);

-- 轨迹表
create table if not exists public.tracks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  latitude double precision not null,
  longitude double precision not null,
  speed double precision default 0,
  battery double precision default 100,
  created_at timestamptz default now() not null
);

-- 打卡表
create table if not exists public.checkins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  sequence_no integer not null,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  title text,
  complaint_content text,
  test_result text,
  solution_result text,
  remark text,
  gps_accuracy double precision,
  gps_status text,
  created_at timestamptz default now() not null
);

-- 照片表
create table if not exists public.photos (
  id uuid default gen_random_uuid() primary key,
  checkin_id uuid references public.checkins(id) on delete cascade not null,
  photo_url text not null,
  created_at timestamptz default now() not null
);

-- 索引
create index if not exists idx_tracks_user_id on public.tracks(user_id);
create index if not exists idx_tracks_created_at on public.tracks(created_at);
create index if not exists idx_tracks_user_created on public.tracks(user_id, created_at);

create index if not exists idx_checkins_user_id on public.checkins(user_id);
create index if not exists idx_checkins_created_at on public.checkins(created_at);
create index if not exists idx_checkins_user_created on public.checkins(user_id, created_at);

create index if not exists idx_photos_checkin_id on public.photos(checkin_id);

-- RLS 策略
alter table public.users enable row level security;
alter table public.tracks enable row level security;
alter table public.checkins enable row level security;
alter table public.photos enable row level security;

-- 允许所有认证用户读取 users
create policy "Allow authenticated read users"
  on public.users for select to authenticated using (true);

-- 允许用户更新自己的状态
create policy "Allow users update own status"
  on public.users for update to authenticated using (auth.uid() = id);

-- 允许测试人员插入轨迹
create policy "Allow insert tracks"
  on public.tracks for insert to authenticated with check (auth.uid() = user_id);

-- 允许所有人读取轨迹
create policy "Allow read tracks"
  on public.tracks for select to authenticated using (true);

-- 允许测试人员插入打卡
create policy "Allow insert checkins"
  on public.checkins for insert to authenticated with check (auth.uid() = user_id);

-- 允许所有人读取打卡
create policy "Allow read checkins"
  on public.checkins for select to authenticated using (true);

-- 允许测试人员插入照片
create policy "Allow insert photos"
  on public.photos for insert to authenticated with check (true);

-- 允许所有人读取照片
create policy "Allow read photos"
  on public.photos for select to authenticated using (true);

-- 存储 bucket
delete from storage.buckets where id = 'checkin-photos';
insert into storage.buckets (id, name, public) values ('checkin-photos', 'checkin-photos', true);

create policy "Allow public read photos"
  on storage.objects for select to public using (bucket_id = 'checkin-photos');

create policy "Allow authenticated upload photos"
  on storage.objects for insert to authenticated with check (bucket_id = 'checkin-photos');

-- Realtime 启用
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.tracks;
alter publication supabase_realtime add table public.checkins;

-- 触发器：新用户自动创建 public.users 记录
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, phone, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'phone', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'tester'),
    'offline'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
