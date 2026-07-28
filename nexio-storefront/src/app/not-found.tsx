import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-[70vh] w-full items-center justify-center px-4">
      <EmptyState
        icon={<SearchX className="h-6 w-6 text-muted-foreground" />}
        title="الصفحة غير موجودة"
        description="عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. ربما تم نقلها أو حذفها."
        action={
          <Button asChild variant="default">
            <Link href="/">العودة للرئيسية</Link>
          </Button>
        }
      />
    </div>
  );
}
