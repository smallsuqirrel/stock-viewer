import { useState, useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import Papa from 'papaparse'
import Ranking from './Ranking.jsx'
import './App.css'

const CATEGORIES = [
  '全部', '宽基指数', '跨境/海外', '科技信息', '货币类', '制造工业',
  '金融地产', '新能源', '策略主题', '医药医疗', '消费', '红利策略',
  '债券类', '电力公用', '资源材料', '商品类', '农业', '其他'
]

const PERIODS = [
  { key: 'day', label: '日K' },
  { key: 'week', label: '周K' },
  { key: 'month', label: '月K' },
  { key: 'quarter', label: '季K' },
  { key: 'year', label: '年K' },
]

// Aggregate daily data into larger periods
function aggregateKline(data, period) {
  if (!data || data.length === 0) return data
  if (period === 'day') return data

  const getGroupKey = (dateStr) => {
    const d = new Date(dateStr)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    if (period === 'week') {
      // ISO week: get Monday of the week
      const day = d.getDay() || 7
      const mon = new Date(d)
      mon.setDate(d.getDate() - day + 1)
      return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`
    }
    if (period === 'month') return `${y}-${String(m).padStart(2,'0')}`
    if (period === 'quarter') return `${y}Q${Math.ceil(m/3)}`
    if (period === 'year') return `${y}`
    return dateStr
  }

  const groups = []
  let currentKey = null
  let currentGroup = []

  for (const row of data) {
    const key = getGroupKey(row.date)
    if (key !== currentKey) {
      if (currentGroup.length > 0) groups.push(currentGroup)
      currentGroup = [row]
      currentKey = key
    } else {
      currentGroup.push(row)
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  return groups.map(g => ({
    date: g[g.length - 1].date,
    open: g[0].open,
    close: g[g.length - 1].close,
    high: Math.max(...g.map(r => r.high)),
    low: Math.min(...g.map(r => r.low)),
    volume: g.reduce((s, r) => s + (r.volume || 0), 0),
  }))
}

function App() {
  const [page, setPage] = useState('kline') // 'kline' | 'ranking'
  const [assetType, setAssetType] = useState('etf') // 'etf' | 'stock'
  const [etfList, setEtfList] = useState([])
  const [stockList, setStockList] = useState([])
  const [filteredList, setFilteredList] = useState([])
  const [selectedEtf, setSelectedEtf] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [klineData, setKlineData] = useState(null)
  const [period, setPeriod] = useState('day')
  const [loading, setLoading] = useState(false)
  const chartRef = useRef(null)
  const chartInstance = useRef(null)

  // Load ETF list
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}etf_list.json`)
      .then(res => res.json())
      .then(data => {
        setEtfList(data)
        if (assetType === 'etf') {
          setFilteredList(data)
          if (data.length > 0) setSelectedEtf(data[0])
        }
      })
  }, [])

  // Load Stock list
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}stock_list.json`)
      .then(res => res.json())
      .then(data => setStockList(data))
  }, [])

  // Switch asset type
  useEffect(() => {
    setSearchText('')
    setSelectedCategory('全部')
    const list = assetType === 'etf' ? etfList : stockList
    setFilteredList(list)
    if (list.length > 0) setSelectedEtf(list[0])
  }, [assetType])

  useEffect(() => {
    const sourceList = assetType === 'etf' ? etfList : stockList
    let list = sourceList
    if (assetType === 'etf' && selectedCategory !== '全部') {
      list = list.filter(e => e.category === selectedCategory)
    }
    if (searchText.trim()) {
      const text = searchText.toLowerCase()
      list = list.filter(e => e.code.includes(text) || e.name.toLowerCase().includes(text))
    }
    setFilteredList(list)
  }, [searchText, selectedCategory, etfList, stockList, assetType])

  useEffect(() => {
    if (!selectedEtf) return
    setLoading(true)
    const filename = `${selectedEtf.market}${selectedEtf.code}`
    const folder = assetType === 'etf' ? 'etfs' : 'stocks'
    fetch(`${import.meta.env.BASE_URL}${folder}/${filename}.csv`)
      .then(res => res.text())
      .then(text => {
        const result = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true })
        setKlineData(result.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedEtf, assetType])

  // Reinitialize chart when switching back to kline page
  useEffect(() => {
    if (page === 'kline' && chartRef.current) {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current)
      }
      chartInstance.current.resize()
    }
  }, [page])

  useEffect(() => {
    if (!klineData || !chartRef.current || page !== 'kline') return

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current)
    }

    const displayData = aggregateKline(klineData, period)
    const dates = displayData.map(d => d.date)
    const ohlc = displayData.map(d => [d.open, d.close, d.low, d.high])
    const volumes = displayData.map(d => d.volume)
    const volumeColors = displayData.map(d => d.close >= d.open ? '#ef5350' : '#26a69a')

    const option = {
      animation: false,
      title: {
        text: selectedEtf ? `${selectedEtf.name} (${selectedEtf.code})` : '',
        left: 'center',
        textStyle: { color: '#e0e0e0', fontSize: 16 }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(30,30,45,0.9)',
        borderColor: '#555',
        textStyle: { color: '#e0e0e0' },
        formatter: function(params) {
          if (!params[0]) return ''
          const idx = params[0].dataIndex
          const row = displayData[idx]
          return `<div style="font-size:13px">
            <b>${row.date}</b><br/>
            开盘: ${row.open}<br/>
            收盘: ${row.close}<br/>
            最高: ${row.high}<br/>
            最低: ${row.low}<br/>
            成交量: ${(row.volume / 10000).toFixed(0)}万
          </div>`
        }
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [
        { left: '8%', right: '3%', top: '10%', height: '55%' },
        { left: '8%', right: '3%', top: '72%', height: '18%' }
      ],
      xAxis: [
        { type: 'category', data: dates, gridIndex: 0, axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#aaa' }, splitLine: { show: false } },
        { type: 'category', data: dates, gridIndex: 1, axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#aaa' }, splitLine: { show: false } }
      ],
      yAxis: [
        { scale: true, gridIndex: 0, axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#aaa' }, splitLine: { lineStyle: { color: '#333' } } },
        { scale: true, gridIndex: 1, axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#aaa', formatter: v => (v / 10000).toFixed(0) + '万' }, splitLine: { lineStyle: { color: '#333' } } }
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: 70, end: 100 },
        { type: 'slider', xAxisIndex: [0, 1], bottom: '2%', height: 20, borderColor: '#555', textStyle: { color: '#aaa' }, handleStyle: { color: '#7581bd' }, fillerColor: 'rgba(117,129,189,0.2)' }
      ],
      series: [
        {
          name: 'K线', type: 'candlestick', data: ohlc, xAxisIndex: 0, yAxisIndex: 0,
          itemStyle: { color: '#ef5350', color0: '#26a69a', borderColor: '#ef5350', borderColor0: '#26a69a' }
        },
        {
          name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1,
          data: volumes.map((v, i) => ({ value: v, itemStyle: { color: volumeColors[i] } }))
        }
      ]
    }

    chartInstance.current.setOption(option, true)
    const handleResize = () => chartInstance.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [klineData, selectedEtf, page, period])

  // Handle ETF selection from ranking page
  const handleRankingSelect = (etf) => {
    setSelectedEtf(etf)
    setSelectedCategory('全部')
    setPage('kline')
  }

  // Back to ranking
  const handleBack = () => {
    setPage('ranking')
  }

  return (
    <div className="app">
      {/* Top navigation */}
      <nav className="top-nav">
        <div className="nav-brand">行情可视化</div>
        <div className="nav-tabs">
          <button className={`nav-tab ${page === 'kline' && assetType === 'etf' ? 'active' : ''}`} onClick={() => { setAssetType('etf'); setPage('kline') }}>ETF</button>
          <button className={`nav-tab ${page === 'kline' && assetType === 'stock' ? 'active' : ''}`} onClick={() => { setAssetType('stock'); setPage('kline') }}>股票</button>
          <button className={`nav-tab ${page === 'ranking' ? 'active' : ''}`} onClick={() => setPage('ranking')}>板块排行</button>
        </div>
      </nav>

      <div className="kline-layout" style={{ display: page === 'kline' ? 'flex' : 'none' }}>
          <div className="sidebar">
            <div className="sidebar-header">
              {selectedEtf && <button className="back-btn" onClick={handleBack}>← 返回排行</button>}
              <span className="count">{filteredList.length} 只</span>
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="搜索代码或名称..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <div className="category-tabs">
              {assetType === 'etf' && CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >{cat}</button>
              ))}
            </div>
            <div className="etf-list">
              {filteredList.map(etf => (
                <div
                  key={`${etf.market}${etf.code}`}
                  className={`etf-item ${selectedEtf?.code === etf.code ? 'active' : ''}`}
                  onClick={() => setSelectedEtf(etf)}
                >
                  <span className="etf-code">{etf.code}</span>
                  <span className="etf-name">{etf.name}</span>
                  {etf.category && <span className="etf-cat">{etf.category}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="main">
            <div className="period-bar">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  className={`period-btn ${period === p.key ? 'active' : ''}`}
                  onClick={() => setPeriod(p.key)}
                >{p.label}</button>
              ))}
            </div>
            {loading && <div className="loading">加载中...</div>}
            <div ref={chartRef} className="chart-container" />
          </div>
        </div>

        <div className="ranking-layout" style={{ display: page === 'ranking' ? 'block' : 'none' }}>
          <Ranking onSelectEtf={handleRankingSelect} />
        </div>
    </div>
  )
}

export default App
