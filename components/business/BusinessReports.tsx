'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Package, 
  CheckCircle2, 
  XCircle, 
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  MapPin,
  AlertTriangle,
  BarChart3,
  Calendar,
} from 'lucide-react'
import type { LocationReport, BusinessReport } from '@/lib/types'

// Date range presets
const DATE_RANGES = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  'ytd': { label: 'Year to date', days: -1 }, // Special case
}

export function BusinessReports() {
  const { currentUser, businesses, getAccessibleLocations, isOwner, getLocationReport, getBusinessReport } = useApp()
  const [selectedRange, setSelectedRange] = useState<keyof typeof DATE_RANGES>('30d')
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all')
  
  const business = businesses.find(b => b.id === currentUser?.businessId)
  const accessibleLocations = getAccessibleLocations()
  const canViewAll = isOwner()
  
  // Calculate date range
  const { start, end } = useMemo(() => {
    const endDate = new Date()
    let startDate: Date
    
    if (selectedRange === 'ytd') {
      startDate = new Date(endDate.getFullYear(), 0, 1)
    } else {
      startDate = new Date()
      startDate.setDate(endDate.getDate() - DATE_RANGES[selectedRange].days)
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    }
  }, [selectedRange])
  
  // Get report data
  const report: BusinessReport | LocationReport | null = useMemo(() => {
    if (!business) return null
    
    if (selectedLocationId === 'all' && canViewAll) {
      return getBusinessReport(business.id, start, end)
    } else {
      const locId = selectedLocationId !== 'all' 
        ? selectedLocationId 
        : accessibleLocations[0]?.id
      if (!locId) return null
      return getLocationReport(locId, start, end)
    }
  }, [business, selectedLocationId, canViewAll, start, end, getBusinessReport, getLocationReport, accessibleLocations])
  
  if (!business) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No business found</p>
      </div>
    )
  }
  
  // Type guard to check if it's a BusinessReport
  const isBusinessReport = (r: BusinessReport | LocationReport): r is BusinessReport => {
    return 'locations' in r && 'totals' in r
  }
  
  // Get the stats to display
  const stats = report 
    ? isBusinessReport(report) ? report.totals : report 
    : null
  
  const successRate = stats && stats.totalDeliveries > 0
    ? Math.round((stats.completedDeliveries / stats.totalDeliveries) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">
            Track delivery performance and spending
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Location Filter */}
          {(canViewAll || accessibleLocations.length > 1) && (
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {canViewAll && (
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      All Locations
                    </span>
                  </SelectItem>
                )}
                {accessibleLocations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {loc.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Date Range */}
          <Select 
            value={selectedRange} 
            onValueChange={(v) => setSelectedRange(v as keyof typeof DATE_RANGES)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_RANGES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Stats Overview Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Deliveries */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDeliveries}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedDeliveries} completed, {stats.failedDeliveries} failed
              </p>
            </CardContent>
          </Card>
          
          {/* Success Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              {successRate >= 95 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : successRate >= 85 ? (
                <TrendingUp className="h-4 w-4 text-yellow-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.cancelledDeliveries} cancelled
              </p>
            </CardContent>
          </Card>
          
          {/* Avg Delivery Time */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgDeliveryMins > 0 ? `${stats.avgDeliveryMins} min` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                From order to delivery
              </p>
            </CardContent>
          </Card>
          
          {/* Total Spend */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalSpend.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                ${stats.paidInvoices.toFixed(2)} paid, ${stats.pendingInvoices.toFixed(2)} pending
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Detailed Breakdown */}
      {report && isBusinessReport(report) && report.locations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Location Breakdown
            </CardTitle>
            <CardDescription>
              Performance comparison across all locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.locations.map(loc => {
                const locSuccessRate = loc.totalDeliveries > 0
                  ? Math.round((loc.completedDeliveries / loc.totalDeliveries) * 100)
                  : 0
                
                return (
                  <div 
                    key={loc.locationId}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{loc.locationName}</p>
                        <p className="text-sm text-muted-foreground">
                          {loc.totalDeliveries} deliveries
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      {/* Success Rate */}
                      <div className="text-right">
                        <Badge 
                          variant="outline" 
                          className={
                            locSuccessRate >= 95 
                              ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                              : locSuccessRate >= 85
                                ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }
                        >
                          {locSuccessRate}% success
                        </Badge>
                      </div>
                      
                      {/* Spend */}
                      <div className="text-right min-w-[80px]">
                        <p className="font-medium">${loc.totalSpend.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">spend</p>
                      </div>
                      
                      {/* Issues */}
                      {loc.issues.length > 0 && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {loc.issues.reduce((sum, i) => sum + i.count, 0)} issues
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Issues Summary */}
      {stats && stats.issues && stats.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Issues Summary
            </CardTitle>
            <CardDescription>
              Common problems during the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stats.issues.map((issue) => (
                <div 
                  key={issue.type}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                >
                  <span className="text-sm capitalize">
                    {issue.type.replace(/_/g, ' ')}
                  </span>
                  <Badge variant="secondary">{issue.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Empty State */}
      {(!report || (stats && stats.totalDeliveries === 0)) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No data available</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              There are no deliveries for the selected period and location. Try adjusting your filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
