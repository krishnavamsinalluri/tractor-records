"use client";

import React from "react";
import { Truck, Tools, GridFill, GearWideConnected, Hammer } from "react-bootstrap-icons";

type WorkTypeIconProps = {
  name: string;
  size?: number;
  className?: string;
};

export function getWorkTypeMeta(name: string): {
  icon: "cultivator" | "rotavator" | "plough" | "leveling" | "transport" | "other";
  bg: string;
  border: string;
  color: string;
} {
  const lower = name.toLowerCase();
  if (lower.includes("cultivator") || lower.includes("కల్టివేటర్")) {
    return { icon: "cultivator", bg: "#e8f5e9", border: "#c8e6c9", color: "#2e7d32" };
  }
  if (lower.includes("rotavator") || lower.includes("రోటావేటర్") || lower.includes("రోటవేటర్")) {
    return { icon: "rotavator", bg: "#fff3e0", border: "#ffe0b2", color: "#e65100" };
  }
  if (lower.includes("plough") || lower.includes("plow") || lower.includes("దుక్కి") || lower.includes("ప్లోవింగ్")) {
    return { icon: "plough", bg: "#efebe9", border: "#d7ccc8", color: "#5d4037" };
  }
  if (lower.includes("level") || lower.includes("లెవెలింగ్") || lower.includes("సమం")) {
    return { icon: "leveling", bg: "#fef9c3", border: "#fde047", color: "#a16207" };
  }
  if (lower.includes("transport") || lower.includes("రవాణా") || lower.includes("trolley") || lower.includes("ట్రాలీ")) {
    return { icon: "transport", bg: "#e0f2fe", border: "#bae6fd", color: "#0284c7" };
  }
  return { icon: "other", bg: "#f1f5f9", border: "#e2e8f0", color: "#475569" };
}

export function WorkTypeIcon({ name, size = 24, className }: WorkTypeIconProps) {
  const meta = getWorkTypeMeta(name);

  switch (meta.icon) {
    case "cultivator":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={meta.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M4 6h16" />
          <path d="M6 6v5a2 2 0 0 0 2 2h0a2 2 0 0 1 2 2v3" />
          <path d="M12 6v7a2 2 0 0 1 2 2v3" />
          <path d="M18 6v5a2 2 0 0 1-2 2h0a2 2 0 0 0-2 2v3" />
          <circle cx="8" cy="19" r="1" fill={meta.color} />
          <circle cx="14" cy="19" r="1" fill={meta.color} />
        </svg>
      );
    case "rotavator":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={meta.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="M4.93 4.93l2.83 2.83" />
          <path d="M16.24 16.24l2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="M4.93 19.07l2.83-2.83" />
          <path d="M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case "plough":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={meta.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <path d="M3 8h11l7 8H8l-5-8z" />
          <path d="M9 8V4" />
          <path d="M16 16v4" />
        </svg>
      );
    case "leveling":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={meta.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
        >
          <line x1="3" y1="18" x2="21" y2="18" strokeWidth="3" />
          <path d="M6 18l4-10h4l4 10" />
          <circle cx="12" cy="12" r="1.5" fill={meta.color} />
        </svg>
      );
    case "transport":
      return <Truck size={size} color={meta.color} className={className} />;
    default:
      return <GridFill size={size} color={meta.color} className={className} />;
  }
}

export function TractorBrandIcon({ size = 28, color = "#15803d", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="8" cy="23" r="5" fill={color} />
      <circle cx="8" cy="23" r="2.5" fill="#ffffff" />
      <circle cx="24" cy="24" r="3.5" fill={color} />
      <circle cx="24" cy="24" r="1.5" fill="#ffffff" />
      <path
        d="M8 18h8l3 3h5v-3l-4-4h-5v-5h-3v5H8v4z"
        fill={color}
      />
      <rect x="17" y="10" width="1.5" height="4" fill={color} />
      <path d="M12 7h-2v2h2V7z" fill={color} />
    </svg>
  );
}
