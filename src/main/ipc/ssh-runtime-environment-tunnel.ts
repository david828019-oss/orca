import { app } from 'electron'
import { listEnvironments } from '../../shared/runtime-environment-store'
import { getPreferredPairingOffer } from '../../shared/runtime-environments'
import { connectTarget } from './ssh-connect-flow'
import { connectionManager, getCurrentMainWindow, portForwardManager } from './ssh-ipc-context'
import { broadcastPortForwards } from './ssh-renderer-broadcast'
import { retryRemoteRuntimeSharedControlConnectionNow } from './runtime-environment-request-connections'
import {
  ensureRuntimeEnvironmentSshTunnel,
  setRuntimeEnvironmentSshTunnelOpener,
  type RuntimeEnvironmentSshTunnelRequest
} from './runtime-environment-ssh-tunnel-hook'

const opening = new Map<string, Promise<void>>()

export function registerSshRuntimeEnvironmentTunnels(): void {
  setRuntimeEnvironmentSshTunnelOpener(openSshRuntimeEnvironmentTunnel)
}

export function openSshRuntimeEnvironmentTunnel(
  request: RuntimeEnvironmentSshTunnelRequest
): Promise<void> {
  const port = loopbackEndpointPort(request.endpoint)
  const key = `${request.targetId}\0${port}`
  const inFlight = opening.get(key)
  if (inFlight) {
    return inFlight
  }
  const attempt = openForward(request, port).finally(() => {
    if (opening.get(key) === attempt) {
      opening.delete(key)
    }
  })
  opening.set(key, attempt)
  return attempt
}

/** After an SSH target reconnects, reopen the forwards behind it and retry their sockets now
 *  instead of waiting out the WebSocket backoff. */
export async function reopenSshRuntimeEnvironmentTunnels(targetId: string): Promise<void> {
  const environments = listEnvironments(app.getPath('userData')).filter(
    (environment) => environment.sshTunnelTargetId === targetId
  )
  await Promise.all(
    environments.map(async (environment) => {
      try {
        await ensureRuntimeEnvironmentSshTunnel(
          environment,
          getPreferredPairingOffer(environment).endpoint
        )
        retryRemoteRuntimeSharedControlConnectionNow(environment.id)
      } catch (error) {
        console.warn(
          `[ssh] Could not reopen the tunnel to Orca server "${environment.name}": ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    })
  )
}

async function openForward(request: RuntimeEnvironmentSshTunnelRequest, port: number) {
  if (!connectionManager || !portForwardManager) {
    throw new Error('SSH is still starting. Try again in a moment.')
  }
  if (!connectionManager.getConnection(request.targetId)) {
    await connectTarget(request.targetId)
  }
  const connection = connectionManager.getConnection(request.targetId)
  if (!connection) {
    throw new Error('Could not connect to the SSH host for this Orca server.')
  }
  const existing = portForwardManager
    .listForwards(request.targetId)
    .some((forward) => forward.localPort === port && forward.remotePort === port)
  if (existing) {
    return
  }
  // Why: the endpoint port is also the server's loopback port on the far side, so one number names both ends.
  await portForwardManager.addForward(
    request.targetId,
    connection,
    port,
    '127.0.0.1',
    port,
    request.label
  )
  broadcastPortForwards(getCurrentMainWindow, request.targetId)
}

function loopbackEndpointPort(endpoint: string): number {
  const url = new URL(endpoint)
  if (url.port) {
    return Number(url.port)
  }
  return url.protocol === 'wss:' ? 443 : 80
}
