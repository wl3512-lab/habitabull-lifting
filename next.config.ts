import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    The dev overlay sits in the bottom-left corner, which on a 390px phone
    layout is exactly where the primary action and its helper line live. It was
    covering buttons in every screenshot taken of this app. Off.
  */
  devIndicators: false,
};

export default nextConfig;
