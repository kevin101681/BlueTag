import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

export const handler = async (event: any, context: any) => {
  if (typeof context === 'object' && context) {
    (context as any).callbackWaitsForEmptyEventLoop = false;
  }

  const user = context.clientContext?.user;
  if (!user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized. Please log in.' }),
    };
  }

  if (!connectionString) {
    console.error('Database connection string missing.');
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server misconfiguration: Missing Database URL.' }),
    };
  }

  const userId: string = user.sub;
  const userEmail: string | undefined = user.email;

  const client = new Client({
    connectionString,
    ssl: connectionString?.includes('localhost') ? false : true,
  });

  try {
    await client.connect();

    // Ensure tables exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        last_modified BIGINT,
        data JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

      CREATE TABLE IF NOT EXISTS report_shares (
        report_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        owner_email TEXT,
        shared_with_email TEXT NOT NULL,
        created_at BIGINT NOT NULL DEFAULT 0,
        PRIMARY KEY (report_id, shared_with_email)
      );
      CREATE INDEX IF NOT EXISTS idx_shares_email ON report_shares(shared_with_email);
      CREATE INDEX IF NOT EXISTS idx_shares_owner ON report_shares(owner_user_id);
    `);

    const method = event.httpMethod;
    const qs = event.queryStringParameters || {};

    // ── GET ─────────────────────────────────────────────────────────────────
    if (method === 'GET') {

      // GET ?reportId=<id>  →  list who a report is shared with (owner only)
      if (qs.reportId && !qs.mode) {
        const ownCheck = await client.query(
          'SELECT id FROM reports WHERE id = $1 AND user_id = $2 LIMIT 1',
          [qs.reportId, userId]
        );
        if ((ownCheck.rowCount ?? 0) === 0) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'You do not own this report.' }),
          };
        }
        const result = await client.query(
          'SELECT shared_with_email, created_at FROM report_shares WHERE report_id = $1 AND owner_user_id = $2 ORDER BY created_at ASC',
          [qs.reportId, userId]
        );
        const shares = result.rows.map((row: any) => ({
          sharedWithEmail: row.shared_with_email,
          createdAt: Number(row.created_at),
        }));
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shares),
        };
      }

      // GET ?mode=shared-with-me  →  summaries of all reports shared with current user
      if (qs.mode === 'shared-with-me' && !qs.id) {
        if (!userEmail) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'User email not available.' }),
          };
        }
        const result = await client.query(
          `SELECT rs.report_id, r.last_modified, rs.owner_user_id, rs.owner_email
           FROM report_shares rs
           JOIN reports r ON r.id = rs.report_id
           WHERE rs.shared_with_email = $1
           ORDER BY r.last_modified DESC`,
          [userEmail.toLowerCase()]
        );
        const summaries = result.rows.map((row: any) => ({
          id: row.report_id,
          lastModified: Number(row.last_modified) || 0,
          ownerUserId: row.owner_user_id,
          ownerEmail: row.owner_email || undefined,
        }));
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(summaries),
        };
      }

      // GET ?mode=shared-with-me&id=<reportId>  →  full report data (recipient access)
      if (qs.mode === 'shared-with-me' && qs.id) {
        if (!userEmail) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'User email not available.' }),
          };
        }
        const shareCheck = await client.query(
          'SELECT report_id FROM report_shares WHERE report_id = $1 AND shared_with_email = $2 LIMIT 1',
          [qs.id, userEmail.toLowerCase()]
        );
        if ((shareCheck.rowCount ?? 0) === 0) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Shared report not found or access revoked.' }),
          };
        }
        const reportResult = await client.query(
          'SELECT data FROM reports WHERE id = $1 LIMIT 1',
          [qs.id]
        );
        if ((reportResult.rowCount ?? 0) === 0) {
          return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Report not found.' }),
          };
        }
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportResult.rows[0].data),
        };
      }

      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid query parameters.' }),
      };
    }

    // ── POST ────────────────────────────────────────────────────────────────
    // Body: { reportId, email }  →  share a report with someone
    if (method === 'POST') {
      let body: any = {};
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid request body.' }),
        };
      }

      const { reportId, email } = body;
      if (!reportId || !email) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'reportId and email are required.' }),
        };
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      if (userEmail && normalizedEmail === userEmail.toLowerCase()) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'You cannot share a report with yourself.' }),
        };
      }

      // Must own the report
      const ownCheck = await client.query(
        'SELECT id FROM reports WHERE id = $1 AND user_id = $2 LIMIT 1',
        [reportId, userId]
      );
      if ((ownCheck.rowCount ?? 0) === 0) {
        return {
          statusCode: 403,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'You do not own this report.' }),
        };
      }

      await client.query(
        `INSERT INTO report_shares (report_id, owner_user_id, owner_email, shared_with_email, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (report_id, shared_with_email) DO NOTHING`,
        [reportId, userId, userEmail || null, normalizedEmail, Date.now()]
      );

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    // ── DELETE ──────────────────────────────────────────────────────────────
    if (method === 'DELETE') {
      const { reportId, email } = qs;

      if (!reportId) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'reportId is required.' }),
        };
      }

      if (email) {
        // Owner revoking access for a specific recipient
        const normalizedEmail = String(email).trim().toLowerCase();
        const ownCheck = await client.query(
          'SELECT id FROM reports WHERE id = $1 AND user_id = $2 LIMIT 1',
          [reportId, userId]
        );
        if ((ownCheck.rowCount ?? 0) === 0) {
          return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'You do not own this report.' }),
          };
        }
        await client.query(
          'DELETE FROM report_shares WHERE report_id = $1 AND owner_user_id = $2 AND shared_with_email = $3',
          [reportId, userId, normalizedEmail]
        );
      } else {
        // Recipient removing themselves from a share
        if (!userEmail) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'User email not available.' }),
          };
        }
        await client.query(
          'DELETE FROM report_shares WHERE report_id = $1 AND shared_with_email = $2',
          [reportId, userEmail.toLowerCase()]
        );
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true }),
      };
    }

    return { statusCode: 405, body: 'Method Not Allowed' };

  } catch (error: any) {
    console.error('Shares function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Database operation failed', details: error.message }),
    };
  } finally {
    try {
      await client.end();
    } catch (e) {
      console.warn('Failed to close DB client cleanly', e);
    }
  }
};
