// Turns any URL-looking text into a real clickable link. React handles HTML
// escaping automatically when we render text as children, but since we need
// to inject <a> tags we build this as an array of strings/elements for React
// to render safely (avoiding dangerouslySetInnerHTML entirely).

import React from 'react'

const URL_PATTERN = /((https?:\/\/|www\.)[^\s<>"]+[^\s<>".,;:!?)\]])/gi

export function linkify(text) {
  if (!text) return null
  const parts = []
  let lastIndex = 0
  let match
  const re = new RegExp(URL_PATTERN)

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    const href = url.toLowerCase().startsWith('http') ? url : `https://${url}`
    parts.push(
      
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{ color: '#3A86D4', textDecoration: 'underline' }}
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
