export function sanitize(text) {
  if (typeof text !== 'string') return text;
  
  return text
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "") // Remove <script>
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]*)/gim, "") // Remove event handlers
    .replace(/javascript:[^\s]*/gim, "")               // Remove javascript: URLs
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, ""); // Remove <iframe>
}
