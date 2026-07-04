export const BRAND_LOGO_SRC = "/brand-logo.png";

const sizeClass = {
  xs: "brand-logo--xs",
  sm: "brand-logo--sm",
  md: "brand-logo--md",
  lg: "brand-logo--lg",
  xl: "brand-logo--xl",
  hero: "brand-logo--hero"
};

export default function BrandLogo({
  size = "md",
  className = "",
  alt = "EasyNo logo",
  title
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      title={title}
      className={`brand-logo ${sizeClass[size] || sizeClass.md}${className ? ` ${className}` : ""}`}
      decoding="async"
      draggable={false}
    />
  );
}
