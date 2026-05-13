type Status = 'online' | 'offline' | 'connecting' | 'error'

const COLORS: Record<Status, string> = {
  online: 'bg-green-500',
  connecting: 'bg-yellow-400 animate-pulse',
  error: 'bg-red-500 animate-pulse',
  offline: 'bg-gray-400',
}

const LABELS: Record<Status, string> = {
  online: 'Online',
  connecting: 'Verbinden…',
  error: 'Fehler',
  offline: 'Offline',
}

interface LEDProps {
  status: Status | string
  showLabel?: boolean
}

export function LED({ status, showLabel = false }: LEDProps) {
  const s = (status as Status) in COLORS ? (status as Status) : 'offline'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLORS[s]}`} />
      {showLabel && <span className="text-xs text-gray-600 dark:text-gray-400">{LABELS[s]}</span>}
    </span>
  )
}
