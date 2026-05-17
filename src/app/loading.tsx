export default function Loading() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-md px-6">
        <p className="text-gray-500 text-sm mb-3">Loading Infrastruct…</p>
        <div className="h-0.5 w-full rounded-full bg-gray-800 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
