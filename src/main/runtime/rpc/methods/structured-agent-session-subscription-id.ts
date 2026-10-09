// Subscription ids for the streaming `agentSession.*` methods.
//
// Shared control multiplexes several streams over one socket, so the frame id keeps one
// subscriber from evicting another. It is appended only when present: collapsing a missing
// frame id to a constant is the collision the rule exists to prevent.

import type { RpcContext } from '../core'

const SUBSCRIPTION_PREFIX = 'agentSession'

function withFrameId(base: string, frameId: string | undefined): string {
  return frameId ? `${base}:${frameId}` : base
}

/** The id a session's streams share before the frame id. `unsubscribe` addresses this
 *  directly and sweeps `${base}:` to reach every frame under it. */
export function structuredAgentSessionSubscriptionBase(ctx: RpcContext, sessionId: string): string {
  return `${SUBSCRIPTION_PREFIX}:${ctx.connectionId ?? 'local'}:${sessionId}`
}

/** One session's transcript stream. */
export function structuredAgentSessionSubscriptionId(ctx: RpcContext, sessionId: string): string {
  return withFrameId(structuredAgentSessionSubscriptionBase(ctx, sessionId), ctx.requestId)
}

/** The status feed, which is per connection rather than per session. `frameId` addresses a
 *  shared-control stream from its unsubscribe, which arrives under a different frame id. */
export function structuredAgentSessionStatusSubscriptionId(
  ctx: RpcContext,
  frameId: string | undefined = ctx.requestId
): string {
  return withFrameId(`${SUBSCRIPTION_PREFIX}.status:${ctx.connectionId ?? 'local'}`, frameId)
}

/** The turn-completion feed, which like the status feed is per connection, not per session. */
export function structuredAgentSessionTurnCompletionSubscriptionId(
  ctx: RpcContext,
  frameId: string | undefined = ctx.requestId
): string {
  return withFrameId(
    `${SUBSCRIPTION_PREFIX}.turn-completion:${ctx.connectionId ?? 'local'}`,
    frameId
  )
}
