"use client";

import dynamic from "next/dynamic";
import { useClassroomToolsStore } from "@/store/classroomToolsStore";

const SmartboardOverlay = dynamic(
  () => import("@/components/classroom/SmartboardOverlay"),
  { ssr: false }
);

export default function SmartboardMount() {
  const shouldMount = useClassroomToolsStore(
    (s) => s.isOpen || s.timerOpen || s.pickerOpen || s.curtainOpen
  );
  if (!shouldMount) return null;
  return <SmartboardOverlay />;
}
