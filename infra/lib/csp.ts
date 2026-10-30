// The Content-Security-Policy CloudFront sends (hosting.ts). Plain data with no CDK imports, so the
// e2e browser checks serve the very same policy and a CSP the app or worker breaks fails there too.
// Everything (shell, Tile icons) is served from this origin; Apps are opened, never framed.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");
