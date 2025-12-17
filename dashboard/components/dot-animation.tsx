"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FlickeringGrid } from "@/components/ui/flickering-grid"

export default function DotAnimation() {
  const { theme } = useTheme();
  const [gridColor, setGridColor] = useState("rgb(0, 236, 151)");

  useEffect(() => {
    // Read CSS variable value from browser
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--dot-animation")
      .trim();

    if (value) setGridColor(value);
  }, [theme]); // update when theme changes

  return (
    <>
      <FlickeringGrid
        squareSize={10}
        color={gridColor} // real rgb/hex
        className="absolute h-full w-full z-0 [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none overflow-x-hidden"
      />
    </>
  );
}
