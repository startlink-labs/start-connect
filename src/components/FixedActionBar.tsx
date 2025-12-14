import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface FixedActionBarProps {
  leftButton: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  rightButton: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  centerContent?: ReactNode;
}

export function FixedActionBar({
  leftButton,
  rightButton,
  centerContent,
}: FixedActionBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <Button
          variant="outline"
          onClick={leftButton.onClick}
          disabled={leftButton.disabled || rightButton.loading}
          size="lg"
        >
          {leftButton.label}
        </Button>

        {centerContent && (
          <div className="text-sm text-gray-600">{centerContent}</div>
        )}

        <Button
          onClick={rightButton.onClick}
          disabled={rightButton.disabled}
          size="lg"
          className="px-8 min-w-[200px]"
        >
          {rightButton.label}
        </Button>
      </div>
    </div>
  );
}
