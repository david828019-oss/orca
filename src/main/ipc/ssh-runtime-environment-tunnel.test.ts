import { beforeEach, describe, expect, it, vi } from 'vitest'

const { context, connectTarget, broadcastPortForwards } = vi.hoisted(() => ({
  context: {
    connectionManager: { getConnection: vi.fn() },
    portForwardManager: { listForwards: vi.fn(), addForward: vi.fn() }
  },
  connectTarget: vi.fn(),
  broadcastPortForwards: vi.fn()
}))

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/orca-test' } }))
vi.mock('./ssh-ipc-context', () => ({
  get connectionManager() {
    return context.connectionManager
  },
  get portForwardManager() {
    return context.portForwardManager
  },
  getCurrentMainWindow: () => null
}))
vi.mock('./ssh-connect-flow', () => ({ connectTarget }))
vi.mock('./ssh-renderer-broadcast', () => ({ broadcastPortForwards }))
vi.mock('./runtime-environment-request-connections', () => ({
  retryRemoteRuntimeSharedControlConnectionNow: vi.fn()
}))

import { openSshRuntimeEnvironmentTunnel } from './ssh-runtime-environment-tunnel'

const request = { targetId: 'target-1', endpoint: 'ws://127.0.0.1:6768', label: 'Orca server: box' }

beforeEach(() => {
  vi.clearAllMocks()
  context.portForwardManager.listForwards.mockReturnValue([])
  context.portForwardManager.addForward.mockResolvedValue({})
})

describe('openSshRuntimeEnvironmentTunnel', () => {
  it('connects the SSH host first, then forwards the endpoint port to its loopback', async () => {
    const connection = {}
    context.connectionManager.getConnection
      .mockReturnValueOnce(undefined)
      .mockReturnValue(connection)

    await openSshRuntimeEnvironmentTunnel(request)

    expect(connectTarget).toHaveBeenCalledWith('target-1')
    expect(context.portForwardManager.addForward).toHaveBeenCalledWith(
      'target-1',
      connection,
      6768,
      '127.0.0.1',
      6768,
      'Orca server: box'
    )
    expect(broadcastPortForwards).toHaveBeenCalledWith(expect.any(Function), 'target-1')
  })

  it('reuses a live forward and shares one attempt between concurrent probes', async () => {
    context.connectionManager.getConnection.mockReturnValue({})
    context.portForwardManager.listForwards.mockReturnValue([
      { localPort: 6768, remoteHost: '127.0.0.1', remotePort: 6768 }
    ])

    await Promise.all([
      openSshRuntimeEnvironmentTunnel(request),
      openSshRuntimeEnvironmentTunnel(request)
    ])

    expect(connectTarget).not.toHaveBeenCalled()
    expect(context.portForwardManager.addForward).not.toHaveBeenCalled()
    expect(context.portForwardManager.listForwards).toHaveBeenCalledTimes(1)
  })
})
