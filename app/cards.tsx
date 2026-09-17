import Link from "next/link";
import type { CSSProperties } from "react";
import type { GameWithTags, NewsWithTag } from "@/lib/content";
import { thaiDate, tint } from "@/lib/tags";
import { Media } from "./media";

/** Game card used on the homepage, /games and the "more games" row. Safe in server and client components. */
export function GameCard({ game, style }: { game: GameWithTags; style?: CSSProperties }) {
  const cat = game.category?.isActive ? game.category : null;
  const href = `/games/${game.slug}`;
  return (
    <div className="game-card reveal" style={style}>
      <Link href={href} className="game-img" style={{ background: `linear-gradient(135deg,#1a1a4a,${tint(cat?.color ?? "#8b5cf6", "66")})` }}>
        {game.coverImage ? (
          <Media className="game-cover" src={game.coverImage} alt={game.name} fill sizes="(max-width: 500px) 46vw, (max-width: 900px) 48vw, 300px" />
        ) : (
          <div className="game-img-placeholder" />
        )}
        {cat && (
          <div className="game-platform" style={{ background: cat.color, color: cat.textColor }}>
            {cat.name}
          </div>
        )}
        {game.badges.length > 0 && (
          <div className="game-badges">
            {game.badges.map((b) => (
              <span key={b.id} className="game-badge" style={{ background: b.color, color: b.textColor }}>
                {b.name}
              </span>
            ))}
          </div>
        )}
      </Link>
      <div className="game-body">
        <div className="game-name">{game.name}</div>
        <div className="game-genre">{game.genre || " "}</div>
        <div className="game-bottom">
          <div className="game-rating">
            {game.rating > 0 && (
              <>
                <span className="game-star">★</span> {game.rating.toFixed(1)}
              </>
            )}
          </div>
          <Link href={href} className="game-detail-btn">
            ดูรายละเอียด
          </Link>
        </div>
      </div>
    </div>
  );
}

export function NewsCard({ item, style }: { item: NewsWithTag; style?: CSSProperties }) {
  const cat = item.category?.isActive ? item.category : null;
  const color = cat?.color ?? "#8b5cf6";
  return (
    <Link href={`/news/${item.slug}`} className="news-card reveal" style={style}>
      <div className="news-img" style={{ background: `linear-gradient(135deg,${tint(color, "14")},${tint(color, "2e")})` }}>
        {item.coverImage && <Media src={item.coverImage} alt={item.title} fill sizes="(max-width: 500px) 46vw, (max-width: 900px) 48vw, 260px" />}
      </div>
      <div className="news-body">
        {cat && <NewsTag name={cat.name} color={color} />}
        <div className="news-title">{item.title}</div>
        <div className="news-date">{thaiDate(item.publishedAt)}</div>
      </div>
    </Link>
  );
}

export function NewsTag({ name, color }: { name: string; color: string }) {
  return (
    <span className="news-tag" style={{ background: tint(color, "14"), color, border: `1px solid ${tint(color, "33")}` }}>
      {name}
    </span>
  );
}
