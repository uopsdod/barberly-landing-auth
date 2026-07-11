// api/stripe/webhook.ts — Vercel serverless function (Vite-SPA track).
// The ONLY route that changes booking state. Verifies the raw-body signature, is idempotent via
// the pending_payment status guard, and on checkout.session.completed + paid flips the BOOKING
// pending_payment → paid and stamps paid_at. NO split, NO transactions row (there is no such table).
import Stripe from 'stripe'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_supabaseAdmin.js' // NOTE the .js ESM extension (runtime-only)

// REQUIRED: turn OFF the body parser so we can read the RAW bytes for signature verification.
export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Buffer the raw request stream (App Router's `await req.text()` does NOT exist here).
async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const buf = await rawBody(req) // RAW bytes — never req.body / JSON first
  const sig = req.headers['stripe-signature'] as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return res.status(400).json({ error: 'signature verification failed' })
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true }) // ack unrelated events
  }

  const session = event.data.object as Stripe.Checkout.Session
  if (session.payment_status !== 'paid') {
    return res.status(200).json({ received: true }) // only act on a real, paid session
  }

  const bookingId = session.metadata?.booking_id // your server set this — can't be forged
  if (!bookingId) {
    return res.status(400).json({ error: 'missing booking_id metadata' })
  }

  // FIRST TO PAY WINS: flip pending_payment → paid exactly once and stamp paid_at. That's the
  // WHOLE job — no split, no ledger row. The .eq('status','pending_payment') guard is the
  // idempotency source of truth: a re-delivered event matches ZERO rows and no-ops.
  await supabaseAdmin
    .from('bookings')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq('id', bookingId)
    .eq('status', 'pending_payment')

  return res.status(200).json({ received: true })
}
