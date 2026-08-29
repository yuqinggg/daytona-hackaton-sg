import Image from "next/image";

/**
 * The monochrome logo lockup: black mark on a white disc. The guide allows
 * this variant on dark backgrounds, which is the only background this app has.
 *
 * The source art has slightly ragged edges from its trace, so the disc is
 * clipped rather than trusted - `overflow-hidden` on a circle hides it.
 */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ash"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image src="/logo.png" alt="" width={size} height={size} priority />
    </span>
  );
}
