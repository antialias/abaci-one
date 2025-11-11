# Worksheet Virtualization Proposals

## Requirements

1. **Scrollable preview** - Users can scroll through all pages naturally
2. **Pagination controls** - Still show "Page X of Y" and allow jumping between pages
3. **Virtual rendering** - Only render pages that are visible/near-visible
4. **Performance** - Don't render all pages at once (especially for 4+ page worksheets)

---

## Proposal 1: Intersection Observer with Lazy Loading (Recommended)

### Approach

Use Intersection Observer to detect which page containers are in/near the viewport, and only render SVG content for visible pages.

### Implementation

```tsx
function WorksheetPreview({ formState, initialData }) {
  const [visiblePages, setVisiblePages] = useState(new Set([0])) // Start with page 0 visible
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Intersection Observer to track visible pages
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev)
          entries.forEach((entry) => {
            const pageIndex = Number(entry.target.getAttribute('data-page-index'))
            if (entry.isIntersecting) {
              next.add(pageIndex)
              // Preload adjacent pages
              next.add(pageIndex - 1)
              next.add(pageIndex + 1)
            } else {
              // Keep page rendered for smooth scrolling
              // Only remove if far from viewport
            }
          })
          return next
        })
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '50% 0px', // Start loading when page is 50% away from viewport
        threshold: 0.1,
      }
    )

    pageRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [pages.length])

  return (
    <div className={scrollContainerStyles}>
      {pages.map((page, index) => (
        <div
          key={index}
          ref={(el) => (pageRefs.current[index] = el)}
          data-page-index={index}
          className={pageContainerStyles}
        >
          {visiblePages.has(index) ? (
            <div dangerouslySetInnerHTML={{ __html: page }} />
          ) : (
            <PagePlaceholder pageNumber={index + 1} />
          )}
        </div>
      ))}

      {/* Floating pagination indicator */}
      <FloatingPageIndicator currentPage={currentVisiblePage} totalPages={pages.length} />
    </div>
  )
}
```

### Pros
- ✅ Native browser API (Intersection Observer)
- ✅ Simple implementation
- ✅ Smooth scrolling experience
- ✅ Preloads adjacent pages for seamless experience
- ✅ Works with existing SVG generation

### Cons
- ⚠️ Slight delay when scrolling very fast
- ⚠️ Keeps rendered pages in memory (but can be mitigated)

---

## Proposal 2: React Virtuoso (Library-based)

### Approach

Use `react-virtuoso` library specifically designed for virtualizing scrollable content with dynamic heights.

### Installation
```bash
npm install react-virtuoso
```

### Implementation

```tsx
import { Virtuoso } from 'react-virtuoso'

function WorksheetPreview({ formState, initialData }) {
  const [currentPage, setCurrentPage] = useState(0)

  return (
    <div className={previewContainerStyles}>
      <Virtuoso
        totalCount={pages.length}
        itemContent={(index) => (
          <div className={pageStyles}>
            <div dangerouslySetInnerHTML={{ __html: pages[index] }} />
          </div>
        )}
        rangeChanged={(range) => {
          // Update current page indicator based on visible range
          setCurrentPage(Math.floor((range.startIndex + range.endIndex) / 2))
        }}
        style={{ height: '100%' }}
        overscan={1} // Render 1 extra page above/below
      />

      {/* Pagination controls */}
      <FloatingPageIndicator currentPage={currentPage} totalPages={pages.length} />
    </div>
  )
}
```

### Pros
- ✅ Battle-tested library (90k+ downloads/week)
- ✅ Handles dynamic heights automatically
- ✅ Built-in scroll restoration
- ✅ Very smooth performance
- ✅ Minimal code

### Cons
- ❌ New dependency (~10KB)
- ⚠️ Requires learning library API

---

## Proposal 3: Hybrid Tabs + Virtual Scroll

### Approach

Combine tab-based pagination (keep current UX) with lazy SVG loading for large worksheets.

### Implementation

```tsx
function WorksheetPreview({ formState, initialData }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [loadedPages, setLoadedPages] = useState(new Set([0]))

  // Load current page + adjacent pages
  useEffect(() => {
    const toLoad = new Set([
      Math.max(0, currentPage - 1),
      currentPage,
      Math.min(pages.length - 1, currentPage + 1),
    ])
    setLoadedPages((prev) => new Set([...prev, ...toLoad]))
  }, [currentPage, pages.length])

  return (
    <div className={previewContainerStyles}>
      {/* Pagination controls (top) */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={pages.length}
        onChange={setCurrentPage}
      />

      {/* Single page view with lazy loading */}
      <div className={singlePageContainerStyles}>
        {loadedPages.has(currentPage) ? (
          <div
            key={currentPage}
            className={fadeInAnimation}
            dangerouslySetInnerHTML={{ __html: pages[currentPage] }}
          />
        ) : (
          <PageSkeleton />
        )}
      </div>

      {/* Pagination controls (bottom) */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={pages.length}
        onChange={setCurrentPage}
      />
    </div>
  )
}
```

### Pros
- ✅ Keeps existing UX (pagination buttons)
- ✅ Very simple implementation
- ✅ No new dependencies
- ✅ Instant page switching (pages stay loaded)

### Cons
- ❌ Not truly scrollable (tab-based navigation)
- ⚠️ Loads all pages eventually (if user navigates)

---

## Proposal 4: Virtual Scroll with Skeleton Placeholders

### Approach

Custom implementation using scroll position tracking with skeleton placeholders for unloaded pages.

### Implementation

```tsx
function WorksheetPreview({ formState, initialData }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [loadedPages, setLoadedPages] = useState(new Set([0]))
  const [currentPage, setCurrentPage] = useState(0)

  // Estimate page height (worksheets are consistent size)
  const pageHeight = 800 // Approximate SVG height
  const gap = 16

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return

      const scrollTop = scrollRef.current.scrollTop
      const containerHeight = scrollRef.current.clientHeight

      // Calculate visible page range
      const startPage = Math.max(0, Math.floor(scrollTop / (pageHeight + gap)) - 1)
      const endPage = Math.min(
        pages.length - 1,
        Math.ceil((scrollTop + containerHeight) / (pageHeight + gap)) + 1
      )

      // Update current page indicator
      const centerPage = Math.floor(
        (scrollTop + containerHeight / 2) / (pageHeight + gap)
      )
      setCurrentPage(Math.min(pages.length - 1, centerPage))

      // Load visible pages
      const toLoad = new Set<number>()
      for (let i = startPage; i <= endPage; i++) {
        toLoad.add(i)
      }
      setLoadedPages((prev) => new Set([...prev, ...toLoad]))
    }

    const scrollEl = scrollRef.current
    scrollEl?.addEventListener('scroll', handleScroll)
    handleScroll() // Initial load

    return () => scrollEl?.removeEventListener('scroll', handleScroll)
  }, [pages.length])

  // Jump to page function for pagination controls
  const jumpToPage = (pageIndex: number) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      top: pageIndex * (pageHeight + gap),
      behavior: 'smooth',
    })
  }

  return (
    <div className={previewContainerStyles}>
      {/* Floating pagination with jump controls */}
      <FloatingPagination
        currentPage={currentPage}
        totalPages={pages.length}
        onJumpToPage={jumpToPage}
      />

      <div ref={scrollRef} className={scrollContainerStyles}>
        {pages.map((page, index) => (
          <div
            key={index}
            className={pageContainerStyles}
            style={{ minHeight: pageHeight }}
          >
            {loadedPages.has(index) ? (
              <div dangerouslySetInnerHTML={{ __html: page }} />
            ) : (
              <PageSkeleton pageNumber={index + 1} height={pageHeight} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Pros
- ✅ Full scroll + pagination controls
- ✅ No dependencies
- ✅ Skeleton shows page structure while loading
- ✅ Smooth scrolling with page indicators

### Cons
- ⚠️ Requires estimating page heights
- ⚠️ More complex than Intersection Observer
- ⚠️ Needs careful handling of dynamic heights

---

## Comparison Matrix

| Feature | Proposal 1 (Intersection Observer) | Proposal 2 (Virtuoso) | Proposal 3 (Hybrid Tabs) | Proposal 4 (Custom Virtual) |
|---------|-------------------------------------|----------------------|--------------------------|----------------------------|
| Scrollable | ✅ | ✅ | ❌ (tabs only) | ✅ |
| Pagination Controls | ✅ | ✅ | ✅ | ✅ |
| Virtual Rendering | ✅ | ✅ | ⚠️ (lazy load) | ✅ |
| Dependencies | 0 | 1 (~10KB) | 0 | 0 |
| Implementation Complexity | Low | Very Low | Low | Medium |
| Dynamic Heights | ✅ | ✅ | N/A | ⚠️ (needs estimates) |
| Smooth Scrolling | ✅ | ✅✅ | N/A | ✅ |
| Preloading | ✅ | ✅ | ✅ | ✅ |
| Browser Support | Modern | All | All | All |

---

## Recommendation: Proposal 1 (Intersection Observer)

**Why?**
1. **Native API** - No dependencies, works in all modern browsers
2. **Simple** - ~50 lines of code
3. **Flexible** - Easy to customize preloading strategy
4. **Scrollable** - Natural scroll experience
5. **Pagination** - Can add floating page indicator + jump controls
6. **Performance** - Only renders visible pages + buffer

**When to use Proposal 2 instead:**
- If worksheets have highly variable heights
- If you want battle-tested virtualization
- If team is comfortable with adding dependencies

---

## Implementation Plan (Proposal 1)

### Step 1: Update WorksheetPreview Component
- [ ] Add Intersection Observer setup
- [ ] Track visible pages in state
- [ ] Add page refs array
- [ ] Implement preloading logic (±1 page)

### Step 2: Create Supporting Components
- [ ] `PagePlaceholder.tsx` - Skeleton for unloaded pages
- [ ] `FloatingPageIndicator.tsx` - Shows "Page X of Y" while scrolling
- [ ] Add jump-to-page functionality

### Step 3: Styling
- [ ] Scrollable container styles
- [ ] Page gap/spacing
- [ ] Floating pagination position
- [ ] Smooth scroll behavior

### Step 4: Optimization
- [ ] Debounce visibility checks
- [ ] Unload pages far from viewport (memory management)
- [ ] Add loading states
- [ ] Test with 4-page worksheets

---

## Code Skeleton (Proposal 1)

```tsx
interface PageVisibilityState {
  visiblePages: Set<number>
  currentPage: number
}

function WorksheetPreview({ formState, initialData }: WorksheetPreviewProps) {
  const [{ visiblePages, currentPage }, setPageState] = useState<PageVisibilityState>({
    visiblePages: new Set([0]),
    currentPage: 0,
  })

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement | null)[]>([])

  // Fetch pages (existing logic)
  const { data: pages } = useSuspenseQuery({ ... })

  // Intersection Observer setup
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Track visible pages
        // Update currentPage indicator
        // Preload adjacent pages
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '100% 0px',
        threshold: [0, 0.5, 1]
      }
    )

    pageRefs.current.forEach(ref => ref && observer.observe(ref))
    return () => observer.disconnect()
  }, [pages.length])

  // Jump to page function
  const jumpToPage = (index: number) => {
    pageRefs.current[index]?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div>
      {/* Floating pagination */}
      <FloatingPageIndicator
        currentPage={currentPage}
        totalPages={pages.length}
        onJumpToPage={jumpToPage}
      />

      {/* Scrollable pages */}
      <div ref={scrollContainerRef} className={scrollStyles}>
        {pages.map((page, i) => (
          <div
            key={i}
            ref={el => pageRefs.current[i] = el}
            data-page-index={i}
          >
            {visiblePages.has(i) ? (
              <div dangerouslySetInnerHTML={{ __html: page }} />
            ) : (
              <PagePlaceholder />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

Ready to implement? Which proposal do you prefer?
