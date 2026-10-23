import type { Config } from '@netlify/functions';
import { randomBytes } from 'node:crypto';
import { getDb } from './lib/db';
import { notifyFeedbackRequest } from './lib/notify';

interface OrderLine {
  itemId?: string;
  kind?: string;
}

interface DueOrderRow {
  id: number;
  customer_email: string;
  customer_name: string;
  items: unknown;
}

function generateToken() {
  return randomBytes(24).toString('hex');
}

// Runs daily. Finds beans orders that turned 30 days old since the last
// run and haven't had a feedback email yet (feedback_sent_at IS NULL),
// mints a single-use rating token per distinct beans coffee in each order,
// and sends the "how was it" email (see notify.ts's notifyFeedbackRequest).
// No admin path, no auth gate - this is never linked from anywhere in the
// app, only invoked by Netlify's own scheduler, and every write it makes
// (feedback_sent_at, order_feedback_tokens) is safe to repeat if it ever
// were triggered twice.
export default async () => {
  const db = getDb();

  const dueOrders = (await db.sql`
    SELECT id, customer_email, customer_name, items
    FROM orders
    WHERE feedback_sent_at IS NULL
      AND customer_email != ''
      AND created_at <= now() - interval '30 days'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(items) AS item
        WHERE item->>'kind' = 'beans'
      )
    ORDER BY created_at ASC
    LIMIT 50
  `) as DueOrderRow[];

  let emailsSent = 0;

  for (const order of dueOrders) {
    const items = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as OrderLine[];
    const beansCoffeeIds = Array.from(new Set(
      items.filter(l => l.kind === 'beans' && l.itemId).map(l => l.itemId as string),
    ));

    // A coffee can have been hard-deleted since this order shipped (unlike
    // archiving, which keeps the row) - only ask about ones that still exist,
    // since coffee_reviews.coffee_id has a FK to coffees.
    const { rows: existingCoffees } = beansCoffeeIds.length > 0
      ? await db.pool.query<{ id: string; name: string }>('SELECT id, name FROM coffees WHERE id = ANY($1)', [beansCoffeeIds])
      : { rows: [] as { id: string; name: string }[] };

    if (existingCoffees.length > 0) {
      const coffeesWithTokens = [];
      for (const coffee of existingCoffees) {
        const token = generateToken();
        await db.sql`INSERT INTO order_feedback_tokens (token, order_id, coffee_id) VALUES (${token}, ${order.id}, ${coffee.id})`;
        coffeesWithTokens.push({ name: coffee.name, token });
      }
      const sent = await notifyFeedbackRequest(order.customer_name, order.customer_email, order.id, coffeesWithTokens);
      if (sent) emailsSent += 1;
    }

    // Marked as attempted either way - matches this codebase's existing
    // best-effort notification style (never retried, never blocks anything)
    // rather than risk emailing the same customer about the same order
    // forever if Resend has a bad day.
    await db.sql`UPDATE orders SET feedback_sent_at = now() WHERE id = ${order.id}`;
  }

  return new Response(JSON.stringify({ processed: dueOrders.length, emailsSent }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config: Config = {
  schedule: '0 2 * * *',
};
