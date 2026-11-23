import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigation } from "react-router";

/** Bilah tipis di atas halaman: tampil bila pindah halaman atau ada data yang sedang diambil (tertunda 120 ms agar tidak berkedip). */
export function TopProgress() {
  const navigation = useNavigation();
  const fetching = useIsFetching();
  const busy = navigation.state !== "idle" || fetching > 0;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!busy) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(t);
  }, [busy]);
  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}>
      <div className="ctrl-indeterminate h-full w-1/3 bg-primary" />
    </div>
  );
}
