import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src" | "alt"> & { src: string; alt: string };

/**
 * next/image for files this site serves (resized + AVIF/WebP), plain <img> for external URLs
 * an admin may paste, since those are not in images.remotePatterns. Animated GIFs skip optimization.
 */
export function Media({ src, alt, ...rest }: Props) {
  if (!src.startsWith("/")) {
    const { className, style, priority } = rest;
    return <img src={src} alt={alt} className={className} style={style} loading={priority ? "eager" : "lazy"} decoding="async" />;
  }
  return <Image src={src} alt={alt} unoptimized={src.toLowerCase().endsWith(".gif")} {...rest} />;
}

/** Rich text is stored as HTML, so images inside it get their lazy-loading hints at render time. */
export const lazyRichImages = (html: string) => html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
