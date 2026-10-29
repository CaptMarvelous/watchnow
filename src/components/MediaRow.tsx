import type { CardMedia } from "@/lib/types";
import { MediaCard } from "./MediaCard";

type Props = {
  id: string;
  title: string;
  items: CardMedia[];
};

export function MediaRow({ id, title, items }: Props) {
  if (items.length === 0) return null;
  const headingId = `row-${id}`;

  return (
    <section aria-labelledby={headingId} className="py-4">
      <h2
        id={headingId}
        className="mx-auto mb-3 max-w-7xl px-4 font-display text-xl text-cream sm:px-6 lg:px-8"
      >
        {title}
      </h2>
      <ul className="no-scrollbar mx-auto flex max-w-7xl snap-x gap-3 overflow-x-auto px-4 pb-2 sm:gap-4 sm:px-6 lg:px-8">
        {items.map((media) => (
          <li
            key={`${media.kind}-${media.id}`}
            className="w-36 shrink-0 snap-start sm:w-40 lg:w-44"
          >
            <MediaCard media={media} />
          </li>
        ))}
      </ul>
    </section>
  );
}
