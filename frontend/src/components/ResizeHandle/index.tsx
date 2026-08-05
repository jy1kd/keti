import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'
import type { ResizeDirection } from '@/utils/resizeDrag'

interface ResizeHandleProps extends HTMLAttributes<HTMLDivElement> {
  direction?: ResizeDirection
}

export const ResizeHandle = forwardRef<HTMLDivElement, ResizeHandleProps>(
  ({ direction = 'se', className = '', ...props }, ref) => {
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
