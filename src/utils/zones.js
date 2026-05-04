export const DEFAULT_ZONE_SLUG = "hannam-3";

export function autoSlug(name) {
  return String(name)
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}
