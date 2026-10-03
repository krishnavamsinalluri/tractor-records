import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkType } from "./types";

export const WORK_TYPE_IMAGE_BUCKET = "work-type-images";
export const MAX_WORK_TYPE_IMAGE_BYTES = 2 * 1024 * 1024;
export const WORK_TYPE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const extensions: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export function workTypeImageFileError(file: Pick<File, "type" | "size">): "imageInvalidType" | "imageTooLarge" | null {
  if (!extensions[file.type] || file.size === 0) return "imageInvalidType";
  if (file.size > MAX_WORK_TYPE_IMAGE_BYTES) return "imageTooLarge";
  return null;
}

export function ownsWorkTypeImage(path: string, userId: string, workTypeId: string): boolean {
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === userId && parts[1] === workTypeId && Boolean(parts[2]);
}

type SaveOptions = {
  workType?: WorkType;
  values: Pick<WorkType, "name" | "acre_rate" | "hour_rate" | "active">;
  file: File | null;
  removeImage: boolean;
};

// The database pointer is the commit point. Never delete an image on an
// ambiguous network failure unless a follow-up read proves it is unreferenced.
export async function saveWorkTypeWithImage(supabase: SupabaseClient, options: SaveOptions): Promise<WorkType> {
  const { workType, values, file, removeImage } = options;
  if (file) {
    const error = workTypeImageFileError(file);
    if (error) throw new Error(error);
  }
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user || (workType && workType.user_id !== auth.user.id)) throw new Error("sessionExpired");
  const userId = auth.user.id;
  const id = workType?.id ?? crypto.randomUUID();
  const oldPath = workType?.image_path ?? null;
  const storage = supabase.storage.from(WORK_TYPE_IMAGE_BUCKET);
  let newPath: string | null = null;

  const removeBestEffort = async (path: string) => {
    if (!ownsWorkTypeImage(path, userId, id)) return;
    try {
      const { error } = await storage.remove([path]);
      if (error) console.warn("Work type image cleanup failed:", error.message);
    } catch {
      console.warn("Work type image cleanup could not reach Storage.");
    }
  };

  try {
    if (file) {
      newPath = `${userId}/${id}/${crypto.randomUUID()}.${extensions[file.type]}`;
      const { error } = await storage.upload(newPath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
    }
    const imagePath = newPath ?? (removeImage ? null : oldPath);
    const payload = { ...values, image_path: imagePath };
    let query = workType
      ? supabase.from("work_types").update(payload).eq("id", id).eq("user_id", userId)
      : supabase.from("work_types").insert({ ...payload, id, user_id: userId });
    // Avoid deleting an image still used by a concurrent edit on another phone.
    if (workType) query = oldPath === null ? query.is("image_path", null) : query.eq("image_path", oldPath);
    const { data, error } = await query.select("*").single();
    if (error) throw error;
    if (!data) throw new Error("Work type save was not confirmed.");
    if (oldPath && oldPath !== imagePath) await removeBestEffort(oldPath);
    return data as WorkType;
  } catch (error) {
    if (newPath) {
      try {
        const { data, error: readError } = await supabase.from("work_types")
          .select("*").eq("id", id).eq("user_id", userId).maybeSingle();
        if (!readError && data?.image_path === newPath) {
          // The write committed but its response was lost. Treat it as saved.
          if (oldPath && oldPath !== newPath) await removeBestEffort(oldPath);
          return data as WorkType;
        }
        if (!readError) await removeBestEffort(newPath);
      } catch {
        // Keep the file if the database is unreachable; it may be referenced.
      }
    }
    throw error;
  }
}
