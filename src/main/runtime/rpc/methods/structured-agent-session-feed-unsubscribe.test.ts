// A shared-control socket outlives its feeds, so a client retires one feed by its opening frame
// and leaves the sibling on the same connection running.

import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY } from '../../../../shared/protocol-version'
import { setStructuredAgentSessionHost } from '../../../native-chat/agent-session-wire/structured-agent-session-registry'
import {
  createRestTestRig,
  type RestTestRig
} from '../../../native-chat/agent-session-wire/structured-agent-session-rest-test-rig'
import { OrcaRuntimeService } from '../../orca-runtime'
import type { RpcResponse } from '../core'
import { RpcDispatcher } from '../dispatcher'
import { STRUCTURED_AGENT_SESSION_METHODS } from './structured-agent-session'

const CLIENT = {
  clientId: 'device-1',
  clientKind: 'runtime' as const,
  clientCapabilities: [STRUCTURED_AGENT_SESSION_RUNTIME_CAPABILITY],
  connectionId: 'connection-1'
}

let rig: RestTestRig
let runtime: OrcaRuntimeService
let dispatcher: RpcDispatcher

async function dispatch(id: string, method: string, params: unknown): Promise<RpcResponse[]> {
  const frames: RpcResponse[] = []
  await dispatcher.dispatchStreaming(
    { id, authToken: 'token', method, params },
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the dispatcher writes RpcResponse JSON.
    (raw) => frames.push(JSON.parse(raw) as RpcResponse),
    CLIENT
  )
  return frames
}

beforeEach(async () => {
  rig = await createRestTestRig({ idleSweep: { intervalMs: 3_600_000 } })
  setStructuredAgentSessionHost(rig.host)
  runtime = new OrcaRuntimeService()
  vi.spyOn(runtime, 'getClientSettings').mockImplementation(
    () =>
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the RPC gate reads only this one setting.
      ({ experimentalStructuredNativeChat: true }) as ReturnType<
        OrcaRuntimeService['getClientSettings']
      >
  )
  dispatcher = new RpcDispatcher({ runtime, methods: STRUCTURED_AGENT_SESSION_METHODS })
})

afterEach(async () => {
  setStructuredAgentSessionHost(null)
  await rig.dispose()
})

it.each([
  ['agentSession.subscribeStatus', 'agentSession.unsubscribeStatus'],
  ['agentSession.subscribeTurnCompletions', 'agentSession.unsubscribeTurnCompletions']
])('%s is retired by its opening frame only', async (subscribe, unsubscribe) => {
  const register = vi.spyOn(runtime, 'registerOwnedSubscriptionCleanup')
  await dispatch('frame-a', subscribe, undefined)
  await dispatch('frame-b', subscribe, undefined)
  const [retired, kept] = register.mock.calls.map(([subscriptionId]) => subscriptionId)
  expect(retired).toMatch(/:frame-a$/)
  const cleanup = vi.spyOn(runtime, 'cleanupSubscription')

  const replies = await dispatch('frame-c', unsubscribe, { subscriptionId: 'frame-a' })

  expect(replies).toEqual([expect.objectContaining({ ok: true, result: { unsubscribed: true } })])
  expect(cleanup).toHaveBeenCalledWith(retired)
  expect(cleanup).not.toHaveBeenCalledWith(kept)
})
