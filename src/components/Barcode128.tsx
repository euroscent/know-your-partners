import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface Barcode128Props {
  value: string;
  /** Barcode-Format. Standard: EAN13. */
  format?: "EAN13" | "CODE128" | "CODE39";
  height?: number;
  width?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
  className?: string;
}

/**
 * Wiederverwendbare Barcode-Komponente (Standard EAN-13, alternativ Code 128 / Code 39).
 * Rendert den Barcode in ein <svg> mittels JsBarcode.
 */
export const Barcode128 = ({
  value,
  format = "EAN13",
  height = 90,
  width = 2,
  displayValue = true,
  fontSize = 16,
  margin = 10,
  background = "#ffffff",
  lineColor = "#000000",
  className,
}: Barcode128Props) => {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format,
        height,
        width,
        displayValue,
        fontSize,
        margin,
        background,
        lineColor,
      });
    } catch (err) {
      console.error("Barcode render error:", err);
    }
  }, [value, format, height, width, displayValue, fontSize, margin, background, lineColor]);

  return <svg ref={ref} className={className} />;
};

export default Barcode128;
