import { randomUUID } from 'node:crypto'
import { AGENT_SESSION_SHARED_CONTROL_STREAMS_RUNTIME_CAPABILITY } from '../../shared/protocol-version'

const AGENT_STREAM_METHODS: ReadonlySet<string> = new Set([
  'agentSession.subscribe',
  'agentSession.subscribeStatus',
  'agentSession.subscribeTurnCompletions',
  'nativeChat.subscribe'
])

export function isAgentStreamMethod(method: string): boolean {
  return AGENT_STREAM_METHODS.has(method)
}

/** Agent streams join shared control only on a host that can retire each one there. */
export function canRouteOverSharedControl(
  method: string,
  hostCapabilities: readonly string[]
): boolean {
  return (
    !isAgentStreamMethod(method) ||
    hostCapabilities.includes(AGENT_SESSION_SHARED_CONTROL_STREAMS_RUNTIME_CAPABILITY)
  )
}

/** The host keys a native-chat watcher by `subscriptionId`, falling back to agent:sessionId.
 *  Two windows on one shared socket would collide on that fallback, so give each its own. */
export function withSharedControlStreamParams(method: string, params: unknown): unknown {
  if (
    method !== 'nativeChat.subscribe' ||
    typeof params !== 'object' ||
    params === null ||
    'subscriptionId' in params
  ) {
    return params
  }
  return { ...params, subscriptionId: `shared-control:${randomUUID()}` }
}
