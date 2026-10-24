export default function BrandMark() {
  return <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/brand/lookout-mark.svg`} width={32} height={32} alt="" aria-hidden="true" className="shrink-0" />;
}
