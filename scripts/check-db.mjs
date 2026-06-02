import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows: schemas } = await pool.query(
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('market','infrastructure') ORDER BY 1"
);
const { rows: tables } = await pool.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'market' AND table_name LIKE 'market_data%' ORDER BY 1"
);
const { rows: catalog } = await pool.query(
  "SELECT to_regclass('infrastructure.broker_server_catalog') AS name"
);
console.log(JSON.stringify({ schemas, tables, brokerCatalog: catalog[0]?.name }, null, 2));
await pool.end();
