import Link from "next/link";

const links = [
  ["/find", "Find a desk", "Founder: map of empty offices"],
  ["/capture", "Scan an office", "Landlord: photos → Grok checklist"],
  ["/checkin", "Door list", "On-site lead: check the cleaners in"],
  ["/ledger", "My credits", "Every hour traced to its photos"],
  ["/supervisor", "Supervisor queue", "Approve or overturn Grok"],
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">WeWorkWeekend</h1>
      <p className="mt-1 opacity-70">Empty offices at weekends. Clean for your desk.</p>
      <ul className="mt-8 flex flex-col gap-3">
        {links.map(([href, title, sub]) => (
          <li key={href}>
            <Link href={href} className="block rounded-2xl border border-black/10 p-4 dark:border-white/15">
              <div className="font-semibold">{title}</div>
              <div className="text-sm opacity-60">{sub}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
