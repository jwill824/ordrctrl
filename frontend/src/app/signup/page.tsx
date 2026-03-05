import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center py-12 px-5 bg-white">
      <span className="text-[0.7rem] font-bold tracking-[0.28em] uppercase text-black mb-12 block">ordrctrl</span>
      <div className="w-full max-w-[22rem]">
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-black mb-1.5 leading-[1.1]">Create account</h1>
        <p className="text-sm text-zinc-500 mb-8">Start consolidating your tasks and calendar</p>
        <SignupForm />
      </div>
    </main>
  );
}
