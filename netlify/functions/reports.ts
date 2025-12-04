import { Client } from 'pg';

// Netlify injects DATABASE_URL from the Neon extension automatically
const connectionString = process.env.DATABASE_URL;

export const handler = async (event: any, context: any) => {
  // 1. Security Check: Ensure user is logged in via Netlify Identity
  const user = context.clientContext?.user;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized. Please log in." }),
    };
  }

  const userId = user.sub; // Unique Google/Netlify User ID

  // 2. Database Connection
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Neon requires SSL
  });

  try {
    await client.connect();

    // 3. Handle Request Methods
    const method = event.httpMethod;

    // GET: Fetch all reports for this user
    if (method === 'GET') {
      const result = await client.query(
        'SELECT data FROM reports WHERE user_id = $1 ORDER BY last_modified DESC',
        [userId]
      );
      
      // Extract the JSON blob from the row
      const reports = result.rows.map((row: any) => row.data);
      
      return {
        statusCode: 200,
        body: JSON.stringify(reports),
      };
    }

    // POST: Save (Upsert) a report
    if (method === 'POST') {
      const report = JSON.parse(event.body);
      
      if (!report.id) {
         return { statusCode: 400, body: "Report ID missing" };
      }

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
        body: JSON.stringify({ success: true }),
      };
    }

    // DELETE: Delete a report
    if (method === 'DELETE') {
      const { id } = event.queryStringParameters;
      
      if (!id) {
          return { statusCode: 400, body: "ID missing" };
      }

      await client.query('DELETE FROM reports WHERE id = $1 AND user_id = $2', [id, userId]);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error: any) {
    console.error('Database Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Database operation failed", details: error.message }),
    };
  } finally {
    await client.end();
  }
};
