# External SSD workspace preference

- Record the user-requested external SSD location for future task checkouts, dependencies, build artifacts, temporary files and npm cache; retain the existing shared main checkout.
- Verification: root and frontend npm ci succeeded on the SSD. Production build passed on retry, generating 51 pages and 351 offline assets. The initial Next.js build stopped with its security advisory; dependency security upgrades are outside this location-only change.
- No product or backend changes. No publication or deployment.
