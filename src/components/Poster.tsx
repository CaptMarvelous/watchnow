import Image from "next/image";
import { tmdbImage, type ImageSize } from "@/lib/images";

type Props = {
  id: number;
  title: string;
  path: string | null;
  sizes: string;
  size?: ImageSize;
  priority?: boolean;
  className?: string;
};

export function Poster({
  id,
  title,
  path,
  sizes,
  size = "w500",
  priority = false,
  className = "",
}: Props) {
  const src = tmdbImage(path, size);
  const hue = (id * 47) % 360;

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden rounded-lg bg-raised ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={`${title} poster`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center p-3 text-center"
          style={{
            background: `linear-gradient(160deg, hsl(${hue} 35% 26%), hsl(${(hue + 40) % 360} 40% 10%))`,
          }}
        >
          <span className="font-display text-base leading-tight text-cream/90">
            {title}
          </span>
        </div>
      )}
    </div>
  );
}
