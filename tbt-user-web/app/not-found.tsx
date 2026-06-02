import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-7xl font-black text-brand-600">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground max-w-md">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-2 bg-brand-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
