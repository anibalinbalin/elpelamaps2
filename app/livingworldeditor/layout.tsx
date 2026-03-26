import type { Metadata } from "next";
import "cesium/Build/Cesium/Widgets/widgets.css";

export const metadata: Metadata = {
  title: "Living World Editor",
};

export default function LivingWorldEditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
