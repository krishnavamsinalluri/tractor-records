"use client";

import Image from "next/image";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { WORK_TYPE_IMAGE_BUCKET } from "@/lib/work-type-images";
import type { WorkType } from "@/lib/types";

export function WorkTypeThumbnail({ workType, size = 40, previewUrl }: {
  workType: Pick<WorkType, "name" | "image_path">;
  size?: number;
  previewUrl?: string;
}) {
  const src = previewUrl ?? (workType.image_path
    ? getSupabase().storage.from(WORK_TYPE_IMAGE_BUCKET).getPublicUrl(workType.image_path).data.publicUrl
    : "");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span className="work-type-thumbnail" style={{ width: size, height: size }}>
      {src && failedSrc !== src ? (
        <Image src={src} alt={workType.name} width={size} height={size}
          unoptimized={Boolean(previewUrl)} onError={() => setFailedSrc(src)}
          style={{ width: size, height: size, objectFit: "contain" }} />
      ) : null}
    </span>
  );
}
