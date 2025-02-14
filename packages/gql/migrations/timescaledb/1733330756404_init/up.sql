-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create a custom schema for our API functions
CREATE SCHEMA IF NOT EXISTS api;

-- Create the token metadata composite type
CREATE TYPE token_metadata AS (
  name VARCHAR(255),
  symbol VARCHAR(10),
  description TEXT,
  image_uri TEXT,
  external_url TEXT,
  decimals NUMERIC(2, 0),
  supply NUMERIC(30, 0),
  is_pump_token BOOLEAN
);

-- Create trade_history table optimized for time-series
CREATE TABLE api.trade_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  token_mint TEXT NOT NULL,
  token_price_usd NUMERIC NOT NULL,
  volume_usd NUMERIC NOT NULL,
  token_metadata token_metadata NOT NULL,
  PRIMARY KEY (created_at, token_mint, id)
);

-- Convert to hypertable with 1-hour chunks, which is a good tradeoff for efficient chunk exclusion during queries (< 1 hour) and better data management
-- This can be monitored and adjusted as needed; TimescaleDB recommends a chunk interval that results in chunks between 25MB-1GB in size
-- Run this SQL to query the chunk sizes:
-- ```sql
-- SELECT chunk_schema || '.' || chunk_name as chunk_table,
--        pg_size_pretty(pg_total_relation_size(chunk_schema || '.' || chunk_name)) as size
-- FROM timescaledb_information.chunks
-- WHERE hypertable_schema = 'api' AND hypertable_name = 'trade_history'
-- ORDER BY range_start DESC;
-- ```
SELECT create_hypertable('api.trade_history', 'created_at', 
  chunk_time_interval => INTERVAL '1 hour'
);

-- Create a token_mint index to speed up queries
CREATE INDEX trade_history_token_mint_idx ON api.trade_history (token_mint, created_at DESC);

-- Compress data older than 1 day since we mainly query recent data
ALTER TABLE api.trade_history SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'token_mint'
);

SELECT add_compression_policy('api.trade_history', INTERVAL '1 day');

-- Create continuous aggregates at 1-minute intervals
-- This helps with quick lookups for common interval queries, or for archiving data
CREATE MATERIALIZED VIEW api.trade_history_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', created_at) AS bucket,
  token_mint,
  LAST(token_price_usd, created_at) as latest_price_usd,
  FIRST(id, created_at) as id,
  FIRST(token_metadata, created_at) as token_metadata,
  AVG(token_price_usd) as avg_price_usd,
  SUM(volume_usd) as total_volume_usd,
  COUNT(*) as trade_count
FROM api.trade_history
GROUP BY bucket, token_mint
WITH NO DATA;

-- Refresh every 1 minute, keeping last 24 hours of detailed data
SELECT add_continuous_aggregate_policy('api.trade_history_1min',
  start_offset => INTERVAL '24 hours',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

COMMENT ON TABLE api.trade_history IS 'History of trades on subscribed accounts from the indexer.';