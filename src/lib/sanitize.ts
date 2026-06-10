import DOMPurify from 'isomorphic-dompurify';

export function sanitize(s: string): string {
  return DOMPurify.sanitize(s, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}
