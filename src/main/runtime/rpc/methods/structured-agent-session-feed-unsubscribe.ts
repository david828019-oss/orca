// Unsubscribes for the per-connection `agentSession.subscribeStatus` and
// `agentSession.subscribeTurnCompletions` feeds. A dedicated socket retires them on close; a
// shared-control socket outlives them, so the client names the opening frame id instead.

import { FeedUnsubscribeParams } from '../../../../shared/rpc-contract/structured-agent-session-params'
import { defineMethod } from '../core'
import { requireStructuredCleanupHost } from './structured-agent-session-gate'
import {
  structuredAgentSessionStatusSubscriptionId,
  structuredAgentSessionTurnCompletionSubscriptionId
} from './structured-agent-session-subscription-id'

export const STRUCTURED_AGENT_SESSION_FEED_UNSUBSCRIBE_METHODS = [
  defineMethod({
    name: 'agentSession.unsubscribeStatus',
    params: FeedUnsubscribeParams,
    handler: async (params, ctx) => {
      requireStructuredCleanupHost(ctx)
      ctx.runtime.cleanupSubscription(
        structuredAgentSessionStatusSubscriptionId(ctx, params.subscriptionId)
      )
      return { unsubscribed: true }
    }
  }),
  defineMethod({
    name: 'agentSession.unsubscribeTurnCompletions',
    params: FeedUnsubscribeParams,
    handler: async (params, ctx) => {
      requireStructuredCleanupHost(ctx)
      ctx.runtime.cleanupSubscription(
        structuredAgentSessionTurnCompletionSubscriptionId(ctx, params.subscriptionId)
      )
      return { unsubscribed: true }
    }
  })
]
