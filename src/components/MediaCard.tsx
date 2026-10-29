import Link from "next/link";
import { cardMeta, mediaHref } from "@/lib/format";
import type { CardMedia } from "@/lib/types";
import { Poster } from "./Poster";
import { QuickAdd } from "./QuickAdd";

type Props = {
  media: CardMedia;
  priority?: boolean;
};

export function MediaCard({ media, priority = false }: Props) {
  const meta = cardMeta(media);

  return (
    <div className="group relative">
      <Link href={mediaHref(media.kind, media.id)} className="block rounded-lg">
        <Poster
          id={media.id}
          title={media.title}
          path={media.posterPath}
          size="w342"
          sizes="(min-width: 1024px) 176px, (min-width: 640px) 160px, 144px"
          priority={priority}
          className="transition duration-300 group-hover:scale-[1.03] group-hover:ring-2 group-hover:ring-marquee/60"
        />
        <div className="mt-2 px-0.5">
          <h3 className="line-clamp-1 text-sm font-medium text-cream">{media.title}</h3>
          {meta && <p className="text-xs text-mute">{meta}</p>}
        </div>
      </Link>
      <div className="absolute right-2 top-2 z-10">
        <QuickAdd kind={media.kind} id={media.id} title={media.title} />
      </div>
    </div>
  );
}
