## The approach we'll take:

### Performance work only counts if you can answer two questions before and after a change:
    - Did it get faster for users? (time to see content, time to interact)
    - Did it get smaller/cheaper to deliver? (less JS, fewer requests, fewer bytes transferred)

### Metrics we should actually care about:
- Load experience (user-facing)
    - LCP (Largest Contentful Paint) How long before the main content is visible.
    - FCP (First Contentful Paint) When something meaningful appears.
    - TTI / INP  When the page becomes usable and responsive.
- Delivery cost (engineering-facing)
    - Total JS size (KB)
    - Total transferred bytes 
    - Number of requests
    - Main-thread blocking time 
