import { redirect } from "next/navigation";

// Founders are the default audience; landlords start at /capture.
export default function Home() {
  redirect("/find");
}
