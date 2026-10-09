import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

const SELF_MANAGED = 'self-managed'

/** Picks the saved SSH host Orca opens a loopback server's tunnel through, or none. */
export function RuntimeServerSshTunnelTargetSelect({
  value,
  disabled,
  onChange
}: {
  value: string | null
  disabled: boolean
  onChange: (targetId: string | null) => void
}): React.JSX.Element | null {
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  if (sshTargetLabels.size === 0) {
    return null
  }
  return (
    <div className="mt-2 space-y-1">
      <span className="block text-xs font-medium text-foreground">
        {translate(
          'auto.components.settings.RuntimeServerSshTunnelTargetSelect.label',
          'Open the tunnel through'
        )}
      </span>
      <Select
        value={value ?? SELF_MANAGED}
        disabled={disabled}
        onValueChange={(next) => onChange(next === SELF_MANAGED ? null : next)}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELF_MANAGED}>
            {translate(
              'auto.components.settings.RuntimeServerSshTunnelTargetSelect.selfManaged',
              'I run the tunnel myself'
            )}
          </SelectItem>
          {[...sshTargetLabels].map(([targetId, label]) => (
            <SelectItem key={targetId} value={targetId}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="block text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.RuntimeServerSshTunnelTargetSelect.help',
          'Orca forwards this port over that SSH host and reopens it when the connection comes back.'
        )}
      </span>
    </div>
  )
}
