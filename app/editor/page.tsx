import type { Metadata } from "next";
import { ParcelEditor } from "@/components/parcel-editor";

export const metadata: Metadata = {
  title: "Editor",
};

export default function EditorPage() {
  return <ParcelEditor />;
}
