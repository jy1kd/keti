import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomBar } from './index'
import { useConnectionStore } from '@/stores/connection'

describe('BottomBar', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      md: { phase: 'disconnected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      mdConnected: false,
      td: { phase: 'disconnected', lastConnectedAt: null, lastDisconnectedAt: null, reconnectCount: 0, error: null },
      tdConnected: false,
    })
  })

  it('渲染 MD/TD 连接指示灯（右下角）', () => {
    render(<BottomBar />)
    expect(screen.getByText('MD')).toBeInTheDocument()
    expect(screen.getByText('TD')).toBeInTheDocument()
    expect(screen.getByTestId('md-indicator')).toBeInTheDocument()
    expect(screen.getByTestId('td-indicator')).toBeInTheDocument()
  })
})
