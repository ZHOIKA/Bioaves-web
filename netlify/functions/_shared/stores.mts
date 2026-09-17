import { getDeployStore, getStore } from "@netlify/blobs";
import type { Context } from "@netlify/functions";

export function scopedStore(context: Context, name: string, strong = false) {
  const options = strong ? { consistency: "strong" as const } : undefined;
  if (context.deploy?.context === "production") {
    return options ? getStore({ name, ...options }) : getStore({ name });
  }
  return getDeployStore({ name });
}
