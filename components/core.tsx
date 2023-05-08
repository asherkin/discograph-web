import Link, { LinkProps } from "next/link";
import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, DetailedHTMLProps, PropsWithChildren } from "react";

interface ButtonProps {
    intent?: "none" | "primary",
    disabled?: boolean,
}

function addUtilitiesToClassName(className: string | undefined, { intent, disabled }: ButtonProps): string {
    const intentClasses = {
        none: "border-slate-300 dark:border-slate-500",
        primary: "bg-indigo-700 border-indigo-700 text-white",
    }

    const intentHoverClasses = {
        none: "hover:border-indigo-400 dark:hover:border-indigo-450 hover:text-indigo-800 dark:hover:text-indigo-200",
        primary: "hover:bg-indigo-600",
    }

    const disabledClasses = "opacity-60 dark:opacity-50";

    return `border rounded-lg px-4 py-2 text-center leading-5 ${intentClasses[intent ?? "none"]} ${disabled ? disabledClasses : intentHoverClasses[intent ?? "none"]} ${className ?? ""}`;
}

export function Button({ intent, disabled = false, className, ...innerProps }: PropsWithChildren<ButtonProps & Omit<DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, keyof ButtonProps>>) {
    return <button type="button" className={addUtilitiesToClassName(className, { intent, disabled })} disabled={disabled} {...innerProps} />
}

export function LinkButton({ intent, className, ...innerProps }: PropsWithChildren<ButtonProps & Omit<Omit<DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, keyof LinkProps> & LinkProps & React.RefAttributes<HTMLAnchorElement>, keyof ButtonProps>>) {
    // TODO: Do something useful with `disabled`
    return <Link className={addUtilitiesToClassName(className, { intent })} {...innerProps} />
}

interface CalloutProps {
    intent: "danger" | "warning",
    className?: string,
}

export function Callout({ intent, className: extraClassName = "", ...innerProps }: PropsWithChildren<CalloutProps>) {
    const intentClasses = {
        danger: "bg-red-50 text-red-950 border-red-700 dark:bg-red-950 dark:text-red-100",
        warning: "bg-yellow-50 text-yellow-950 border-yellow-700 dark:bg-yellow-950 dark:text-yellow-100",
    };

    const className = `border border-s-4 p-4 rounded-xl ${intentClasses[intent]} ${extraClassName}`;

    return <div className={className} {...innerProps} />
}