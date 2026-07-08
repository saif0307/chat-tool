"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/content-studio/services/project-service";

/** `/studio/workspace` has no project yet — create one and hand off to the dynamic route. */
export function NewProjectRedirect() {
  const router = useRouter();
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    const project = createProject();
    router.replace(`/studio/workspace/${project.id}`);
  }, [router]);

  return (
    <div className="text-foreground/50 flex flex-1 items-center justify-center p-8 text-sm">
      Setting up your workspace…
    </div>
  );
}
