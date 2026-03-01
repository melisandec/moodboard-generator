import { Suspense } from "react";
import MoodboardGenerator from "@/components/MoodboardGenerator";

export default function Home() {
  return (
    <Suspense>
      <MoodboardGenerator />
    </Suspense>
  );
}
