import Link, { LinkProps } from "next/link";
import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, DetailedHTMLProps, PropsWithChildren } from "react";

interface ButtonProps {
    intent?: "none" | "primary",
}

function addUtilitiesToClassName(className: string | undefined, { intent }: ButtonProps): string {
    const intentClasses = {
        none: "border-slate-300 dark:border-slate-500 hover:border-indigo-400 dark:hover:border-indigo-450 hover:text-indigo-800 dark:hover:text-indigo-200",
        primary: "bg-indigo-700 border-indigo-700 text-white hover:bg-indigo-600",
    }

    return `border rounded-lg px-4 py-2 text-center leading-5 ${intentClasses[intent ?? "none"]} ${className ?? ""}`;
}

export function Button({ intent, className, ...innerProps }: PropsWithChildren<ButtonProps & Omit<DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, keyof ButtonProps>>) {
    return <button type="button" className={addUtilitiesToClassName(className, { intent })} {...innerProps} />
}

export function LinkButton({ intent, className, ...innerProps }: PropsWithChildren<ButtonProps & Omit<Omit<DetailedHTMLProps<AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, keyof LinkProps> & LinkProps & React.RefAttributes<HTMLAnchorElement>, keyof ButtonProps>>) {
    return <Link className={addUtilitiesToClassName(className, { intent })} {...innerProps} />
}