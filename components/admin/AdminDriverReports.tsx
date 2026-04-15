'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  Download, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'

export function AdminDriverReports() {
  const { driverReports, drivers } = useApp()
  const [selectedMonth, setSelectedMonth] = useState('2026-04')
  
  const months = [
    { value: '2026-04', label: 'April 2026' },
    { value: '2026-03', label: 'March 2026' },
    { value: '2026-02', label: 'February 2026' },
    { value: '2026-01', label: 'January 2026' },
  ]
  
  const filteredReports = driverReports.filter(r => r.month === selectedMonth)
  
  const handleExportCSV = () => {
    // Generate CSV content
    const headers = ['Driver', 'Deliveries', 'Completed', 'Failed', 'Avg Time', 'Rush SLA %', 'Adjustments']
    const rows = filteredReports.map(r => [
      r.driverName,
      r.totalDeliveries,
      r.completedDeliveries,
      r.failedDeliveries,
      r.averageTime,
      `${r.rushSlaRate}%`,
      r.adjustments,
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `driver-report-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(url)
    
    toast.success('CSV downloaded')
  }
  
  const getRushSlaColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400'
    if (rate >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  // Calculate totals
  const totals = filteredReports.reduce((acc, r) => ({
    deliveries: acc.deliveries + r.totalDeliveries,
    completed: acc.completed + r.completedDeliveries,
    failed: acc.failed + r.failedDeliveries,
    adjustments: acc.adjustments + r.adjustments,
  }), { deliveries: 0, completed: 0, failed: 0, adjustments: 0 })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Driver Reports</h2>
          <p className="text-sm text-muted-foreground">Monthly performance summaries</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleExportCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totals.deliveries}</p>
                <p className="text-xs text-muted-foreground">Total Deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totals.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totals.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totals.adjustments}</p>
                <p className="text-xs text-muted-foreground">Adjustments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-foreground">Driver Summary - {months.find(m => m.value === selectedMonth)?.label}</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Driver</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Deliveries</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Completed</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Failed</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Avg Time</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Rush SLA</th>
                <th className="text-center p-4 text-sm font-medium text-muted-foreground">Adjustments</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report) => (
                <tr 
                  key={report.driverId} 
                  className="border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]"
                >
                  <td className="p-4">
                    <span className="font-medium text-foreground">{report.driverName}</span>
                  </td>
                  <td className="p-4 text-center text-foreground">{report.totalDeliveries}</td>
                  <td className="p-4 text-center text-green-400">{report.completedDeliveries}</td>
                  <td className="p-4 text-center">
                    <span className={report.failedDeliveries > 0 ? 'text-red-400' : 'text-muted-foreground'}>
                      {report.failedDeliveries}
                    </span>
                  </td>
                  <td className="p-4 text-center text-muted-foreground">{report.averageTime}</td>
                  <td className={`p-4 text-center font-medium ${getRushSlaColor(report.rushSlaRate)}`}>
                    {report.rushSlaRate}%
                  </td>
                  <td className="p-4 text-center">
                    <span className={report.adjustments > 0 ? 'text-yellow-400' : 'text-muted-foreground'}>
                      {report.adjustments}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Individual Driver Summary Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredReports.map((report) => (
          <Card key={report.driverId} className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-foreground">{report.driverName}</h3>
                <Badge variant="outline" className={getRushSlaColor(report.rushSlaRate)}>
                  {report.rushSlaRate}% SLA
                </Badge>
              </div>
              
              {/* Weekly bars */}
              <div className="flex items-end justify-around h-16 gap-2 mb-4">
                {report.weeklyBreakdown.map((count, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 flex-1">
                    <div 
                      className="w-full bg-[var(--accent-orange)] rounded-t max-w-8"
                      style={{ 
                        height: `${Math.max(4, (count / Math.max(...report.weeklyBreakdown)) * 48)}px` 
                      }}
                    />
                    <span className="text-xs text-muted-foreground">W{i + 1}</span>
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="font-bold text-foreground">{report.totalDeliveries}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-bold text-green-400">{report.completedDeliveries}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div>
                  <p className="font-bold text-muted-foreground">{report.averageTime}</p>
                  <p className="text-xs text-muted-foreground">Avg Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
