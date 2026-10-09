import { describe, expect, it } from 'vitest'
import { AGENT_SESSION_SHARED_CONTROL_STREAMS_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import {
  canRouteOverSharedControl,
  withSharedControlStreamParams
} from './runtime-environment-agent-stream-routing'

describe('agent stream shared-control routing', () => {
  it('keeps agent streams on a dedicated socket for hosts that cannot retire them', () => {
    expect(canRouteOverSharedControl('agentSession.subscribeStatus', [])).toBe(false)
    expect(canRouteOverSharedControl('nativeChat.subscribe', [])).toBe(false)
    expect(
      canRouteOverSharedControl('agentSession.subscribe', [
        AGENT_SESSION_SHARED_CONTROL_STREAMS_RUNTIME_CAPABILITY
      ])
    ).toBe(true)
    expect(canRouteOverSharedControl('files.watch', [])).toBe(true)
  })

  it('gives each native-chat stream its own watcher key', () => {
    const params = { agent: 'codex', sessionId: 's-1' }
    const first = withSharedControlStreamParams('nativeChat.subscribe', params)
    const second = withSharedControlStreamParams('nativeChat.subscribe', params)
    expect(first).toMatchObject({ ...params, subscriptionId: expect.any(String) })
    expect(first).not.toEqual(second)
    expect(
      withSharedControlStreamParams('nativeChat.subscribe', { ...params, subscriptionId: 'w-1' })
    ).toEqual({ ...params, subscriptionId: 'w-1' })
    expect(withSharedControlStreamParams('agentSession.subscribe', params)).toBe(params)
  })
})
