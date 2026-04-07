# Project Concerns

## Technical Debt & Known Issues
- **Mock vs Real Backend Migration:** The project architecture dictates migrating off the frontend mock layer over to the `server/` Fastify project. This ongoing migration must ensure the frontend `api-client` seamlessly switches over without downtime.
- **Monorepo Complexity:** `shared/` workspace has not yet been extracted fully. Keep Zod schemas redundantly copied vs symlinked before stabilizing.

## Performance
- **WebGL Backgrounding Risks:** E2E Emitters inside E2E Tests might find performance bottlenecks around `FluidCanvas` / `FluidMaskCursor` on lower-tier hardware. Although `FluidMaskCursor` states it is "EXTREME PERFORMANCE (Low CPU Load)", continuous context generation must be watched.

## Security Considerations
- Ensure domain-based user restrictions correctly bounce out unwanted tenant emails.
- CSRF configurations and Strict SameSite Cookie policies must be bulletproofed in the NGINX / Fastify setup before deployment to combat Cross-Site Request Forgery over state-changing operations.
