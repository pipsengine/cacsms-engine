import { isDatabaseConfigured, query } from "./db.js";

const now = () => new Date().toISOString();
const emptyArray = Object.freeze([]);
const DEFAULT_KEYWORDS = ["XAUUSD", "XAU/USD", "Gold", "BTCUSD", "BTC/USD", "NAS100", "EURUSD", "EUR/USD", "USDJPY", "USD/JPY"];
const POSITIVE_TERMS = ["bullish", "breakout", "rally", "bid", "risk-on", "buy", "long", "moon", "surge", "strong", "support"];
const NEGATIVE_TERMS = ["bearish", "dump", "panic", "sell", "short", "risk-off", "crash", "weak", "rejection", "resistance", "fear"];
const SOURCE_SYNC_FREQUENCY = "5 minutes";

export const SOCIAL_SOURCE_CATALOG = Object.freeze([
  {
    sourceKey: "x-twitter",
    source: "X / Twitter",
    connectionType: "X API v2 Recent Search",
    accountType: "X developer account with API v2 bearer token",
    credentialKeys: ["X_BEARER_TOKEN"],
    optionalKeys: ["X_SEARCH_QUERY"],
    requiredPermissions: ["tweet.read", "users.read", "recent search access"],
    dataCaptured: ["Tweet text", "Author handle", "Published time", "Public engagement metrics", "Language"],
    healthChecks: ["Bearer token exists", "Recent search endpoint responds", "Posts normalize into production schema", "Duplicate protection active"],
    rateLimitPolicy: "Uses the X API tier assigned to your bearer token; sync stores rate-limit/API errors as provider health.",
    syncFrequency: SOURCE_SYNC_FREQUENCY,
    nextAction: "Add X_BEARER_TOKEN to .env, tune X_SEARCH_QUERY, then run Sync Social Feeds."
  },
  {
    sourceKey: "youtube-comments",
    source: "YouTube Comments",
    connectionType: "YouTube Data API v3",
    accountType: "Google Cloud project with YouTube Data API enabled",
    credentialKeys: ["YOUTUBE_API_KEY"],
    optionalKeys: ["YOUTUBE_CHANNEL_IDS", "YOUTUBE_SEARCH_QUERY"],
    requiredPermissions: ["YouTube Data API v3 enabled", "commentThreads.list quota", "search.list quota"],
    dataCaptured: ["Comment text", "Channel/display author", "Video ID", "Published time", "Like count"],
    healthChecks: ["API key exists", "Video search endpoint responds", "Comment endpoint responds", "Duplicate protection active"],
    rateLimitPolicy: "Uses Google quota units; sync skips videos with disabled comments and records quota/API errors.",
    syncFrequency: SOURCE_SYNC_FREQUENCY,
    nextAction: "Add YOUTUBE_API_KEY and optional channel IDs/search terms to .env, then run Sync Social Feeds."
  },
  {
    sourceKey: "reddit",
    source: "Reddit",
    connectionType: "Reddit API",
    accountType: "Reddit app credentials for subreddit/search ingestion",
    credentialKeys: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"],
    optionalKeys: ["REDDIT_USER_AGENT", "REDDIT_SUBREDDITS", "REDDIT_SEARCH_QUERY"],
    requiredPermissions: ["read-only OAuth app", "subreddit search access", "public post/comment read access"],
    dataCaptured: ["Post/comment text", "Subreddit", "Author", "Published time", "Score/comment count"],
    healthChecks: ["Client credentials exist", "OAuth token request succeeds", "Configured subreddits/search respond", "Duplicate protection active"],
    rateLimitPolicy: "Uses Reddit OAuth rate limits; provider health records token/search failures before any data is stored.",
    syncFrequency: SOURCE_SYNC_FREQUENCY,
    nextAction: "Create a Reddit app, add credentials and subreddit/search config to .env, then run Sync Social Feeds."
  },
  {
    sourceKey: "stocktwits",
    source: "StockTwits",
    connectionType: "StockTwits Symbol Streams",
    accountType: "StockTwits public symbol stream or access token",
    credentialKeys: [],
    optionalKeys: ["STOCKTWITS_ACCESS_TOKEN", "STOCKTWITS_SYMBOLS"],
    requiredPermissions: ["public symbol stream access", "optional authenticated token for higher limits"],
    dataCaptured: ["Message body", "Username", "Symbol", "Published time", "Likes/replies", "Bullish/bearish tag"],
    healthChecks: ["Symbols configured", "Symbol stream endpoint responds", "Messages normalize into production schema", "Duplicate protection active"],
    rateLimitPolicy: "Uses StockTwits public/authenticated stream limits; missing symbols keeps the source unconfigured.",
    syncFrequency: SOURCE_SYNC_FREQUENCY,
    nextAction: "Set STOCKTWITS_SYMBOLS to monitored cashtags, optionally add STOCKTWITS_ACCESS_TOKEN, then run Sync Social Feeds."
  },
  {
    sourceKey: "telegram",
    source: "Telegram Channels",
    connectionType: "Telegram Bot API",
    accountType: "Telegram bot added to monitored channels",
    credentialKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNELS"],
    optionalKeys: [],
    requiredPermissions: ["bot access to channels", "message read access through channel updates/export", "channel IDs configured"],
    dataCaptured: ["Message text", "Channel", "Published time", "Forward/reply metadata when available"],
    healthChecks: ["Bot token exists", "Channels configured", "Bot can read configured channels", "Duplicate protection active"],
    rateLimitPolicy: "Uses Telegram Bot API limits; source remains unconfigured until token and channels are present.",
    syncFrequency: SOURCE_SYNC_FREQUENCY,
    nextAction: "Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNELS after adding the bot to your channels."
  },
  {
    sourceKey: "discord",
    source: "Discord Communities",
    connectionType: "Discord Bot API",
    accountType: "Discord bot with selected channel access",
    credentialKeys: ["DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_IDS"],
    optionalKeys: ["DISCORD_GUILD_IDS"],
    requiredPermissions: ["View Channel", "Read Message History", "channel IDs configured"],
    dataCaptured: ["Message text", "Channel/server", "Author display name", "Published time", "Reaction count"],
    healthChecks: ["Bot token exists", "Channels configured", "Bot has read permissions", "Duplicate protection active"],
    rateLimitPolicy: "Uses Discord REST rate limits; provider health records permission/rate-limit failures.",
    syncFrequency: SOURCE_SYNC_FREQUENCY,
    nextAction: "Add DISCORD_BOT_TOKEN and DISCORD_CHANNEL_IDS after granting the bot read access."
  }
]);

export const SOCIAL_SENTIMENT_ITEMS = emptyArray;
export const ASSET_CROWD_SENTIMENT = emptyArray;
export const RETAIL_POSITIONING = emptyArray;
export const SENTIMENT_SPIKES = emptyArray;
export const CONTRARIAN_SIGNALS = emptyArray;
export const SOCIAL_SOURCE_HEALTH = emptyArray;

async function rows(sql, params = []) {
  if (!isDatabaseConfigured()) return [];
  try {
    const result = await query(sql, params);
    return result.rows;
  } catch {
    return [];
  }
}

function catalogByKey(sourceKey) {
  return SOCIAL_SOURCE_CATALOG.find((source) => source.sourceKey === sourceKey);
}

function envConfigured(keys = []) {
  return keys.every((key) => String(process.env[key] || "").trim());
}

function optionalConfig(keys = []) {
  return keys.map((key) => ({ key, configured: Boolean(String(process.env[key] || "").trim()) }));
}

function requiredCredentials(keys = []) {
  return keys.map((key) => ({ key, configured: Boolean(String(process.env[key] || "").trim()) }));
}

function sourceSetupStatus(source) {
  const required = source.credentialKeys || [];
  if (!required.length) return optionalConfig(source.optionalKeys).some((item) => item.configured) ? "CONFIGURED" : "NEEDS_SOURCE_CONFIG";
  return envConfigured(required) ? "CONFIGURED" : "MISSING_CREDENTIALS";
}

function mergeCatalogSource(source, dbSource = {}) {
  const setupStatus = sourceSetupStatus(source);
  const status = setupStatus === "CONFIGURED" ? "ACTIVE" : (dbSource.status || "NOT_CONFIGURED");
  const health = setupStatus === "CONFIGURED" ? "ACTIVE" : (dbSource.health || "UNCONFIGURED");
  return {
    id: dbSource.id || source.sourceKey,
    sourceKey: source.sourceKey,
    source: dbSource.source || source.source,
    connectionType: dbSource.connection_type || source.connectionType,
    accountType: source.accountType,
    status,
    health,
    setupStatus,
    lastSync: dbSource.last_sync || null,
    postsImported: Number(dbSource.posts_imported || 0),
    errorCount: Number(dbSource.error_count || 0),
    trustScore: `${Math.round(Number(dbSource.trust_score || 0))}%`,
    rateLimitStatus: dbSource.rate_limit_status || source.rateLimitPolicy,
    syncFrequency: dbSource.sync_frequency || source.syncFrequency,
    rateLimitPolicy: source.rateLimitPolicy,
    credentials: requiredCredentials(source.credentialKeys),
    optionalConfig: optionalConfig(source.optionalKeys),
    requiredPermissions: source.requiredPermissions,
    dataCaptured: source.dataCaptured,
    healthChecks: source.healthChecks,
    nextAction: source.nextAction,
    productionOnly: true,
    mockData: false
  };
}

function configuredKeywords() {
  return String(process.env.SOCIAL_SENTIMENT_KEYWORDS || DEFAULT_KEYWORDS.join(","))
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function contentHash(value) {
  let hash = 0;
  for (const char of String(value || "")) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `social_${Math.abs(hash)}`;
}

function detectInstrument(text = "") {
  const normalized = text.toUpperCase();
  const aliases = [
    ["XAU/USD", ["XAUUSD", "XAU/USD", "GOLD"]],
    ["BTC/USD", ["BTCUSD", "BTC/USD", "BITCOIN", "BTC"]],
    ["ETH/USD", ["ETHUSD", "ETH/USD", "ETHEREUM", "ETH"]],
    ["NAS100", ["NAS100", "NASDAQ", "NDX"]],
    ["US30", ["US30", "DOW"]],
    ["EUR/USD", ["EURUSD", "EUR/USD"]],
    ["GBP/USD", ["GBPUSD", "GBP/USD"]],
    ["USD/JPY", ["USDJPY", "USD/JPY"]],
    ["Oil", ["USOIL", "WTI", "OIL"]]
  ];
  return aliases.find(([, names]) => names.some((name) => normalized.includes(name)))?.[0] || configuredKeywords().find((keyword) => normalized.includes(keyword.toUpperCase())) || null;
}

function scoreText(text = "") {
  const normalized = text.toLowerCase();
  const positive = POSITIVE_TERMS.filter((term) => normalized.includes(term)).length;
  const negative = NEGATIVE_TERMS.filter((term) => normalized.includes(term)).length;
  return Math.max(-100, Math.min(100, (positive - negative) * 25));
}

function normalizePost(input) {
  const content = String(input.content || "").trim();
  const sentimentScore = input.sentimentScore ?? scoreText(content);
  const engagement = Number(input.engagement || 0);
  const viralityScore = Math.min(100, Math.round(Math.log10(engagement + 1) * 25));
  return {
    externalId: input.externalId || contentHash(`${input.source}:${content}`),
    sourceKey: input.sourceKey,
    sourceName: input.sourceName,
    connectionType: input.connectionType,
    content,
    author: input.author || "masked_user",
    publishedAt: input.publishedAt || now(),
    instrument: input.instrument || detectInstrument(content),
    currency: input.currency || null,
    engagement,
    rawPayload: input.rawPayload || {},
    contentHash: contentHash(content),
    sentiment: input.sentiment || sentimentFromScore(sentimentScore),
    sentimentScore,
    aiConfidence: input.aiConfidence ?? (content ? 70 : 0),
    viralityScore: input.viralityScore ?? viralityScore,
    influenceScore: input.influenceScore ?? Math.min(100, Math.round(engagement / 10)),
    engagementScore: input.engagementScore ?? Math.min(100, Math.round(Math.log10(engagement + 1) * 30)),
    topicMomentum: input.topicMomentum ?? viralityScore
  };
}

async function ensureSocialSource(adapter) {
  if (!isDatabaseConfigured()) throw new Error("database_not_configured");
  const catalog = catalogByKey(adapter.sourceKey);
  const { rows: sourceRows } = await query(
    `INSERT INTO market.social_sources (source_key, name, connection_type, status, trust_score, updated_at)
     VALUES ($1, $2, $3, 'READY', 0, now())
     ON CONFLICT (source_key) DO UPDATE SET
      name = EXCLUDED.name,
      connection_type = EXCLUDED.connection_type,
      updated_at = now()
     RETURNING id, source_key, name`,
    [adapter.sourceKey, adapter.name, adapter.connectionType]
  );
  await query(
    `INSERT INTO market.social_source_configs (source_id, config, sync_frequency, enabled, updated_at)
     VALUES ($1, $2::jsonb, '5 minutes', true, now())
     ON CONFLICT DO NOTHING`,
    [sourceRows[0].id, JSON.stringify({
      provider: adapter.name,
      sourceKey: adapter.sourceKey,
      productionOnly: true,
      mockData: false,
      credentials: catalog ? requiredCredentials(catalog.credentialKeys) : [],
      optionalConfig: catalog ? optionalConfig(catalog.optionalKeys) : []
    })]
  ).catch(() => {});
  return sourceRows[0];
}

async function recordProviderHealth(sourceId, status, trustScore = 0, rateLimitStatus = "UNKNOWN", latencyMs = null) {
  if (!isDatabaseConfigured()) return;
  await query(
    `INSERT INTO market.social_provider_health (source_id, status, trust_score, rate_limit_status, latency_ms, error_count)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sourceId, status, trustScore, rateLimitStatus, latencyMs, status === "FAILED" ? 1 : 0]
  );
  await query(
    `UPDATE market.social_sources SET status = $2, trust_score = $3, updated_at = now() WHERE id = $1`,
    [sourceId, status === "ONLINE" ? "ACTIVE" : status, trustScore]
  );
}

async function sourceIdForPost(post) {
  const adapterLike = { sourceKey: post.sourceKey, name: post.sourceName, connectionType: post.connectionType };
  return (await ensureSocialSource(adapterLike)).id;
}

async function storeSocialPost(post) {
  if (!isDatabaseConfigured() || !post.content) return { inserted: false };
  const sourceId = await sourceIdForPost(post);
  const existing = await query(
    `SELECT id FROM market.social_posts
     WHERE source_id = $1 AND (external_id = $2 OR content_hash = $3)
     LIMIT 1`,
    [sourceId, post.externalId, post.contentHash]
  );
  if (existing.rows[0]) return { inserted: false, id: existing.rows[0].id };
  const { rows: insertedRows } = await query(
    `INSERT INTO market.social_posts (
      source_id, external_id, content, author, published_at, instrument, currency, engagement, raw_payload, content_hash
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
     RETURNING id`,
    [
      sourceId,
      post.externalId,
      post.content,
      post.author,
      post.publishedAt,
      post.instrument,
      post.currency,
      post.engagement,
      JSON.stringify(post.rawPayload || {}),
      post.contentHash
    ]
  );
  const postId = insertedRows[0].id;
  await query(
    `INSERT INTO market.social_sentiment_scores (
      post_id, instrument, sentiment, sentiment_score, ai_confidence, crowd_bias, contrarian_risk,
      virality_score, influence_score, engagement_score, topic_momentum
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      postId,
      post.instrument,
      post.sentiment,
      post.sentimentScore,
      post.aiConfidence,
      post.sentiment,
      riskFromScore(post.sentimentScore),
      post.viralityScore,
      post.influenceScore,
      post.engagementScore,
      post.topicMomentum
    ]
  );
  return { inserted: true, id: postId };
}

async function refreshInstrumentMentions() {
  if (!isDatabaseConfigured()) return;
  const { rows: grouped } = await query(`
    SELECT coalesce(p.instrument, score.instrument) AS instrument,
      count(*)::int AS mentions,
      avg(CASE WHEN score.sentiment_score > 15 THEN 100 ELSE 0 END) AS bullish_pct,
      avg(CASE WHEN score.sentiment_score < -15 THEN 100 ELSE 0 END) AS bearish_pct,
      avg(CASE WHEN score.sentiment_score BETWEEN -15 AND 15 THEN 100 ELSE 0 END) AS neutral_pct,
      avg(score.sentiment_score) AS sentiment_score,
      avg(score.virality_score) AS virality
    FROM market.social_posts p
    JOIN LATERAL (
      SELECT *
      FROM market.social_sentiment_scores s
      WHERE s.post_id = p.id
      ORDER BY observed_at DESC
      LIMIT 1
    ) score ON true
    WHERE coalesce(p.instrument, score.instrument) IS NOT NULL
    GROUP BY coalesce(p.instrument, score.instrument)
  `);
  for (const row of grouped) {
    const score = Math.round(Number(row.sentiment_score || 0));
    await query(
      `INSERT INTO market.social_instrument_mentions (
        instrument, mentions, bullish_pct, bearish_pct, neutral_pct, sentiment_score, virality, contrarian_risk
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        row.instrument,
        row.mentions,
        row.bullish_pct,
        row.bearish_pct,
        row.neutral_pct,
        score,
        row.virality,
        riskFromScore(score)
      ]
    );
  }
}

function sentimentFromScore(score = 0) {
  if (score >= 80) return "Strong Bullish";
  if (score >= 50) return "Bullish";
  if (score >= 15) return "Mild Bullish";
  if (score <= -80) return "Strong Bearish";
  if (score <= -50) return "Bearish";
  if (score <= -15) return "Mild Bearish";
  return "Neutral";
}

function riskFromScore(score = 0) {
  const value = Math.abs(Number(score || 0));
  if (value >= 85) return "Extreme";
  if (value >= 65) return "High";
  if (value >= 35) return "Medium";
  return "Low";
}

export function calculateSocialSentimentScore({ bullish = 0, bearish = 0, neutral = 0 } = {}) {
  const total = bullish + bearish + neutral || 1;
  return Math.round(((bullish - bearish) / total) * 100);
}

export function classifySentiment(score = 0) {
  return sentimentFromScore(score);
}

async function listSources() {
  const sourceRows = await rows(`
    SELECT id, source_key, name AS source, connection_type, status, trust_score
    FROM market.social_sources
    ORDER BY name
  `);
  const configRows = await rows(`
    SELECT DISTINCT ON (source_id) source_id, sync_frequency
    FROM market.social_source_configs
    ORDER BY source_id, updated_at DESC NULLS LAST
  `);
  const healthRows = await rows(`
    SELECT DISTINCT ON (source_id) source_id, error_count, rate_limit_status, observed_at AS last_sync
    FROM market.social_provider_health
    ORDER BY source_id, observed_at DESC
  `);
  const postRows = await rows(`
    SELECT source_id, count(*)::int AS posts_imported
    FROM market.social_posts
    GROUP BY source_id
  `);
  const configBySourceId = new Map(configRows.map((config) => [config.source_id, config]));
  const healthBySourceId = new Map(healthRows.map((health) => [health.source_id, health]));
  const postsBySourceId = new Map(postRows.map((post) => [post.source_id, post]));
  const hydratedRows = sourceRows.map((source) => {
    const config = configBySourceId.get(source.id) || {};
    const health = healthBySourceId.get(source.id) || {};
    const posts = postsBySourceId.get(source.id) || {};
    return {
      ...source,
      sync_frequency: config.sync_frequency,
      rate_limit_status: health.rate_limit_status || config.sync_frequency,
      error_count: health.error_count,
      last_sync: health.last_sync,
      posts_imported: posts.posts_imported
    };
  });
  const dbByKey = new Map(hydratedRows.map((source) => [source.source_key, source]));
  const catalogSources = SOCIAL_SOURCE_CATALOG.map((source) => mergeCatalogSource(source, dbByKey.get(source.sourceKey)));
  const extraSources = hydratedRows
    .filter((source) => !catalogByKey(source.source_key))
    .map((source) => ({
      id: source.id,
      sourceKey: source.source_key,
      source: source.source,
      connectionType: source.connection_type,
      accountType: "External production adapter",
      status: source.status,
      health: source.status,
      setupStatus: "CONFIGURED",
      lastSync: source.last_sync,
      postsImported: Number(source.posts_imported || 0),
      errorCount: Number(source.error_count || 0),
      trustScore: `${Math.round(Number(source.trust_score || 0))}%`,
      rateLimitStatus: source.rate_limit_status,
      syncFrequency: source.sync_frequency || "Not configured",
      rateLimitPolicy: source.rate_limit_status,
      credentials: [],
      optionalConfig: [],
      requiredPermissions: [],
      dataCaptured: [],
      healthChecks: [],
      nextAction: "Review this custom production source configuration.",
      productionOnly: true,
      mockData: false
    }));
  return [...catalogSources, ...extraSources];
}

async function listFeed() {
  const postRows = await rows(`
    SELECT p.id, p.content, p.author, p.published_at, p.instrument, p.currency, p.engagement,
      coalesce(src.name, 'Unknown Source') AS source,
      coalesce(score.sentiment, 'Neutral') AS sentiment,
      coalesce(score.sentiment_score, 0) AS sentiment_score,
      coalesce(score.ai_confidence, 0) AS ai_confidence,
      coalesce(score.virality_score, 0) AS virality_score,
      coalesce(score.influence_score, 0) AS influence_score
    FROM market.social_posts p
    LEFT JOIN market.social_sources src ON src.id = p.source_id
    LEFT JOIN LATERAL (
      SELECT sentiment, sentiment_score, ai_confidence, virality_score, influence_score
      FROM market.social_sentiment_scores score
      WHERE score.post_id = p.id
      ORDER BY observed_at DESC
      LIMIT 1
    ) score ON true
    ORDER BY coalesce(p.published_at, p.created_at) DESC
    LIMIT 250
  `);
  return postRows.map((post) => ({
    id: post.id,
    preview: post.content,
    source: post.source,
    author: post.author || "masked_user",
    published: post.published_at || now(),
    instrument: post.instrument || post.currency || "Unclassified",
    sentiment: post.sentiment,
    engagement: Number(post.engagement || 0),
    influenceScore: Math.round(Number(post.influence_score || 0)),
    viralityScore: Math.round(Number(post.virality_score || 0)),
    aiConfidence: Math.round(Number(post.ai_confidence || 0)),
    sentimentScore: Math.round(Number(post.sentiment_score || 0)),
    status: Number(post.virality_score || 0) >= 80 ? "VIRAL" : Number(post.engagement || 0) > 0 ? "RECORDED" : "NEW",
    relatedTopics: [],
    relatedNews: [],
    priceReactionSnapshot: "No price reaction snapshot stored yet.",
    tradingNotes: "Production record from connected/stored social sentiment data."
  }));
}

async function listHeatmap() {
  const mentionRows = await rows(`
    SELECT DISTINCT ON (instrument)
      instrument, mentions, bullish_pct, bearish_pct, neutral_pct, sentiment_score, virality, contrarian_risk, observed_at
    FROM market.social_instrument_mentions
    ORDER BY instrument, observed_at DESC
  `);
  if (mentionRows.length) {
    return mentionRows.map((row) => ({
      symbol: row.instrument,
      mentions: Number(row.mentions || 0),
      mentionVolume: Number(row.mentions || 0),
      bullish: Math.round(Number(row.bullish_pct || 0)),
      bearish: Math.round(Number(row.bearish_pct || 0)),
      neutral: Math.round(Number(row.neutral_pct || 0)),
      sentimentScore: Math.round(Number(row.sentiment_score || 0)),
      virality: Math.round(Number(row.virality || 0)),
      contrarianRisk: row.contrarian_risk || riskFromScore(row.sentiment_score),
      crowdBias: sentimentFromScore(row.sentiment_score),
      crowdRisk: row.contrarian_risk || riskFromScore(row.sentiment_score),
      workflowImpact: "Production signal"
    }));
  }
  const legacyRows = await rows(`SELECT symbol, bullish, bearish, neutral, crowd_bias, crowd_risk, workflow_impact FROM market.social_asset_sentiment ORDER BY symbol`);
  return legacyRows.map((row) => ({
    symbol: row.symbol,
    mentions: 0,
    mentionVolume: 0,
    bullish: Math.round(Number(row.bullish || 0)),
    bearish: Math.round(Number(row.bearish || 0)),
    neutral: Math.round(Number(row.neutral || 0)),
    sentimentScore: calculateSocialSentimentScore({ bullish: Number(row.bullish || 0), bearish: Number(row.bearish || 0), neutral: Number(row.neutral || 0) }),
    virality: 0,
    contrarianRisk: row.crowd_risk || "Low",
    crowdBias: row.crowd_bias || "Neutral",
    crowdRisk: row.crowd_risk || "Low",
    workflowImpact: row.workflow_impact || "Production signal"
  }));
}

async function listTopics() {
  const topicRows = await rows(`
    SELECT t.topic, t.related_instrument, t.sentiment, t.virality_score, t.first_detected_at, t.status,
      coalesce(sum(m.mention_volume), 0)::int AS mention_volume,
      coalesce(max(m.source_count), 0)::int AS source_count
    FROM market.social_topics t
    LEFT JOIN market.social_topic_mentions m ON m.topic_id = t.id
    GROUP BY t.id
    ORDER BY max(t.first_detected_at) DESC
    LIMIT 100
  `);
  return topicRows.map((topic) => ({
    topic: topic.topic,
    instrument: topic.related_instrument || "Unclassified",
    mentionVolume: Number(topic.mention_volume || 0),
    sentiment: topic.sentiment || "Neutral",
    viralityScore: Math.round(Number(topic.virality_score || 0)),
    sourceCount: Number(topic.source_count || 0),
    firstDetected: topic.first_detected_at ? new Date(topic.first_detected_at).toLocaleString() : "Not recorded",
    status: topic.status || "WATCH"
  }));
}

async function listAlerts() {
  const alertRows = await rows(`
    SELECT id, alert_type, instrument, message, risk_level, delivery_channels, status, created_at
    FROM market.social_alerts
    ORDER BY created_at DESC
    LIMIT 100
  `);
  return alertRows.map((alert) => ({
    id: alert.id,
    alert: alert.message,
    alertType: alert.alert_type,
    instrument: alert.instrument || "Market-wide",
    riskLevel: alert.risk_level,
    delivery: Array.isArray(alert.delivery_channels) ? alert.delivery_channels.join(", ") : "In-App",
    status: alert.status,
    createdAt: alert.created_at
  }));
}

async function listCorrelations() {
  const correlationRows = await rows(`
    SELECT instrument, news_sentiment, economic_calendar, cot_report, interest_rates, historical_data,
      broker_data, account_portfolio, technical_signals, interpretation
    FROM market.social_correlation_results
    ORDER BY created_at DESC
    LIMIT 100
  `);
  return correlationRows.map((row) => ({
    instrument: row.instrument,
    social: "Stored social sentiment",
    news: row.news_sentiment || "Not correlated",
    cot: row.cot_report || "Not correlated",
    economicCalendar: row.economic_calendar || "Not correlated",
    interestRates: row.interest_rates || "Not correlated",
    historicalData: row.historical_data || "Not correlated",
    brokerData: row.broker_data || "Not correlated",
    accountPortfolio: row.account_portfolio || "Not correlated",
    technicalSignals: row.technical_signals || "Not correlated",
    interpretation: row.interpretation
  }));
}

async function listRetailPositioning() {
  const retailRows = await rows(`SELECT symbol, retail_long, retail_short, crowding_score, contrarian_risk FROM market.retail_positioning ORDER BY symbol`);
  return retailRows.map((row) => ({
    asset: row.symbol,
    retailLong: Math.round(Number(row.retail_long || 0)),
    retailShort: Math.round(Number(row.retail_short || 0)),
    crowdingScore: Math.round(Number(row.crowding_score || 0)),
    contrarianRisk: row.contrarian_risk || "Low",
    historicalAccuracy: "Not recorded"
  }));
}

async function listContrarianSignals() {
  const signalRows = await rows(`
    SELECT symbol, crowd_bias, structure_bias, contrarian_score, recommendation
    FROM market.contrarian_signals
    ORDER BY created_at DESC
    LIMIT 100
  `);
  return signalRows.map((row) => ({
    asset: row.symbol,
    crowd_bias: row.crowd_bias,
    structureBias: row.structure_bias,
    contrarian_score: Math.round(Number(row.contrarian_score || 0)),
    recommendation: row.recommendation
  }));
}

async function listSpikes() {
  const spikeRows = await rows(`
    SELECT symbol, spike_type, magnitude, confidence, recommended_action, detected_at
    FROM market.sentiment_spikes
    ORDER BY detected_at DESC
    LIMIT 100
  `);
  return spikeRows.map((row) => ({
    alert: row.spike_type,
    asset: row.symbol,
    spikeType: row.spike_type,
    sentiment: "Recorded",
    magnitude: row.magnitude || "Not recorded",
    riskLevel: riskFromScore(row.confidence),
    confidence: Math.round(Number(row.confidence || 0)),
    recommendedAction: row.recommended_action || "Review",
    timeDetected: row.detected_at
  }));
}

function summarize({ sources, feed, heatmap, topics, alerts }) {
  const bullish = feed.filter((item) => /bullish/i.test(item.sentiment)).reduce((sum, item) => sum + Math.max(1, item.engagement), 0);
  const bearish = feed.filter((item) => /bearish/i.test(item.sentiment)).reduce((sum, item) => sum + Math.max(1, item.engagement), 0);
  const neutral = feed.filter((item) => /neutral|mixed/i.test(item.sentiment)).reduce((sum, item) => sum + Math.max(1, item.engagement), 0);
  const sentimentScore = calculateSocialSentimentScore({ bullish, bearish, neutral });
  const trending = heatmap.filter((row) => row.mentions > 0).sort((a, b) => b.mentions - a.mentions).slice(0, 3).map((row) => row.symbol);
  return {
    overallCrowdSentiment: feed.length ? sentimentFromScore(sentimentScore) : "No live data",
    bullishMentions: bullish,
    bearishMentions: bearish,
    neutralMentions: neutral,
    trendingInstruments: trending.length ? trending.join(", ") : "No live data",
    viralTopics: topics.filter((topic) => Number(topic.viralityScore || 0) >= 80).length,
    sentimentShift: feed.length ? "Calculated from stored social posts" : "No production social feed connected",
    retailRiskLevel: heatmap.some((row) => ["High", "Extreme"].includes(row.contrarianRisk)) ? "High" : feed.length ? "Low" : "Not available",
    fearGreedScore: feed.length ? Math.max(0, Math.min(100, Math.round((sentimentScore + 100) / 2))) : 0,
    contrarianSignal: heatmap.some((row) => ["High", "Extreme"].includes(row.contrarianRisk)) ? "Caution" : "None",
    highActivitySources: sources.filter((source) => ["ACTIVE", "ONLINE", "LIVE"].includes(source.status)).length,
    activeAlerts: alerts.filter((alert) => alert.status === "ACTIVE").length,
    sentimentScore
  };
}

function buildAiInterpretation({ empty, summary, heatmap, topics }) {
  if (empty) {
    return {
      dominantNarrative: "No production social sentiment source is connected.",
      bullishArguments: [],
      bearishArguments: [],
      overcrowdedTradeRisks: [],
      contrarianWarning: "No contrarian warning can be calculated until live social posts or imported production data are stored.",
      trendingInstruments: [],
      sentimentShiftExplanation: "Connect a social source or import production social data to calculate sentiment shifts.",
      riskMood: "Not available"
    };
  }
  const crowded = heatmap.filter((row) => ["High", "Extreme"].includes(row.contrarianRisk)).map((row) => row.symbol);
  return {
    dominantNarrative: topics[0]?.topic || `Crowd sentiment is ${summary.overallCrowdSentiment}.`,
    bullishArguments: heatmap.filter((row) => row.sentimentScore > 15).slice(0, 4).map((row) => `${row.symbol} sentiment score ${row.sentimentScore}`),
    bearishArguments: heatmap.filter((row) => row.sentimentScore < -15).slice(0, 4).map((row) => `${row.symbol} sentiment score ${row.sentimentScore}`),
    overcrowdedTradeRisks: crowded,
    contrarianWarning: crowded.length ? `${crowded.join(", ")} has elevated crowding risk.` : "No elevated contrarian warning stored.",
    trendingInstruments: summary.trendingInstruments === "No live data" ? [] : summary.trendingInstruments.split(", "),
    sentimentShiftExplanation: summary.sentimentShift,
    riskMood: summary.overallCrowdSentiment
  };
}

export function evaluateSocialSentiment({ severeManipulation = false, confirmedByRisk = false } = {}) {
  const blocked = severeManipulation && confirmedByRisk;
  const restricted = severeManipulation && !confirmedByRisk;
  return {
    source: "social_community_sentiment",
    status: "PRODUCTION_DATA_REQUIRED",
    sentiment_score: 0,
    sentiment_mode: "NOT_AVAILABLE",
    trust_score: 0,
    mention_volume: 0,
    crowd_risk_assets: [],
    contrarian_signals: [],
    workflow_permission: blocked ? "BLOCKED" : restricted ? "RESTRICTED" : "PENDING_LIVE_DATA",
    warnings: ["No mock social sentiment is used. Connect production sources to calculate this signal."],
    blocks: blocked ? ["Critical manipulation risk confirmed by news/risk governance"] : []
  };
}

export async function getSocialSentimentDashboard() {
  const [sources, feed, heatmap, topics, alerts, correlations, retailPositioning, spikes, contrarian] = await Promise.all([
    listSources(),
    listFeed(),
    listHeatmap(),
    listTopics(),
    listAlerts(),
    listCorrelations(),
    listRetailPositioning(),
    listSpikes(),
    listContrarianSignals()
  ]);
  const connectedSources = sources.filter((source) => ["ACTIVE", "ONLINE", "LIVE", "SYNCED"].includes(source.status));
  const empty = !connectedSources.length && !feed.length && !heatmap.length && !topics.length;
  const summary = summarize({ sources, feed, heatmap, topics, alerts });
  return {
    ...evaluateSocialSentiment(),
    status: empty ? "NOT_CONFIGURED" : "ACTIVE",
    sentiment_score: summary.sentimentScore,
    sentiment_mode: summary.overallCrowdSentiment,
    trust_score: sources.length ? Math.round(sources.reduce((sum, item) => sum + Number(String(item.trustScore).replace("%", "") || 0), 0) / sources.length) : 0,
    mention_volume: summary.bullishMentions + summary.bearishMentions + summary.neutralMentions,
    sourceMode: "PRODUCTION_LIVE_DATA_ONLY",
    title: "Social Sentiment Intelligence Center",
    subtitle: "Track crowd mood, trader discussions, viral market narratives, and social trading sentiment across global financial communities.",
    updatedAt: now(),
    empty,
    statusBadges: {
      socialFeed: empty ? "Not Connected" : "Active",
      aiSentimentEngine: empty ? "Waiting for Data" : "Online",
      lastSync: sources.some((source) => source.lastSync) ? "Today" : "No Sync",
      sourcesConnected: `${connectedSources.length}/${sources.length}`
    },
    summary,
    feed,
    items: feed,
    heatmap,
    assetMatrix: heatmap,
    topics,
    fearGreed: {
      score: summary.fearGreedScore,
      crowdLeverageRisk: summary.retailRiskLevel,
      overcrowdedLongs: heatmap.filter((row) => row.sentimentScore > 60).map((row) => row.symbol).join(", ") || "None",
      overcrowdedShorts: heatmap.filter((row) => row.sentimentScore < -60).map((row) => row.symbol).join(", ") || "None",
      contrarianSetup: summary.contrarianSignal,
      retailPanicSignal: heatmap.find((row) => row.sentimentScore < -70)?.symbol || "None",
      fomoSignal: heatmap.find((row) => row.sentimentScore > 70)?.symbol || "None"
    },
    aiInterpretation: buildAiInterpretation({ empty, summary, heatmap, topics }),
    retailPositioning,
    spikes,
    contrarian,
    sources,
    sourceHealth: sources.slice(0, 5),
    alerts,
    correlations
  };
}

export class SocialProviderAdapter {
  constructor(name, sourceKey, connectionType) {
    this.name = name;
    this.sourceKey = sourceKey;
    this.connectionType = connectionType;
  }
  async fetchLatestPosts() { return []; }
  async fetchByKeyword() { return []; }
  async fetchByInstrument() { return []; }
  async validateConnection() { return { ok: false, provider: this.name, reason: "production_credentials_required" }; }
  async healthCheck() { return { status: "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: "NOT_CONFIGURED", provider: this.name }; }
}

export class TwitterXAdapter extends SocialProviderAdapter {
  constructor() { super("X / Twitter", "x-twitter", "X API v2 Recent Search"); }
  get bearerToken() { return process.env.X_BEARER_TOKEN || ""; }
  get queryText() {
    return process.env.X_SEARCH_QUERY || configuredKeywords().map((keyword) => `"${keyword}"`).join(" OR ");
  }
  async validateConnection() {
    return this.bearerToken ? { ok: true, provider: this.name } : { ok: false, provider: this.name, reason: "X_BEARER_TOKEN_missing" };
  }
  async fetchLatestPosts() {
    if (!this.bearerToken) return [];
    const params = new URLSearchParams({
      query: `${this.queryText} -is:retweet`,
      max_results: "25",
      "tweet.fields": "created_at,public_metrics,author_id,lang",
      expansions: "author_id",
      "user.fields": "username,name,verified,public_metrics"
    });
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${this.bearerToken}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`x_api_http_${response.status}`);
    const payload = await response.json();
    const users = new Map((payload.includes?.users || []).map((user) => [user.id, user]));
    return (payload.data || []).map((tweet) => {
      const user = users.get(tweet.author_id);
      const metrics = tweet.public_metrics || {};
      const engagement = Number(metrics.like_count || 0) + Number(metrics.reply_count || 0) + Number(metrics.retweet_count || 0) + Number(metrics.quote_count || 0);
      return normalizePost({
        sourceKey: this.sourceKey,
        sourceName: this.name,
        connectionType: this.connectionType,
        externalId: tweet.id,
        content: tweet.text,
        author: user?.username ? `@${user.username}` : tweet.author_id,
        publishedAt: tweet.created_at,
        engagement,
        rawPayload: tweet
      });
    });
  }
  async healthCheck() { return this.bearerToken ? { status: "READY", provider: this.name } : { status: "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: this.bearerToken ? "API_CONFIGURED" : "NOT_CONFIGURED", provider: this.name }; }
}

export class YouTubeCommentsAdapter extends SocialProviderAdapter {
  constructor() { super("YouTube Comments", "youtube-comments", "YouTube Data API"); }
  get apiKey() { return process.env.YOUTUBE_API_KEY || ""; }
  get searchQuery() { return process.env.YOUTUBE_SEARCH_QUERY || configuredKeywords().join(" OR "); }
  get channelIds() { return String(process.env.YOUTUBE_CHANNEL_IDS || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean); }
  async validateConnection() {
    return this.apiKey ? { ok: true, provider: this.name } : { ok: false, provider: this.name, reason: "YOUTUBE_API_KEY_missing" };
  }
  async videoIds() {
    if (!this.apiKey) return [];
    const ids = [];
    const channels = this.channelIds.length ? this.channelIds : [""];
    for (const channelId of channels) {
      const params = new URLSearchParams({
        key: this.apiKey,
        part: "snippet",
        type: "video",
        maxResults: "8",
        order: "date",
        q: this.searchQuery
      });
      if (channelId) params.set("channelId", channelId);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`youtube_search_http_${response.status}`);
      const payload = await response.json();
      ids.push(...(payload.items || []).map((item) => item.id?.videoId).filter(Boolean));
    }
    return [...new Set(ids)].slice(0, 12);
  }
  async fetchLatestPosts() {
    if (!this.apiKey) return [];
    const posts = [];
    for (const videoId of await this.videoIds()) {
      const params = new URLSearchParams({
        key: this.apiKey,
        part: "snippet",
        videoId,
        maxResults: "30",
        order: "time",
        textFormat: "plainText"
      });
      const response = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        if (response.status === 403 || response.status === 404) continue;
        throw new Error(`youtube_comments_http_${response.status}`);
      }
      const payload = await response.json();
      for (const item of payload.items || []) {
        const comment = item.snippet?.topLevelComment?.snippet;
        if (!comment?.textDisplay) continue;
        posts.push(normalizePost({
          sourceKey: this.sourceKey,
          sourceName: this.name,
          connectionType: this.connectionType,
          externalId: item.id,
          content: comment.textDisplay,
          author: comment.authorDisplayName,
          publishedAt: comment.publishedAt,
          engagement: Number(comment.likeCount || 0),
          rawPayload: { videoId, commentThreadId: item.id }
        }));
      }
    }
    return posts;
  }
  async healthCheck() { return this.apiKey ? { status: "READY", provider: this.name } : { status: "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: this.apiKey ? "API_CONFIGURED" : "NOT_CONFIGURED", provider: this.name }; }
}

export class RedditAdapter extends SocialProviderAdapter {
  constructor() { super("Reddit", "reddit", "Reddit API"); }
  get configured() { return Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET); }
  get userAgent() { return process.env.REDDIT_USER_AGENT || "cacsms-engine-social-sentiment/1.0"; }
  get subreddits() { return String(process.env.REDDIT_SUBREDDITS || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean); }
  get searchQuery() { return process.env.REDDIT_SEARCH_QUERY || configuredKeywords().join(" OR "); }
  async validateConnection() {
    return this.configured ? { ok: true, provider: this.name } : { ok: false, provider: this.name, reason: "REDDIT_CLIENT_ID_or_REDDIT_CLIENT_SECRET_missing" };
  }
  async accessToken() {
    const response = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": this.userAgent
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`reddit_oauth_http_${response.status}`);
    const payload = await response.json();
    if (!payload.access_token) throw new Error("reddit_access_token_missing");
    return payload.access_token;
  }
  async fetchLatestPosts() {
    if (!this.configured) return [];
    const token = await this.accessToken();
    const targets = this.subreddits.length ? this.subreddits : [""];
    const posts = [];
    for (const subreddit of targets) {
      const params = new URLSearchParams({ q: this.searchQuery, sort: "new", limit: "25" });
      if (subreddit) params.set("restrict_sr", "1");
      const path = subreddit ? `/r/${encodeURIComponent(subreddit)}/search` : "/search";
      const response = await fetch(`https://oauth.reddit.com${path}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`reddit_search_http_${response.status}`);
      const payload = await response.json();
      for (const child of payload.data?.children || []) {
        const item = child.data || {};
        const content = [item.title, item.selftext].filter(Boolean).join("\n\n");
        if (!content) continue;
        posts.push(normalizePost({
          sourceKey: this.sourceKey,
          sourceName: this.name,
          connectionType: this.connectionType,
          externalId: item.name || item.id,
          content,
          author: item.author ? `u/${item.author}` : "reddit_user",
          publishedAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : now(),
          engagement: Number(item.score || 0) + Number(item.num_comments || 0),
          rawPayload: { subreddit: item.subreddit, permalink: item.permalink }
        }));
      }
    }
    return posts;
  }
  async healthCheck() { return { status: this.configured ? "READY" : "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: this.configured ? "API_CONFIGURED" : "NOT_CONFIGURED", provider: this.name }; }
}

export class StockTwitsAdapter extends SocialProviderAdapter {
  constructor() { super("StockTwits", "stocktwits", "StockTwits Symbol Streams"); }
  get symbols() { return String(process.env.STOCKTWITS_SYMBOLS || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean); }
  async validateConnection() {
    return this.symbols.length ? { ok: true, provider: this.name } : { ok: false, provider: this.name, reason: "STOCKTWITS_SYMBOLS_missing" };
  }
  async fetchLatestPosts() {
    if (!this.symbols.length) return [];
    const posts = [];
    for (const symbol of this.symbols.slice(0, 12)) {
      const params = new URLSearchParams();
      if (process.env.STOCKTWITS_ACCESS_TOKEN) params.set("access_token", process.env.STOCKTWITS_ACCESS_TOKEN);
      const suffix = params.toString() ? `?${params}` : "";
      const response = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json${suffix}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`stocktwits_stream_http_${response.status}`);
      const payload = await response.json();
      for (const message of payload.messages || []) {
        posts.push(normalizePost({
          sourceKey: this.sourceKey,
          sourceName: this.name,
          connectionType: this.connectionType,
          externalId: String(message.id),
          content: message.body,
          author: message.user?.username ? `@${message.user.username}` : "stocktwits_user",
          publishedAt: message.created_at,
          instrument: symbol.toUpperCase(),
          engagement: Number(message.likes?.total || 0) + Number(message.conversation?.replies || 0),
          sentimentScore: message.entities?.sentiment?.basic === "Bullish" ? 50 : message.entities?.sentiment?.basic === "Bearish" ? -50 : undefined,
          rawPayload: { symbol, sentiment: message.entities?.sentiment?.basic }
        }));
      }
    }
    return posts;
  }
  async healthCheck() { return { status: this.symbols.length ? "READY" : "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: this.symbols.length ? "STREAM_CONFIGURED" : "NOT_CONFIGURED", provider: this.name }; }
}

export class TelegramAdapter extends SocialProviderAdapter {
  constructor() { super("Telegram Channels", "telegram", "Telegram Bot API"); }
  get configured() { return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNELS); }
  get channels() { return String(process.env.TELEGRAM_CHANNELS || "").split(/[,;]+/).map((item) => item.trim().replace(/^@/, "")).filter(Boolean); }
  async validateConnection() {
    return this.configured ? { ok: true, provider: this.name } : { ok: false, provider: this.name, reason: "TELEGRAM_BOT_TOKEN_or_TELEGRAM_CHANNELS_missing" };
  }
  async fetchLatestPosts() {
    if (!this.configured) return [];
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=100`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`telegram_updates_http_${response.status}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error("telegram_updates_not_ok");
    const allowed = new Set(this.channels.map((channel) => channel.toLowerCase()));
    return (payload.result || []).flatMap((update) => {
      const message = update.channel_post || update.message || update.edited_channel_post || update.edited_message;
      const chat = message?.chat || {};
      const channelName = String(chat.username || chat.id || "").toLowerCase();
      if (allowed.size && !allowed.has(channelName) && !allowed.has(String(chat.id))) return [];
      const content = message?.text || message?.caption || "";
      if (!content) return [];
      return [normalizePost({
        sourceKey: this.sourceKey,
        sourceName: this.name,
        connectionType: this.connectionType,
        externalId: `${chat.id}:${message.message_id}`,
        content,
        author: chat.username ? `@${chat.username}` : chat.title || "telegram_channel",
        publishedAt: message.date ? new Date(message.date * 1000).toISOString() : now(),
        engagement: Number(message.forward_count || 0) + Number(message.reply_to_message ? 1 : 0),
        rawPayload: { chatId: chat.id, messageId: message.message_id }
      })];
    });
  }
  async healthCheck() { return { status: this.configured ? "READY" : "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: this.configured ? "BOT_CONFIGURED" : "NOT_CONFIGURED", provider: this.name }; }
}

export class DiscordAdapter extends SocialProviderAdapter {
  constructor() { super("Discord Communities", "discord", "Discord Bot API"); }
  get configured() { return Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_CHANNEL_IDS); }
  get channelIds() { return String(process.env.DISCORD_CHANNEL_IDS || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean); }
  async validateConnection() {
    return this.configured ? { ok: true, provider: this.name } : { ok: false, provider: this.name, reason: "DISCORD_BOT_TOKEN_or_DISCORD_CHANNEL_IDS_missing" };
  }
  async fetchLatestPosts() {
    if (!this.configured) return [];
    const posts = [];
    for (const channelId of this.channelIds.slice(0, 20)) {
      const response = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages?limit=50`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`discord_messages_http_${response.status}`);
      const messages = await response.json();
      for (const message of messages || []) {
        if (!message.content) continue;
        const reactions = (message.reactions || []).reduce((sum, reaction) => sum + Number(reaction.count || 0), 0);
        posts.push(normalizePost({
          sourceKey: this.sourceKey,
          sourceName: this.name,
          connectionType: this.connectionType,
          externalId: message.id,
          content: message.content,
          author: message.author?.username ? `@${message.author.username}` : "discord_user",
          publishedAt: message.timestamp,
          engagement: reactions,
          rawPayload: { channelId, messageId: message.id }
        }));
      }
    }
    return posts;
  }
  async healthCheck() { return { status: this.configured ? "READY" : "NOT_CONFIGURED", provider: this.name }; }
  async getRateLimitStatus() { return { status: this.configured ? "BOT_CONFIGURED" : "NOT_CONFIGURED", provider: this.name }; }
}

export function defaultSocialAdapters() {
  return [new TwitterXAdapter(), new YouTubeCommentsAdapter(), new RedditAdapter(), new StockTwitsAdapter(), new TelegramAdapter(), new DiscordAdapter()];
}

export class SocialSentimentSyncService {
  constructor({ adapters = defaultSocialAdapters() } = {}) { this.adapters = adapters; }
  async fetchNewPosts() {
    const posts = [];
    for (const adapter of this.adapters) {
      const source = await ensureSocialSource(adapter);
      const started = Date.now();
      try {
        const validation = await adapter.validateConnection();
        if (!validation.ok) {
          await recordProviderHealth(source.id, "NOT_CONFIGURED", 0, validation.reason);
          continue;
        }
        const fetched = await adapter.fetchLatestPosts();
        posts.push(...fetched);
        await recordProviderHealth(source.id, "ONLINE", 100, "OK", Date.now() - started);
      } catch (error) {
        await recordProviderHealth(source.id, "FAILED", 0, error.message, Date.now() - started);
      }
    }
    return posts;
  }
  async detectUpdatedPosts(posts = []) { return posts; }
  async deduplicateSimilarContent(posts = []) { return [...new Map(posts.map((post) => [String(post.content || post.preview || "").toLowerCase(), post])).values()]; }
  async classifyInstruments(posts = []) { return posts; }
  async analyzeSentiment(posts = []) { return posts; }
  calculateEngagement(post) { return Number(post.engagement || 0); }
  calculateVirality(post) { return Number(post.viralityScore || 0); }
  calculateInfluenceScore(post) { return Number(post.influenceScore || 0); }
  async storeResults(posts = []) {
    let stored = 0;
    let duplicates = 0;
    for (const post of posts) {
      const result = await storeSocialPost(post);
      if (result.inserted) stored += 1;
      else duplicates += 1;
    }
    await refreshInstrumentMentions();
    return { stored, duplicates };
  }
  async triggerAlerts() { return []; }
  async sync({ frequency = "5 minutes" } = {}) {
    const posts = await this.analyzeSentiment(await this.classifyInstruments(await this.deduplicateSimilarContent(await this.fetchNewPosts())));
    const storage = await this.storeResults(posts);
    return { syncedAt: now(), frequency, postsFetched: posts.length, postsStored: storage.stored, duplicatesSkipped: storage.duplicates, alertsTriggered: 0, status: posts.length ? "COMPLETED" : "NO_PRODUCTION_SOURCE_CONNECTED" };
  }
}

export const getSocialSentimentSummary = async () => {
  const dashboard = await getSocialSentimentDashboard();
  return { summary: dashboard.summary, statusBadges: dashboard.statusBadges };
};
export const getSocialSentimentFeed = async () => ({ items: await listFeed() });
export const getSocialSentimentHeatmap = async () => {
  const heatmap = await listHeatmap();
  return { heatmap, assets: heatmap };
};
export const getSocialSentimentTopics = async () => ({ topics: await listTopics() });
export const getSocialFearGreed = async () => ({ fearGreed: (await getSocialSentimentDashboard()).fearGreed });
export const getSocialSentimentSources = async () => ({ sources: await listSources() });
export const getSocialSentimentAlerts = async () => ({ alerts: await listAlerts() });
export const getSocialSentimentCorrelations = async () => ({ correlations: await listCorrelations() });
export const getSocialSentimentExport = async () => ({ format: "json", exportedAt: now(), dashboard: await getSocialSentimentDashboard() });
export const syncSocialSentiment = (options = {}) => new SocialSentimentSyncService().sync(options);
export const analyzeSocialSentiment = async (input = {}) => ({ analyzedAt: now(), input, summary: (await getSocialSentimentDashboard()).aiInterpretation });
