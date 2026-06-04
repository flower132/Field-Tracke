# 外场投诉测试管理平台 (Field Tracker)

企业级外场投诉测试管理平台，用于管理投诉处理测试人员的实时位置、轨迹、打卡记录和现场照片。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + TailwindCSS
- **地图**: Leaflet + React-Leaflet (OpenStreetMap)
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **后端**: Supabase (Auth + Database + Storage + Realtime)
- **部署**: PWA (支持安卓安装和 iOS 添加到主屏幕)

## 功能模块

### Phase 1 (MVP)
- [x] 登录与角色认证（管理员 / 测试人员）
- [x] 实时位置监控（60秒间隔上传，后台持续运行）
- [x] 地图展示（OpenStreetMap，多图层切换）
- [x] 轨迹记录（今日/昨日/7天/自定义日期）
- [x] 轨迹回放（选择人员+日期，支持暂停/继续/倍速）
- [x] 投诉处理打卡（自动生成顺序编号 ①②③...）
- [x] 现场照片上传（最多9张，调用相机或相册）
- [x] 打卡点管理（列表/地图双模式）
- [x] 统计分析（首页统计卡片、人员统计、投诉热力图）

### Phase 2 (后续)
- [ ] 更丰富的报表导出
- [ ] 轨迹优化与抽稀
- [ ] 离线缓存增强

### Phase 3 (后续)
- [ ] GIS 系统联动接口
- [ ] 工单系统对接
- [ ] 基站/小区/覆盖信息查询

## 项目结构

```
src/
├── api/           # Supabase 客户端与 API
├── components/    # 共享组件（Layout, BottomNav）
├── hooks/         # 自定义 Hooks
├── pages/         # 页面组件
├── store/         # Zustand 状态管理
├── types/         # TypeScript 类型定义
├── utils/         # 工具函数与常量
├── App.tsx        # 路由配置
└── main.tsx       # 应用入口
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填写 Supabase 配置：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 初始化数据库

在 Supabase SQL Editor 中执行 `supabase/migrations/001_initial.sql`。

### 4. 启动开发服务器

```bash
npm run dev
```

### 5. 构建生产版本

```bash
npm run build
```

## PWA 支持

- 支持离线缓存（Service Worker）
- 支持安装到桌面（安卓）
- 支持添加到主屏幕（iOS）
- 自动更新

## 性能优化

- 照片懒加载
- 轨迹查询索引优化
- 地图图层按需加载
- Realtime 增量更新

## 测试账号

- 管理员: `admin` / `123456`
- 测试人员: `tester` / `123456`

## 许可证

企业内部使用
