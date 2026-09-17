import ApplicationForm from "@/components/ApplicationForm";

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">
            OA
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Office Assistant — Job Application
            </h1>
            <p className="text-sm text-slate-500">
              Fill in your details carefully. All fields marked with{" "}
              <span className="text-red-600">*</span> are required.
            </p>
          </div>
        </div>
      </header>

      <ApplicationForm />

      <footer className="mt-10 text-center text-xs text-slate-400">
        Your information is stored securely and used only for recruitment
        purposes.
      </footer>
    </main>
  );
}
