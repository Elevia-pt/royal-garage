// Slugify PT-aware (strips accents, lowercase, dashes only)
exports.slugify = (str) =>
  String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
