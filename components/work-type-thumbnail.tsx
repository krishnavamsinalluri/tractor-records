"use client";

import Image from "next/image";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { WORK_TYPE_IMAGE_BUCKET } from "@/lib/work-type-images";
import { WorkTypeIcon } from "@/components/work-type-icon";
import type { WorkType } from "@/lib/types";

export function WorkTypeThumbnail({
  workType,
  size,
  width = 60,
  height = 48,
  previewUrl,
  fit = "contain",
}: {
  workType: Pick<WorkType, "name" | "image_path">;
  size?: number;
  width?: number;
  height?: number;
  previewUrl?: string;
  fit?: "cover" | "contain";
}) {
  const w = size ?? width;
  const h = size ?? height;
  const src = previewUrl ?? (workType.image_path
    ? getSupabase().storage.from(WORK_TYPE_IMAGE_BUCKET).getPublicUrl(workType.image_path).data.publicUrl
    : "");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <span
      className="work-type-thumbnail"
      style={{
        width: w,
        height: h,
        borderRadius: "8px",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
      }}
    >
      {src && failedSrc !== src ? (
        <Image
          src={src}
          alt={workType.name}
          width={w * 2}
          height={h * 2}
          unoptimized={true}
          onError={() => setFailedSrc(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            padding: "2px",
            borderRadius: "inherit",
          }}
        />
      ) : (
        <WorkTypeIcon name={workType.name} size={Math.round(Math.min(w, h) * 0.65)} />
      )}
    </span>
  );
}
