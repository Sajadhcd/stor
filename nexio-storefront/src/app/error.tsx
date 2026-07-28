'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service safely
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[70vh] w-full items-center justify-center px-4">
      <EmptyState
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title="عذراً، حدث خطأ ما"
        description="لم نتمكن من إكمال طلبك بسبب خطأ غير متوقع. يرجى المحاولة مرة أخرى."
        action={
          <Button onClick={() => reset()} variant="default">
            إعادة المحاولة
          </Button>
        }
      />
    </div>
  );
}
