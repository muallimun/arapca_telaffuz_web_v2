"use client";

import dynamic from "next/dynamic";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";

const SmartboardOverlay = dynamic(
  () => import("@/components/classroom/SmartboardOverlay"),
  { ssr: false }
);

export default function SmartboardMount() {
  const isOpen = useClassroomToolsStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <SmartboardOverlay />;
}
