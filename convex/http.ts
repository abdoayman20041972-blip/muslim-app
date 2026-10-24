import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'

const http = httpRouter()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

http.route({
  path: '/push-subscription-change',
  method: 'OPTIONS',
  handler: httpAction(async () => new Response(null, { status: 204, headers: corsHeaders })),
})

http.route({
  path: '/push-subscription-change',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const body = (await request.json()) as {
        oldEndpoint?: unknown
        endpoint?: unknown
        p256dh?: unknown
        auth?: unknown
      }

      const valid =
        typeof body.oldEndpoint === 'string' &&
        typeof body.endpoint === 'string' &&
        typeof body.p256dh === 'string' &&
        typeof body.auth === 'string'

      if (!valid) {
        return new Response(JSON.stringify({ ok: false }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const repaired = await ctx.runMutation(internal.pushSubscriptions.repairSubscriptionByEndpoint, {
        oldEndpoint: body.oldEndpoint as string,
        endpoint: body.endpoint as string,
        p256dh: body.p256dh as string,
        auth: body.auth as string,
      })

      return new Response(JSON.stringify({ ok: repaired }), {
        status: repaired ? 200 : 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } catch {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }),
})

export default http
