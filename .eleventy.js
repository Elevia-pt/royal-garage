module.exports = function (eleventyConfig) {
  // Copy everything under public/ to site root (assets, etc.)
  eleventyConfig.addPassthroughCopy({ "public": "/" });

  // Expor brands.json + equipment.json ao admin SPA via /data/*.json
  eleventyConfig.addPassthroughCopy({ "src/_data/brands.json": "data/brands.json" });
  eleventyConfig.addPassthroughCopy({ "src/_data/equipment.json": "data/equipment.json" });

  // Watch CSS/JS in public for live reload during `npm run dev`
  eleventyConfig.addWatchTarget("./public/");

  // Slug filter — PT-aware (strips accents, lowercase, dashes)
  eleventyConfig.addFilter("slug", (str) =>
    String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );

  // Price formatter: 20500 -> "20.500 €"
  eleventyConfig.addFilter("price", (n) => {
    if (n === null || n === undefined || n === "") return "";
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
  });

  // Km formatter: 145000 -> "145.000 km"
  eleventyConfig.addFilter("km", (n) => {
    if (n === null || n === undefined || n === "") return "";
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " km";
  });

  // WhatsApp link with a prefilled message
  eleventyConfig.addFilter("waLink", (text, phoneIntl = "351924296020") => {
    return `https://wa.me/${phoneIntl}?text=${encodeURIComponent(text || "")}`;
  });

  // Related cars (exclude current + sold, take N)
  eleventyConfig.addFilter("relatedCars", (cars, currentId, n = 3) => {
    return (cars || [])
      .filter((c) => c.id !== currentId && c.status !== "sold")
      .slice(0, n);
  });

  // Filtrar por status (a venda = !sold; vendidos = sold)
  eleventyConfig.addFilter("forSale", (cars) =>
    (cars || []).filter((c) => c.status !== "sold")
  );
  eleventyConfig.addFilter("soldOnly", (cars) =>
    (cars || []).filter((c) => c.status === "sold")
  );

  // Current year (e.g., for footer)
  eleventyConfig.addShortcode("currentYear", () => new Date().getFullYear());

  // Years since a given year (e.g., {% yearsSince site.yearStarted %} -> 4)
  eleventyConfig.addShortcode("yearsSince", (startYear) => {
    return new Date().getFullYear() - (startYear || new Date().getFullYear());
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
