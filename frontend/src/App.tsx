function App() {
  return (
    <div className="app">
      <header className="status-bar">
        <span>MD:○</span>
        <span>TD:○</span>
        <span>SimNow 交易终端</span>
      </header>
      <main className="main-content">
        <section className="market-panel">
          <h2>行情面板</h2>
        </section>
        <section className="order-panel">
          <h2>报单面板</h2>
        </section>
      </main>
      <footer className="query-panel">
        <h2>查询面板</h2>
      </footer>
    </div>
  )
}

export default App
