// api/bookings/checkout.ts — Vercel serverless function (Vite-SPA track).
// Takes a pending_payment booking, reads its PRICE SNAPSHOT server-side, and builds a
// DYNAMIC Stripe Checkout Session. Redirects the browser to checkout.stripe.com.
import Stripe from 'stripe'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../_supabaseAdmin.js' // NOTE the .js ESM extension (runtime-only)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  const { booking_id } = req.body ?? {}
  if (!booking_id) return res.status(400).json({ error: 'missing booking_id' })

  // Load the pending_payment booking + its price SNAPSHOT (set at creation in M1.2).
  // bookings has NO barber_id AND NO start_slot_id — the barber is reached via the SERVICE:
  // bookings.service_id → services.barber_id → barbers.
  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_id, status, price, services(name, barber_id, barbers(id, name))')
    .eq('id', booking_id)
    .single()

  if (!booking || booking.status !== 'pending_payment') {
    return res.status(400).json({ error: 'booking not payable' })
  }

  const service = booking.services as unknown as {
    name: string
    barber_id: string
    barbers: { id: string; name: string }
  }
  const barberId = service.barber_id
  const barberName = service.barbers.name

  // Currency from platform_settings (created in M1.1) — do NOT hard-code TWD.
  const { data: cfg } = await supabaseAdmin.from('platform_settings').select('currency').single()
  const currency = (cfg?.currency ?? 'twd').toLowerCase()

  // unit_amount = price scaled into STRIPE's smallest unit for the currency.
  // TWD is 2-decimal in Stripe → ×100 (NT$300 → 30000). Only TRUE zero-decimal currencies use ×1.
  // Do NOT use currency_minor_units here — that's a DISPLAY concept, not Stripe's exponent.
  const ZERO_DECIMAL = new Set(['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','vnd','vuv','xaf','xof','xpf'])
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100
  const unitAmount = booking.price * factor

  const origin = req.headers.origin as string
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency,
        product_data: { name: `${service.name} @ ${barberName}` },
        unit_amount: unitAmount, // NT$300 → 30000 (NT$300.00); NOT 300 (that's NT$3.00 → rejected)
      },
      quantity: 1,
    }],
    metadata: { booking_id: booking.id, customer_id: booking.customer_id },
    client_reference_id: booking.id,
    success_url: `${origin}/bookings/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking.id}`,
    cancel_url: `${origin}/barbers/${barberId}`,
  })

  return res.status(200).json({ url: session.url })
}
