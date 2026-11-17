import { redirect } from 'next/navigation';
import Tabs from '@/components/Tabs';
import { isAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect('/login');
  return (
    <>
      <main>{children}</main>
      <Tabs />
    </>
  );
}
