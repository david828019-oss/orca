import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ensureRuntimeEnvironmentSshTunnel,
  setRuntimeEnvironmentSshTunnelOpener
} from './runtime-environment-ssh-tunnel-hook'

afterEach(() => setRuntimeEnvironmentSshTunnelOpener(null))

describe('ensureRuntimeEnvironmentSshTunnel', () => {
  it('does nothing for an environment whose tunnel the user runs', async () => {
    const opener = vi.fn()
    setRuntimeEnvironmentSshTunnelOpener(opener)
    await ensureRuntimeEnvironmentSshTunnel({ name: 'box' }, 'ws://127.0.0.1:6768')
    expect(opener).not.toHaveBeenCalled()
  })

  it('asks the SSH layer for the forward an Orca-managed tunnel needs', async () => {
    const opener = vi.fn().mockResolvedValue(undefined)
    setRuntimeEnvironmentSshTunnelOpener(opener)
    await ensureRuntimeEnvironmentSshTunnel(
      { name: 'box', sshTunnelTargetId: 'target-1' },
      'ws://127.0.0.1:6768'
    )
    expect(opener).toHaveBeenCalledWith({
      targetId: 'target-1',
      endpoint: 'ws://127.0.0.1:6768',
      label: 'Orca server: box'
    })
  })

  it('fails the probe instead of connecting blind before SSH is ready', async () => {
    await expect(
      ensureRuntimeEnvironmentSshTunnel(
        { name: 'box', sshTunnelTargetId: 'target-1' },
        'ws://127.0.0.1:6768'
      )
    ).rejects.toThrow('SSH is still starting')
  })
})
