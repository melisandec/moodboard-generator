import { Suspense } from "react";
import MoodboardGenerator from "@/components/MoodboardGenerator";
import { TokenDisplay } from "@/components/TokenDisplay";

export default function Home() {
  return (
    <Suspense>
      <TokenDisplay />
      <MoodboardGenerator />
    </Suspense>
  );
}
