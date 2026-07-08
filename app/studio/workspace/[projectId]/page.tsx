import { StudioWorkspaceView } from "@/components/studio/workspace/studio-workspace-view";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function StudioWorkspaceProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  return <StudioWorkspaceView key={projectId} projectId={projectId} />;
}
