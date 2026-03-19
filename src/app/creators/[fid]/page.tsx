import CreatorProfile from "@/components/CreatorProfile";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ fid: string }>;
}) {
  const { fid } = await params;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 max-w-lg mx-auto overflow-hidden">
      <CreatorProfile fid={fid} />
    </div>
  );
}
