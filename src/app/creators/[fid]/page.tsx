import CreatorProfile from "@/components/CreatorProfile";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ fid: string }>;
}) {
  const { fid } = await params;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="mx-auto max-w-xl px-0 sm:px-4 py-6">
        <CreatorProfile fid={fid} />
      </div>
    </div>
  );
}
