import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useHubSpotObjects } from "@/hooks/useHubSpotObjects";

export function HubSpotObjectsPopover() {
  const { objects, loading, error } = useHubSpotObjects();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <Info className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-sm">HubSpotオブジェクト</h4>
            <p className="text-xs text-muted-foreground">
              利用可能なオブジェクト一覧
            </p>
          </div>
          {loading && (
            <div className="text-xs text-muted-foreground">読み込み中...</div>
          )}
          {error && <div className="text-xs text-destructive">{error}</div>}
          {!loading && !error && objects.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {objects.length}個
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {objects.map((obj) => (
                  <div
                    key={obj.object_type_id}
                    className="flex items-center justify-between p-2 border rounded text-xs"
                  >
                    <div>
                      <div className="font-medium">{obj.label}</div>
                      <div className="text-muted-foreground">{obj.name}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {obj.object_type_id}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
