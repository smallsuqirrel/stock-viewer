import { useState, useEffect } from 'react'
import './Ranking.css'

const CAP_TIERS = ['全部', '大盘', '中盘', '小盘', '全市场']
const SORT_OPTIONS = [
  { key: 'gain5d', label: '5日涨幅', desc: true },
  { key: 'volRatio', label: '量比', desc: true },
  { key: 'avgVol5d', label: '5日均量', desc: true },
]

function Ranking({ onSelectEtf }) {
  const [data, setData] = useState([])
  const [grouped, setGrouped] = useState({})
  const [selectedCap, setSelectedCap] = useState('全部')
  const [sortBy, setSortBy] = useState('gain5d')
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedCats, setExpandedCats] = useState(new Set())

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}etf_ranking.json`)
      .then(res => res.json())
      .then(d => setData(d))
  }, [])

  useEffect(() => {
    let filtered = data
    if (selectedCap !== '全部') {
      filtered = filtered.filter(e => e.capTier === selectedCap)
    }

    // Sort
    filtered.sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy]
      return sortDesc ? vb - va : va - vb
    })

    // Group by category
    const groups = {}
    for (const e of filtered) {
      if (!groups[e.category]) groups[e.category] = []
      groups[e.category].push(e)
    }

    // Sort groups by average gain
    setGrouped(groups)
  }, [data, selectedCap, sortBy, sortDesc])

  // Sort categories by their average gain5d
  const sortedCategories = Object.entries(grouped)
    .map(([cat, items]) => ({
      cat,
      items,
      avgGain: items.reduce((s, e) => s + e.gain5d, 0) / items.length,
      avgVol: items.reduce((s, e) => s + e.volRatio, 0) / items.length,
    }))
    .sort((a, b) => b.avgGain - a.avgGain)

  const toggleCat = (cat) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const latestDate = data.length > 0 ? data[0].latestDate : ''

  return (
    <div className="ranking">
      <div className="ranking-header">
        <h2>板块排行</h2>
        <span className="ranking-date">数据截至: {latestDate}</span>
      </div>

      <div className="ranking-controls">
        <div className="control-group">
          <label>市值分层:</label>
          {CAP_TIERS.map(cap => (
            <button
              key={cap}
              className={`ctrl-btn ${selectedCap === cap ? 'active' : ''}`}
              onClick={() => setSelectedCap(cap)}
            >{cap}</button>
          ))}
        </div>
        <div className="control-group">
          <label>排序:</label>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className={`ctrl-btn ${sortBy === opt.key ? 'active' : ''}`}
              onClick={() => {
                if (sortBy === opt.key) setSortDesc(!sortDesc)
                else { setSortBy(opt.key); setSortDesc(opt.desc) }
              }}
            >
              {opt.label} {sortBy === opt.key ? (sortDesc ? '↓' : '↑') : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="ranking-body">
        {sortedCategories.map(({ cat, items, avgGain, avgVol }) => (
          <div key={cat} className="cat-section">
            <div className="cat-header" onClick={() => toggleCat(cat)}>
              <span className="cat-expand">{expandedCats.has(cat) ? '▼' : '▶'}</span>
              <span className="cat-name">{cat}</span>
              <span className="cat-count">{items.length}只</span>
              <span className={`cat-gain ${avgGain >= 0 ? 'up' : 'down'}`}>
                均涨幅: {avgGain >= 0 ? '+' : ''}{avgGain.toFixed(2)}%
              </span>
              <span className="cat-vol">均量比: {avgVol.toFixed(2)}</span>
            </div>
            {expandedCats.has(cat) && (
              <table className="etf-table">
                <thead>
                  <tr>
                    <th>代码</th>
                    <th>名称</th>
                    <th>市值</th>
                    <th>收盘价</th>
                    <th>5日涨幅</th>
                    <th>量比</th>
                    <th>5日均量(万)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(e => (
                    <tr key={e.code} onClick={() => onSelectEtf && onSelectEtf(e)} className="etf-row">
                      <td className="col-code">{e.code}</td>
                      <td className="col-name">{e.name}</td>
                      <td className="col-cap">{e.capTier}</td>
                      <td>{e.close}</td>
                      <td className={e.gain5d >= 0 ? 'up' : 'down'}>
                        {e.gain5d >= 0 ? '+' : ''}{e.gain5d.toFixed(2)}%
                      </td>
                      <td className={e.volRatio >= 1.5 ? 'hot' : ''}>{e.volRatio.toFixed(2)}</td>
                      <td>{(e.avgVol5d / 10000).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Ranking
