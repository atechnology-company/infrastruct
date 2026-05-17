"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-gray-400 text-sm mb-6">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
