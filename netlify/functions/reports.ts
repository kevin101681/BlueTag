import { Client } from 'pg';

// Netlify/Neon integration often injects NETLIFY_DATABASE_URL. 
// We check both standard DATABASE_URL and the Netlify specific one.
const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export const handler = async (event: any, context: any) => {
  // Ensure the function can return without waiting on open handles.
  // (Netlify uses AWS Lambda-style execution; this helps avoid edge cases.)
  if (typeof context === 'object' && context) {
    (context as any).callbackWaitsForEmptyEventLoop = false;
  }

  // 1. Security Check: Ensure user is logged in via Netlify Identity
  const user = context.clientContext?.user;
  if (!user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Unauthorized. Please log in." }),
    };
  }

  // 2. Configuration Check
  if (!connectionString) {
    console.error("Database connection string missing. Ensure DATABASE_URL or NETLIFY_DATABASE_URL is set.");
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Server misconfiguration: Missing Database URL." }),
    };
  }

  const userId = user.sub; // Unique Google/Netlify User ID

  // 3. Database Connection
  // Use proper SSL validation - Neon and most providers have valid certificates
  const client = new Client({
    connectionString,
    ssl: connectionString?.includes('localhost') ? false : true,
  });

  try {
    await client.connect();

    // 4. Auto-Init: Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        last_modified BIGINT,
        data JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    `);

    const method = event.httpMethod;
    const qs = event.queryStringParameters || {};

    // GET: Fetch all reports for this user
    if (method === 'GET') {
      // Summary endpoint: returns only IDs + last_modified to avoid >6MB Lambda responses.
      // Use: /.netlify/functions/reports?summary=1
      if (qs.summary === '1' || qs.summary === 'true') {
        const result = await client.query(
          'SELECT id, last_modified FROM reports WHERE user_id = $1 ORDER BY last_modified DESC',
          [userId]
        );

        const summaries = result.rows.map((row: any) => ({
          id: row.id,
          lastModified: Number(row.last_modified) || 0,
        }));

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(summaries),
        };
      }

      // Single-report endpoint: /.netlify/functions/reports?id=<reportId>
      if (qs.id) {
        const result = await client.query(
          'SELECT data FROM reports WHERE user_id = $1 AND id = $2 LIMIT 1',
          [userId, qs.id]
        );

        if (result.rowCount === 0) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Report not found' }),
          };
        }

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result.rows[0].data),
        };
      }

      // Backward-compatible full fetch (may exceed Lambda limits for large accounts).
      const result = await client.query(
        'SELECT data FROM reports WHERE user_id = $1 ORDER BY last_modified DESC',
        [userId]
      );

      const reports = result.rows.map((row: any) => row.data);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reports),
      };
    }

    // POST: Save (Upsert) a report
    if (method === 'POST') {
      const report = JSON.parse(event.body);
      
      if (!report.id) {
         return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "Report ID missing" }) };
      }

      // Upsert query
      const query = `
        INSERT INTO reports (id, user_id, last_modified, data)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) 
        DO UPDATE SET 
          last_modified = EXCLUDED.last_modified,
          data = EXCLUDED.data;
      `;

      await client.query(query, [report.id, userId, report.lastModified, JSON.stringify(report)]);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    // DELETE: Delete a report
    if (method === 'DELETE') {
      const { id } = event.queryStringParameters;
      
      if (!id) {
          return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: "ID missing" }) };
      }

      await client.query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [id, userId]);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error: any) {
    console.error('Database Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Database operation failed", details: error.message }),
    };
  } finally {
    // Ensure client is closed to prevent hanging functions
    try {
      await client.end();
    } catch (e) {
      // If connect() failed, end() can throw; never let cleanup crash the function
      console.warn('Failed to close DB client cleanly', e);
    }
  }
};