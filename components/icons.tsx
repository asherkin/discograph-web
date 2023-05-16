import { ForwardedRef, forwardRef, PropsWithoutRef, RefAttributes, SVGProps } from "react";

export const SmallStepIcon = forwardRef(function SmallStepIcon({ title, titleId, ...props }: PropsWithoutRef<SVGProps<SVGSVGElement>> & { title?: string, titleId?: string } & RefAttributes<SVGSVGElement>, svgRef: ForwardedRef<SVGSVGElement>) {
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" ref={svgRef} aria-labelledby={titleId} {...props}>
        {title && <title id={titleId}>{title}</title>}
        <path d="M8.085 7.806c.005-.58.756-1.086 1.3-.53l2.31 2.184a.748.748 0 0 1 0 1.08l-2.35 2.224c-.415.399-.94.193-1.165-.18a.747.747 0 0 1-.112-.383Z" />
    </svg>;
});