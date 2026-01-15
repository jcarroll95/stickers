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


#### Initial results:
- First Contentful Paint 4.3 s
- Largest Contentful Paint 5.2 s
- Improve image delivery Est savings of 2,108 KiB
- Render blocking requests Est savings of 300 ms
- Modern HTTP Est savings of 970 ms

### Improvements Made:
- **Server-side Compression**: Integrated `compression` middleware in Express to Gzip/Brotli all responses, including JS, CSS, and API data. This addresses "Modern HTTP" and "Render blocking requests" by reducing download times.
- **Static Asset Caching**: Added `Cache-Control` headers with `max-age` for static assets. Production builds now use `immutable` caching for hashed assets (1 year), and other assets use a 1-day TTL.
- **LCP Optimization**: Added `<link rel="preload">` for the hero image (`sb0.png`) in `index.html` to start loading it earlier in the page lifecycle, improving Largest Contentful Paint.
- **Production Asset Serving**: Configured the backend to serve the `client/dist` folder with optimal headers when in production mode.

### Future Recommendations:
- **Image Optimization**: Convert large PNG assets in `/assets/` to WebP or AVIF format. 
- **Image Resizing**: Provide responsive image sizes (srcset) to avoid sending 2MB images to mobile devices.
- **HTTP/2**: Ensure the production environment (e.g., NGINX or hosting provider) supports HTTP/2 to allow multiplexing of requests.