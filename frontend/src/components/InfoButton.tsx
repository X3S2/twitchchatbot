import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

interface InfoButtonProps {
  text: string
}

export function InfoButton({ text }: InfoButtonProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Info"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {visible && (
        <div className="absolute left-6 top-0 z-50 w-56 bg-gray-800 text-white text-xs rounded-lg p-2.5 shadow-xl">
          {text}
        </div>
      )}
    </span>
  )
}
