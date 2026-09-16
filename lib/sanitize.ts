import sanitizeHtml from "sanitize-html";

const align = { "text-align": [/^(left|right|center|justify)$/] };

/** Whitelist for what the Tiptap editor can produce. Runs on every save, so stored HTML is always safe to render. */
export function cleanRichText(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "a", "img", "div", "iframe"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      div: ["data-youtube-video"],
      iframe: ["src", "width", "height", "allowfullscreen", "allow", "frameborder"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: { p: align, h2: align, h3: align, h4: align },
    allowedSchemes: ["http", "https", "mailto"],
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }) },
  });
}
