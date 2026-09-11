import CampConsole from "../components/camps/console";
import CyberConsole from "./cyber/page";
export const dynamic = "force-dynamic";
export default function Page() {
  return process.env.YAMNAYA_EXPERIENCE === "cyber" ? (
    <CyberConsole />
  ) : (
    <CampConsole
      archiveUrl={process.env.CAMP_ARCHIVE_URL ?? "http://localhost:3100"}
    />
  );
}
