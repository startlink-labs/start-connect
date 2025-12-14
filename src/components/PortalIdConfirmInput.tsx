import { Input } from "@/components/ui/input";

interface PortalIdConfirmInputProps {
  expectedValue: string;
  value: string;
  onChange: (value: string) => void;
}

export function PortalIdConfirmInput({
  expectedValue,
  value,
  onChange,
}: PortalIdConfirmInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // 数字のみ許可し、期待値の長さまで制限
    const filtered = input.replace(/\D/g, "").slice(0, expectedValue.length);

    // 期待値と一致する文字のみ許可
    let validated = "";
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i] === expectedValue[i]) {
        validated += filtered[i];
      } else {
        break;
      }
    }

    onChange(validated);
  };

  const _chars = expectedValue.split("");

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={handleChange}
        className="font-mono font-medium border-destructive focus-visible:ring-destructive pr-2"
        autoComplete="off"
        inputMode="numeric"
      />
      <div className="absolute inset-0 flex items-center pointer-events-none font-mono font-medium">
        <span className="pl-3 invisible">{value}</span>
        <span className="text-muted-foreground/40">
          {expectedValue.slice(value.length)}
        </span>
      </div>
    </div>
  );
}
