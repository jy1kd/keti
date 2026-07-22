import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** 自动重试次数，默认 2 */
  maxAutoRetries?: number
  /** 自动重试间隔（毫秒），默认 2000 */
  retryDelay?: number
}

interface State {
  hasError: boolean
  error: Error | null
  retryCount: number
  retrying: boolean
}

/**
 * Error Boundary — 防止子组件异常拖垮整个 React 树。
 *
 * 内置三级恢复策略：
 * 1. 父组件 re-render（children 引用变化）→ 自动重置
 * 2. 自动重试（最多 maxAutoRetries 次，间隔 retryDelay ms）
 * 3. 手动点击"重试"按钮
 *
 * 用于包裹 vtable、ECharts 等第三方渲染库，单个崩溃不影响其他区域。
 */
export class ErrorBoundary extends Component<Props, State> {
  private _timer: ReturnType<typeof setTimeout> | null = null
  private _lastChildren: ReactNode = this.props.children

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0, retrying: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
    this._scheduleAutoRetry()
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    // 父组件重新渲染（children 引用变化、数据更新）→ 自动重置
    if (
      this.state.hasError &&
      this.props.children !== this._lastChildren
    ) {
      this._lastChildren = this.props.children
      this._reset()
    }
    // children 没变但 error 状态变了 → 记录当前 children 引用
    if (!this.state.hasError && prevState.hasError) {
      this._lastChildren = this.props.children
    }
  }

  componentWillUnmount() {
    this._clearTimer()
  }

  private _scheduleAutoRetry() {
    const max = this.props.maxAutoRetries ?? 2
    if (this.state.retryCount >= max) return

    this._clearTimer()
    this._timer = setTimeout(() => {
      this.setState((s) => ({
        hasError: false,
        error: null,
        retryCount: s.retryCount + 1,
        retrying: false,
      }))
      this._lastChildren = this.props.children
    }, this.props.retryDelay ?? 2000)
    this.setState({ retrying: true })
  }

  private _reset() {
    this._clearTimer()
    this.setState({ hasError: false, error: null, retryCount: 0, retrying: false })
  }

  private _clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  }

  handleRetry = () => {
    this._reset()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      const max = this.props.maxAutoRetries ?? 2
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#8b949e',
            fontSize: 13,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div>
            <p style={{ margin: 0, marginBottom: 8 }}>
              {this.state.retrying ? '正在恢复…' : '组件渲染异常'}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: '#6e7681' }}>
              {this.state.error?.message ?? '未知错误'}
            </p>
            {this.state.retryCount >= max && (
              <button
                onClick={this.handleRetry}
                style={{
                  marginTop: 12,
                  padding: '4px 14px',
                  fontSize: 12,
                  color: '#c9d1d9',
                  background: '#21262d',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
