import { useState, useEffect, useRef } from 'react'
import './styles.css'

interface ToastItem {
  id: number
  message: string
  type: 'success' | 'error'
}

// NOTE: 使用模块级可变状态实现 imperative toast API。
// 假设当前为单例渲染（单一 ToastContainer），不适用于 React 18 Concurrent Features。
// 长期可考虑迁移到 React Context + Portal 标准模式。

let toastId = 0
const listeners: Array<() => void> = []
let toasts: ToastItem[] = []

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

export const toast = {
  success(message: string) {
    toasts = [...toasts, { id: ++toastId, message, type: 'success' }]
    notifyListeners()
  },
  error(message: string) {
    toasts = [...toasts, { id: ++toastId, message, type: 'error' }]
    notifyListeners()
  },
  _clearAll() {
    toasts = []
    toastId = 0
    notifyListeners()
  },
}

function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  notifyListeners()
}

export function ToastContainer() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    listeners.push(listener)
    return () => {
      const idx = listeners.indexOf(listener)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [])

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastEntry key={t.id} item={t} />
      ))}
    </div>
  )
}

function ToastEntry({ item }: { item: ToastItem }) {
  const onDoneRef = useRef(() => {
    removeToast(item.id)
  })

  // Keep ref fresh in case item.id changes (shouldn't, but safe)
  onDoneRef.current = () => {
    removeToast(item.id)
  }

  useEffect(() => {
    const timer = setTimeout(() => onDoneRef.current(), 3000)
    return () => clearTimeout(timer)
  }, []) // only run on mount — timer is independent

  return (
    <div className={`toast-item toast-${item.type}`} role="alert">
      {item.message}
    </div>
  )
}
