'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import {
  Star,
  CheckCircle,
  AlertCircle,
  Truck,
  Building2,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { getFeedbackByToken, submitCustomerFeedback } from '@/lib/db-extended'
import type { CustomerFeedback } from '@/lib/types'

interface RatingSelectProps {
  label: string
  value: number | null
  onChange: (value: number) => void
  description?: string
}

function RatingSelect({ label, value, onChange, description }: RatingSelectProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => onChange(rating)}
            className={`p-2 rounded-lg transition-all ${
              value === rating
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            <Star
              className={`w-5 h-5 ${value === rating ? 'fill-current' : ''}`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

const ISSUES = [
  { value: 'late', label: 'Delivery was late' },
  { value: 'damaged', label: 'Package was damaged' },
  { value: 'rude', label: 'Driver was rude/unprofessional' },
  { value: 'wrong_address', label: 'Wrong address/location' },
  { value: 'incomplete', label: 'Items missing or incomplete' },
  { value: 'other', label: 'Other issue' },
]

export function FeedbackPage({ token }: { token: string }) {
  const [feedback, setFeedback] = useState<CustomerFeedback | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [driverRating, setDriverRating] = useState<number | null>(null)
  const [businessRating, setBusinessRating] = useState<number | null>(null)
  const [driverProfessionalism, setDriverProfessionalism] = useState<number | null>(null)
  const [driverTimeliness, setDriverTimeliness] = useState<number | null>(null)
  const [driverPackageHandling, setDriverPackageHandling] = useState<number | null>(null)
  const [businessPackaging, setBusinessPackaging] = useState<number | null>(null)
  const [businessAccuracy, setBusinessAccuracy] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set())
  const [issueDetails, setIssueDetails] = useState('')

  useEffect(() => {
    const loadFeedback = async () => {
      try {
        const data = await getFeedbackByToken(token)
        if (!data) {
          setError('Feedback link not found or has expired. Please check the link and try again.')
          setLoading(false)
          return
        }
        setFeedback(data)
        setLoading(false)
      } catch (err) {
        setError('Failed to load feedback form. Please try again.')
        setLoading(false)
      }
    }
    loadFeedback()
  }, [token])

  const handleIssueToggle = (issue: string) => {
    const newIssues = new Set(selectedIssues)
    if (newIssues.has(issue)) {
      newIssues.delete(issue)
    } else {
      newIssues.add(issue)
    }
    setSelectedIssues(newIssues)
  }

  const handleSubmit = async () => {
    if (!feedback || !driverRating || !businessRating) {
      toast.error('Please rate both the driver and business')
      return
    }

    setSubmitting(true)
    try {
      await submitCustomerFeedback(
        feedback.id,
        driverRating,
        businessRating,
        driverProfessionalism,
        driverTimeliness,
        driverPackageHandling,
        businessPackaging,
        businessAccuracy,
        comment || null,
        selectedIssues.size > 0 ? { issues: Array.from(selectedIssues) } : null,
        issueDetails || null,
      )
      setSubmitted(true)
      toast.success('Thank you for your feedback!')
    } catch (err) {
      toast.error('Failed to submit feedback. Please try again.')
      console.error('[v0] Feedback submission error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/20 bg-destructive/5">
          <CardContent className="p-6 space-y-4 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Oops!</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-success/20 bg-success/5">
          <CardContent className="p-6 space-y-4 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Thank You!</h2>
            <p className="text-sm text-muted-foreground">
              We appreciate your feedback. Your ratings and comments help us improve our service.
            </p>
            <div className="pt-4">
              <p className="text-xs text-muted-foreground">
                Your feedback has been recorded and will help us serve you better.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!feedback) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">How was your delivery?</h1>
          <p className="text-muted-foreground">
            Your feedback helps us improve service quality
          </p>
        </div>

        {/* Delivery Summary */}
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Truck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Driver</p>
                <p className="font-medium text-foreground truncate">Delivery completed</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Business</p>
                <p className="font-medium text-foreground truncate">
                  {feedback.businessId}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Ratings */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              <h2 className="font-semibold text-lg text-foreground">Overall Ratings</h2>
              
              <RatingSelect
                label="Driver Rating"
                value={driverRating}
                onChange={setDriverRating}
                description="How would you rate the driver?"
              />
              
              <RatingSelect
                label="Business Rating"
                value={businessRating}
                onChange={setBusinessRating}
                description="How would you rate the business/service?"
              />
            </div>
          </CardContent>
        </Card>

        {/* Detailed Ratings */}
        <Card>
          <CardContent className="p-6 space-y-6">
            <h2 className="font-semibold text-lg text-foreground">Detailed Feedback (Optional)</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-3">About the Driver</p>
                <div className="space-y-4">
                  <RatingSelect
                    label="Professionalism"
                    value={driverProfessionalism}
                    onChange={setDriverProfessionalism}
                  />
                  <RatingSelect
                    label="Timeliness"
                    value={driverTimeliness}
                    onChange={setDriverTimeliness}
                  />
                  <RatingSelect
                    label="Package Handling"
                    value={driverPackageHandling}
                    onChange={setDriverPackageHandling}
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">About the Business</p>
                <div className="space-y-4">
                  <RatingSelect
                    label="Packaging Quality"
                    value={businessPackaging}
                    onChange={setBusinessPackaging}
                  />
                  <RatingSelect
                    label="Order Accuracy"
                    value={businessAccuracy}
                    onChange={setBusinessAccuracy}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issues Section */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <h2 className="font-semibold text-lg text-foreground">
                Any issues?
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Let us know if anything went wrong (optional)
            </p>

            <div className="space-y-3">
              {ISSUES.map((issue) => (
                <div key={issue.value} className="flex items-center gap-3">
                  <Checkbox
                    id={issue.value}
                    checked={selectedIssues.has(issue.value)}
                    onCheckedChange={() => handleIssueToggle(issue.value)}
                  />
                  <Label
                    htmlFor={issue.value}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {issue.label}
                  </Label>
                </div>
              ))}
            </div>

            {selectedIssues.size > 0 && (
              <div className="pt-2">
                <Label className="text-sm font-medium text-foreground mb-2 block">
                  Please provide details
                </Label>
                <Textarea
                  placeholder="Tell us more about the issue..."
                  value={issueDetails}
                  onChange={(e) => setIssueDetails(e.target.value)}
                  className="min-h-20"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg text-foreground">
                Additional Comments
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Any other feedback or suggestions? (optional)
            </p>
            <Textarea
              placeholder="Share your thoughts..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-24"
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !driverRating || !businessRating}
            size="lg"
            className="flex-1"
          >
            {submitting ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Submitting...
              </>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        </div>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground py-4">
          Your feedback is secure and anonymous. This link will expire in 7 days.
        </p>
      </div>
    </div>
  )
}
