import { redirect } from 'next/navigation';

export default function DismissedSettingsPage() {
  redirect('/feed?showDismissed=true');
}
