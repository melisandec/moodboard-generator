import CreatorProfile from "@/components/CreatorProfile";

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ fid: string }>;
}) {
  const { fid } = await params;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <CreatorProfile fid={fid} />
      </div>
    </div>
  );
}
