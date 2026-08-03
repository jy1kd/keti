import { useEffect, useRef } from 'react'
import './styles.css'

interface MenuItem {
  label: string
  icon?: string
  onClick: () => void
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // 调整菜单位置，确保不超出屏幕
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width - 5
    const maxY = window.innerHeight - rect.height - 5

    if (x > maxX) {
      menuRef.current.style.left = `${maxX}px`
    }
    if (y > maxY) {
      menuRef.current.style.top = `${maxY}px`
    }
  }, [x, y])

  // 按 Escape 关闭菜单
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, index) => (
        <button
          key={index}
          className={`context-menu__item${item.disabled ? ' context-menu__item--disabled' : ''}`}
          onClick={() => {
            if (!item.disabled) {
              item.onClick()
              onClose()
            }
          }}
          disabled={item.disabled}
        >
          {item.icon && <span className="context-menu__icon">{item.icon}</span>}
          <span className="context-menu__label">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
