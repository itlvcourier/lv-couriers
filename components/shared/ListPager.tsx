'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ListPagerProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  itemLabel?: string
}

export function ListPager({ page, pageSize, total, onPageChange, itemLabel = 'items' }: ListPagerProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const first = page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2"
    >
      <p className="text-sm text-muted-foreground">
        Showing {first}–{last} of {total} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Prev
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground px-1">
          Page {page + 1} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </nav>
  )
}

/** Slice an in-memory list to a page, clamping the page if the list shrank. */
export function paginate<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  return {
    page: safePage,
    rows: items.slice(safePage * pageSize, (safePage + 1) * pageSize),
  }
}
