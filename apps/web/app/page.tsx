import CampConsole from "../components/camps/console";
export const dynamic = "force-dynamic";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
export default async function Page() {
  if (
    process.env.CAMP_PREVIEW_URL &&
    (await headers()).get("host") === new URL(process.env.CAMP_PREVIEW_URL).host
  )
    notFound();
  return <CampConsole />;
}
