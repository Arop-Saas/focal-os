/**
 * Default stock cover media for each service category.
 * Used as fallback when a service or package has no custom coverImage.
 * All images sourced from Unsplash, all videos from Pexels — free commercial-use licenses.
 */

export type StockMedia = {
  url: string;
  type: "image" | "video";
  alt: string;
};

/** One default cover per ServiceCategory enum value */
export const STOCK_COVERS: Record<string, StockMedia> = {
  PHOTOGRAPHY: {
    url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Modern home interior with natural light",
  },
  VIDEO: {
    url: "https://videos.pexels.com/video-files/5977256/5977256-uhd_2560_1440_30fps.mp4",
    type: "video",
    alt: "Cinematic property walkthrough",
  },
  DRONE: {
    url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Aerial view of residential property",
  },
  VIRTUAL_TOUR_3D: {
    url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Wide-angle open-concept living space",
  },
  FLOOR_PLAN: {
    url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Architectural blueprint aesthetic",
  },
  VIRTUAL_STAGING: {
    url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Beautifully furnished modern living room",
  },
  TWILIGHT: {
    url: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Luxury home at blue hour with warm interior glow",
  },
  SOCIAL_MEDIA: {
    url: "https://videos.pexels.com/video-files/6077449/6077449-uhd_2560_1440_25fps.mp4",
    type: "video",
    alt: "Property highlights reel",
  },
  RUSH_EDITING: {
    url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Fast-paced editing workspace",
  },
  OTHER: {
    url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=640&h=400&fit=crop&q=80",
    type: "image",
    alt: "Real estate consultation",
  },
};

/**
 * Returns the stock cover for a given category, or the OTHER fallback.
 */
export function getStockCover(category: string): StockMedia {
  return STOCK_COVERS[category] ?? STOCK_COVERS.OTHER;
}

/**
 * Returns true if the URL points to a video file.
 */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(url);
}

/**
 * Given a service/package's coverImage and category, returns the effective
 * cover URL and whether it's a video. Prefers the custom coverImage,
 * falls back to the stock cover for the category.
 */
export function getEffectiveCover(
  coverImage: string | null | undefined,
  category: string
): { url: string; isVideo: boolean } {
  if (coverImage) {
    return { url: coverImage, isVideo: isVideoUrl(coverImage) };
  }
  const stock = getStockCover(category);
  return { url: stock.url, isVideo: stock.type === "video" };
}
