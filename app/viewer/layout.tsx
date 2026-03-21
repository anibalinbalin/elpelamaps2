import "cesium/Build/Cesium/Widgets/widgets.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viewer",
};

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
