import { describe, expect, it, vi } from 'vitest'
import type { RuntimeRpcResponse } from './runtime-rpc-envelope'
import { getCleanupRequest } from './remote-runtime-shared-control-protocol'
import {
  closeSharedControlLogicalSubscription,
  createSharedControlSubscription,
  handleSharedControlLogicalResponse,
  replaySharedControlSubscriptions
} from './remote-runtime-shared-control-subscriptions'
import type { SharedControlLogicalSubscription } from './remote-runtime-shared-control-types'

function track(method: string, params: unknown) {
  const subscriptions = new Map<string, SharedControlLogicalSubscription<unknown>>()
  const callbacks = { onResponse: vi.fn(), onError: vi.fn(), onClose: vi.fn() }
  const subscription = createSharedControlSubscription({
    requestId: 'frame-1',
    method,
    params,
    retainedParamsBytes: 0,
    callbacks
  })
  subscriptions.set(subscription.requestId, subscription)
  return { subscriptions, subscription, callbacks }
}

const snapshot: RuntimeRpcResponse<unknown> = {
  id: 'frame-1',
  ok: true,
  result: { type: 'snapshot' },
  _meta: { runtimeId: 'runtime-1' }
}

describe('shared-control agent stream cleanup', () => {
  it('retires each agent stream by the frame that opened it', () => {
    expect(
      getCleanupRequest(track('agentSession.subscribe', { sessionId: 's-1' }).subscription)
    ).toEqual({
      method: 'agentSession.unsubscribe',
      params: { sessionId: 's-1', subscriptionId: 'frame-1' }
    })
    expect(getCleanupRequest(track('agentSession.subscribeStatus', null).subscription)).toEqual({
      method: 'agentSession.unsubscribeStatus',
      params: { subscriptionId: 'frame-1' }
    })
    expect(
      getCleanupRequest(track('agentSession.subscribeTurnCompletions', null).subscription)
    ).toEqual({
      method: 'agentSession.unsubscribeTurnCompletions',
      params: { subscriptionId: 'frame-1' }
    })
    expect(
      getCleanupRequest(
        track('nativeChat.subscribe', { agent: 'codex', sessionId: 's-1', subscriptionId: 'w-1' })
          .subscription
      )
    ).toEqual({ method: 'nativeChat.unsubscribe', params: { subscriptionId: 'w-1' } })
  })

  it('holds a transcript cleanup until the host has registered the stream', () => {
    const { subscriptions, subscription } = track('agentSession.subscribe', { sessionId: 's-1' })
    subscription.sent = true
    const request = vi.fn()

    closeSharedControlLogicalSubscription({ subscriptions, subscription, request })
    expect(request).not.toHaveBeenCalled()
    expect(subscription.closeAfterReady).toBe(true)

    handleSharedControlLogicalResponse({ subscriptions, subscription, response: snapshot, request })
    expect(request).toHaveBeenCalledWith('agentSession.unsubscribe', {
      sessionId: 's-1',
      subscriptionId: 'frame-1'
    })
    expect(subscriptions.size).toBe(0)
  })

  it('cleans up an acknowledged transcript stream at once', () => {
    const { subscriptions, subscription } = track('agentSession.subscribe', { sessionId: 's-1' })
    subscription.sent = true
    handleSharedControlLogicalResponse({
      subscriptions,
      subscription,
      response: snapshot,
      request: vi.fn()
    })
    const request = vi.fn()

    closeSharedControlLogicalSubscription({ subscriptions, subscription, request })
    expect(request).toHaveBeenCalledWith('agentSession.unsubscribe', {
      sessionId: 's-1',
      subscriptionId: 'frame-1'
    })
  })

  it('closes a transcript stream on reconnect so it reopens from its own cursor', () => {
    const { subscriptions, subscription, callbacks } = track('agentSession.subscribe', {
      sessionId: 's-1',
      cursor: 'stale'
    })
    subscription.sent = true
    const send = vi.fn()

    replaySharedControlSubscriptions({ subscriptions, send, tagReplayedResponses: true })
    expect(send).not.toHaveBeenCalled()
    expect(callbacks.onClose).toHaveBeenCalledTimes(1)
    expect(subscriptions.size).toBe(0)
  })

  it('replays the status feed in place', () => {
    const { subscriptions, subscription, callbacks } = track('agentSession.subscribeStatus', null)
    subscription.sent = true
    const send = vi.fn()

    replaySharedControlSubscriptions({ subscriptions, send })
    expect(send).toHaveBeenCalledWith(subscription)
    expect(callbacks.onClose).not.toHaveBeenCalled()
  })
})
