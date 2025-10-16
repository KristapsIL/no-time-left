import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'About', href: '/dashboard' }, // still using /dashboard
];

export default function About() {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="About" />
      <div className="p-4 space-y-6">
        <h1 className="text-3xl font-bold">About Me</h1>

        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border p-4">
          <h2 className="text-xl font-semibold mb-2">Contact</h2>
          <p>Email: ipb22.k.liepins@vtdt.edu.lv</p>
        </div>
      </div>
    </AppLayout>
  );
}