import { useEffect, useRef, useCallback, useState } from 'react'

type WsRoom = 'admin' | `tenant:${string}`

interface WsMessage {
  type: string
  [key: string]: unknown
}

interface UseWebSocketOptions {
  room: WsRoom
  onMessage?: (msg: WsMessage) => void
  enabled?: boolean
}

export function useWebSocket({ room, onMessage, enabled = true }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connected, setConnected] = useState(false)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (!enabled) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = room === 'admin'
      ? `${proto}//${window.location.host}/api/ws/admin`
      : `${proto}//${window.location.host}/api/ws/tenant/${room.replace('tenant:', '')}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsMessage
        onMessageRef.current?.(data)
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      if (enabled) {
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [room, enabled])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  return { connected }
}
