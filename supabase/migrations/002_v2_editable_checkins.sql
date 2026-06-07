-- V2 打卡记录编辑追踪字段
ALTER TABLE checkins
ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES users(id);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_checkins_sequence ON checkins(user_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_tracks_created ON tracks(created_at DESC);
