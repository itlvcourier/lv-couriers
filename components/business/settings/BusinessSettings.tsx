'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertSettings } from './AlertSettings'
import { BrandingSettings } from './BrandingSettings'
import { RecurringSettings } from './RecurringSettings'
import { DeveloperSettings } from './DeveloperSettings'
import { IssueCases } from './IssueCases'

export function BusinessSettings() {
  return (
    <Tabs defaultValue="cases" className="flex flex-col gap-6">
      <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
        <TabsTrigger value="cases">Problem cases</TabsTrigger>
        <TabsTrigger value="recurring">Recurring</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
        <TabsTrigger value="branding">Tracking page</TabsTrigger>
        <TabsTrigger value="developer">API &amp; webhooks</TabsTrigger>
      </TabsList>
      <TabsContent value="cases"><IssueCases /></TabsContent>
      <TabsContent value="recurring"><RecurringSettings /></TabsContent>
      <TabsContent value="alerts"><AlertSettings /></TabsContent>
      <TabsContent value="branding"><BrandingSettings /></TabsContent>
      <TabsContent value="developer"><DeveloperSettings /></TabsContent>
    </Tabs>
  )
}
