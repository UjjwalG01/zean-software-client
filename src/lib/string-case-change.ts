import React from "react";

export const capitalizeFirstLetter = (input: string): string => {
    if (!input) return "";
    return input.charAt(0).toUpperCase() + input.slice(1);
};

export function underlineFirstChar(str: string): React.ReactNode {
    if (!str) return "";
    const firstChar = str.charAt(0);
    const restOfString = str.slice(1);
    // Using createElement allows us to generate JSX architecture inside a non-JSX .ts file
    return React.createElement(
        "span",
        { className: "inline" },
        React.createElement("span", { className: "underline decoration-1 font-medium" }, firstChar),
        restOfString
    );
}

export function underlineSpecificChars(str: string, indices: number[] = [0, 2, 3]): React.ReactNode {
    if (!str) return "";

    const characters = str.split("");

    // Wrap everything inside a single inline span container to prevent layout gaps
    return React.createElement(
        "span",
        { className: "inline" },
        ...characters.map((char, index) => {
            if (indices.includes(index)) {
                return React.createElement(
                    "span",
                    { key: index, className: "underline decoration-1 font-medium" },
                    char
                );
            }
            return char; // Return plain text for non-targeted positions
        })
    );
}