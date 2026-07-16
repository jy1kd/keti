import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

interface ResizeHandleProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'horizontal' | 'vertical'
}

export const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ direction = 'horizontal', className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`resize-handle resize-handle--${direction} ${className}`}
        {...props}
      >
        <div className="resize-handle__indicator" />
      </div>
    )
  }
)

ResizeHandle.displayName = 'ResizeHandle'
