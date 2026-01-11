DROP TABLE IF EXISTS view_counts CASCADE;

CREATE TABLE view_counts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_view_counts_media_viewed ON view_counts(media_id, viewed_at);

