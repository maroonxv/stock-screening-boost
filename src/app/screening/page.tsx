import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ScreeningStudioClient } from "~/app/screening/screening-studio-client";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

export default function ScreeningPage() {
  return (
    <div className={`${bodyFont.variable} ${displayFont.variable}`}>
      <ScreeningStudioClient />
    </div>
  );
}
