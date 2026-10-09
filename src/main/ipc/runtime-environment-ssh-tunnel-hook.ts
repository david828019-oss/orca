import type { KnownRuntimeEnvironment } from '../../shared/runtime-environments'

export type RuntimeEnvironmentSshTunnelRequest = {
  targetId: string
  endpoint: string
  label: string
}

type SshTunnelOpener = (request: RuntimeEnvironmentSshTunnelRequest) => Promise<void>

// Why: injected by the SSH layer so runtime-environment transport stays free of SSH imports.
let opener: SshTunnelOpener | null = null

export function setRuntimeEnvironmentSshTunnelOpener(next: SshTunnelOpener | null): void {
  opener = next
}

export function runtimeEnvironmentSshTunnelLabel(name: string): string {
  return `Orca server: ${name}`
}

/** Opens the Orca-managed forward a loopback environment depends on; a no-op otherwise. */
export async function ensureRuntimeEnvironmentSshTunnel(
  environment: Pick<KnownRuntimeEnvironment, 'name' | 'sshTunnelTargetId'>,
  endpoint: string
): Promise<void> {
  if (!environment.sshTunnelTargetId) {
    return
  }
  if (!opener) {
    throw new Error('SSH is still starting. Try again in a moment.')
  }
  await opener({
    targetId: environment.sshTunnelTargetId,
    endpoint,
    label: runtimeEnvironmentSshTunnelLabel(environment.name)
  })
}
