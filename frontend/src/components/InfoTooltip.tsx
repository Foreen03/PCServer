import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface TooltipProps {
    content: String
}

export function InfoTooltip({
    content
}: TooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="w-4 h-4 text-muted-foreground"/>
      </TooltipTrigger>
      <TooltipContent>
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  )
}