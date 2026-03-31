'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { DeliveryStatus } from '@/lib/types'
import { statusSteps, getStatusIndex } from '@/lib/delivery-utils'

interface StatusStepperProps {
  currentStatus: DeliveryStatus
  className?: string
}

export function StatusStepper({ currentStatus, className }: StatusStepperProps) {
  const currentIndex = getStatusIndex(currentStatus)

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {statusSteps.map((step, index) => {
        const stepIndex = getStatusIndex(step.status)
        const isCompleted = currentIndex > stepIndex
        const isCurrent = currentStatus === step.status
        const isUpcoming = currentIndex < stepIndex

        return (
          <div key={step.status} className="flex items-start gap-3">
            {/* Vertical line and circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                  isCompleted && 'bg-orange-500 border-orange-500',
                  isCurrent && 'border-orange-500 bg-orange-500/20 animate-status-pulse',
                  isUpcoming && 'border-[#1f2535] bg-[#141720]'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" />
                ) : isCurrent ? (
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-[#1f2535]" />
                )}
              </div>
              {/* Connecting line */}
              {index < statusSteps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 h-8 transition-all duration-300',
                    currentIndex > stepIndex ? 'bg-orange-500' : 'bg-[#1f2535]'
                  )}
                />
              )}
            </div>
            {/* Label */}
            <div className="pt-1.5">
              <p
                className={cn(
                  'text-sm font-medium transition-colors duration-200',
                  isCompleted && 'text-orange-500',
                  isCurrent && 'text-[#e8eaf0]',
                  isUpcoming && 'text-[#6b7280]'
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
